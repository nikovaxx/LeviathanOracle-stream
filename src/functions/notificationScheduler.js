const cron = require('node-cron');
const db = require('../schemas/postgres');

let cronJobs = new Map();
let discordClient = null;

/**
 * Initialize the notification scheduler
 */
async function initialize(client) {
  discordClient = client;
  console.log('Initializing notification scheduler...');
  
  // Rehydrate scheduled notifications on startup
  await rehydrateScheduledNotifications();
  
  // Schedule hourly update job to refresh anime schedules
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly anime schedule update...');
    await updateAnimeSchedules();
  });
  
  console.log('Notification scheduler ready');
}

/**
 * Rehydrate scheduled notifications from database on startup
 */
async function rehydrateScheduledNotifications() {
  try {
    const result = await db.query(
      'SELECT * FROM watchlists WHERE next_airing_at IS NOT NULL AND next_airing_at > $1',
      [Date.now()]
    );
    
    console.log(`Rehydrating ${result.rows.length} scheduled notifications...`);
    
    for (const row of result.rows) {
      scheduleNotification(row);
    }
  } catch (error) {
    console.error('Failed to rehydrate notifications:', error.message);
  }
}

/**
 * Schedule a notification for an anime episode
 */
function scheduleNotification(watchlistEntry) {
  const { id, user_id, anime_id, anime_title, next_airing_at } = watchlistEntry;
  
  if (!next_airing_at || next_airing_at <= Date.now()) {
    return;
  }
  
  // Cancel existing job if any
  if (cronJobs.has(id)) {
    cronJobs.get(id).stop();
  }
  
  // Calculate delay
  const delay = next_airing_at - Date.now();
  const delayMinutes = Math.floor(delay / 1000 / 60);
  
  console.log(`Scheduling notification for watchlist ID ${id} (${anime_title}) in ${delayMinutes} minutes`);
  
  // Schedule using setTimeout (for precise timing)
  const timeout = setTimeout(async () => {
    await sendNotification(watchlistEntry);
    cronJobs.delete(id);
  }, delay);
  
  cronJobs.set(id, { stop: () => clearTimeout(timeout) });
}

/**
 * Send notification to user
 */
async function sendNotification(watchlistEntry) {
  const { user_id, anime_id, anime_title, next_airing_at } = watchlistEntry;
  
  try {
    // Fetch updated anime details
    const anilistUtils = require('../utils/anilist');
    const animeDetails = await anilistUtils.fetchAnimeDetailsById(anime_id);
    
    const episodeNumber = animeDetails.nextAiringEpisode
      ? animeDetails.nextAiringEpisode.episode - 1
      : 'Latest';
    
    const embed = {
      color: 0x0099ff,
      title: `New Episode of ${animeDetails.title.english || animeDetails.title.romaji} Released!`,
      description: `Episode ${episodeNumber} is now available!\n\nAired at: ${new Date(next_airing_at).toUTCString()} UTC.\nRemember that the episode might take some time depending on what platform you are watching.`,
      timestamp: new Date(next_airing_at),
      thumbnail: { url: animeDetails.coverImage.large },
      footer: { text: 'Episode just released!' },
    };
    
    const user = await discordClient.users.fetch(user_id);
    const channel = await user.createDM();
    await channel.send({ embeds: [embed] });
    
    console.log(`✓ Notification sent to ${user_id} for ${anime_title}`);
    
    // Update next airing time in database
    if (animeDetails.nextAiringEpisode && animeDetails.nextAiringEpisode.airingAt * 1000 > Date.now()) {
      const newAiringTime = animeDetails.nextAiringEpisode.airingAt * 1000;
      
      await db.query(
        'UPDATE watchlists SET next_airing_at = $1 WHERE id = $2',
        [newAiringTime, watchlistEntry.id]
      );
      
      // Reschedule for next episode
      scheduleNotification({
        ...watchlistEntry,
        next_airing_at: newAiringTime,
      });
    }
  } catch (error) {
    console.error(`Failed to send notification for watchlist ID ${watchlistEntry.id}:`, error.message);
  }
}

/**
 * Update anime schedules hourly to catch any changes
 */
async function updateAnimeSchedules() {
  try {
    const result = await db.query('SELECT * FROM watchlists WHERE next_airing_at IS NOT NULL');
    
    const anilistUtils = require('../utils/anilist');
    
    for (const row of result.rows) {
      try {
        const animeDetails = await anilistUtils.fetchAnimeDetailsById(row.anime_id);
        
        if (animeDetails.nextAiringEpisode) {
          const newAiringTime = animeDetails.nextAiringEpisode.airingAt * 1000;
          
          // Update if changed
          if (newAiringTime !== row.next_airing_at) {
            await db.query(
              'UPDATE watchlists SET next_airing_at = $1 WHERE id = $2',
              [newAiringTime, row.id]
            );
            
            // Reschedule notification
            scheduleNotification({
              ...row,
              next_airing_at: newAiringTime,
            });
            
            console.log(`Updated schedule for ${row.anime_title}`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to update schedule for anime ${row.anime_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Failed to update anime schedules:', error.message);
  }
}

/**
 * Cancel a scheduled notification
 */
function cancelNotification(watchlistId) {
  if (cronJobs.has(watchlistId)) {
    cronJobs.get(watchlistId).stop();
    cronJobs.delete(watchlistId);
    console.log(`Cancelled notification for watchlist ID ${watchlistId}`);
  }
}

module.exports = {
  initialize,
  scheduleNotification,
  cancelNotification,
  sendNotification,
};
