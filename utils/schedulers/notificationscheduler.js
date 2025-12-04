import cron from 'node-cron';
import chalk from 'chalk';
import { getAllScheduledNotifications, updateNextAiring, getUpcomingNotifications } from '../../database/dbmanager.js';
import { fetchAnimeDetailsById } from '../anilist.js';
import { errorHandler } from '../errorHandler.js';
import { notificationEmbed } from '../embeds/notificationembed.js';

let client = null;
const activeJobs = new Map(); // Track scheduled notification jobs

// Initialize the scheduler with Discord client
export function initializeScheduler(discordClient) {
  client = discordClient;
  console.log(
    chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
    chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
    chalk.blue('Initializing notification scheduler...')
  );

  // Check for imminent notifications every minute
  cron.schedule('* * * * *', checkImminentNotifications);

  // Update anime info and reschedule every hour
  cron.schedule('0 * * * *', updateAnimeSchedules);

  console.log(
    chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
    chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
    chalk.green('✓ Cron Jobs') + chalk.white(' Started!')
  );

  // Rehydrate notifications on startup
  rehydrateNotifications();
}

// Rehydrate all scheduled notifications on startup
async function rehydrateNotifications() {
  try {
    const notifications = await getAllScheduledNotifications();
    
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
      chalk.blue(`Rehydrating ${notifications.length} scheduled notifications...`)
    );

    for (const notification of notifications) {
      scheduleNotification(notification);
    }

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green(`✓ Rehydrated ${notifications.length} notifications`)
    );
  } catch (err) {
    errorHandler(err, 'Notification Rehydration Error');
  }
}

// Schedule a single notification using setTimeout
function scheduleNotification(notification) {
  const { id, user_id, anime_id, anime_title, next_airing_at } = notification;
  const delay = next_airing_at - Date.now();

  // Clear existing timeout if any
  if (activeJobs.has(id)) {
    clearTimeout(activeJobs.get(id));
  }

  // Don't schedule if already passed
  if (delay <= 0) {
    return;
  }

  // Schedule the notification
  const timeout = setTimeout(async () => {
    try {
      await sendNotification(user_id, anime_id, anime_title, next_airing_at);
      
      // Update next airing episode after notification sent
      const animeDetails = await fetchAnimeDetailsById(anime_id);
      if (animeDetails?.nextAiringEpisode) {
        const newAiringTime = animeDetails.nextAiringEpisode.airingAt * 1000;
        if (newAiringTime > Date.now()) {
          await updateNextAiring(id, newAiringTime);
          // Reschedule with new time
          scheduleNotification({
            id,
            user_id,
            anime_id,
            anime_title,
            next_airing_at: newAiringTime
          });
        }
      }
      
      activeJobs.delete(id);
    } catch (err) {
      errorHandler(err, `Send Notification Error - Anime ID: ${anime_id}`);
      activeJobs.delete(id);
    }
  }, delay);

  activeJobs.set(id, timeout);
}

// Check for notifications within the next minute
async function checkImminentNotifications() {
  try {
    // Get notifications in next 2 minutes (buffer for processing)
    const notifications = await getUpcomingNotifications(120000);
    
    for (const notification of notifications) {
      // Schedule if not already scheduled
      if (!activeJobs.has(notification.id)) {
        scheduleNotification(notification);
      }
    }
  } catch (err) {
    errorHandler(err, 'Check Imminent Notifications Error');
  }
}

// Update anime schedules hourly
async function updateAnimeSchedules() {
  try {
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.blue('INFO') + chalk.white('] ') +
      chalk.blue('Running hourly anime schedule update...')
    );

    const notifications = await getAllScheduledNotifications();
    let updated = 0;

    for (const notification of notifications) {
      try {
        const animeDetails = await fetchAnimeDetailsById(notification.anime_id);
        
        if (animeDetails?.nextAiringEpisode) {
          const newAiringTime = animeDetails.nextAiringEpisode.airingAt * 1000;
          
          // Update if airing time changed
          if (newAiringTime !== notification.next_airing_at && newAiringTime > Date.now()) {
            await updateNextAiring(notification.id, newAiringTime);
            
            // Reschedule notification
            if (activeJobs.has(notification.id)) {
              clearTimeout(activeJobs.get(notification.id));
              activeJobs.delete(notification.id);
            }
            
            scheduleNotification({
              ...notification,
              next_airing_at: newAiringTime
            });
            
            updated++;
          }
        }
      } catch (err) {
        errorHandler(err, `Update Schedule Error - Anime ID: ${notification.anime_id}`);
      }
      
      // Rate limiting: delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green(`Updated ${updated} anime schedules`)
    );
  } catch (err) {
    errorHandler(err, 'Update Anime Schedules Error');
  }
}

// Send notification to user
async function sendNotification(userId, animeId, animeTitle, airingTime) {
  try {
    if (!client) {
      throw new Error('Discord client not initialized');
    }

    const animeDetails = await fetchAnimeDetailsById(animeId);
    const episodeNumber = animeDetails?.nextAiringEpisode 
      ? animeDetails.nextAiringEpisode.episode - 1 
      : 'Latest';

    const embed = notificationEmbed(
      animeTitle,
      episodeNumber,
      airingTime,
      animeDetails?.coverImage?.large
    );

    const user = await client.users.fetch(userId);
    const channel = await user.createDM();
    await channel.send({ embeds: [embed] });

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('NOTIFICATION') + chalk.white('] ') +
      chalk.green(`Sent to ${userId} for ${animeTitle}`)
    );
  } catch (err) {
    errorHandler(err, `Send Notification Failed - User: ${userId}, Anime: ${animeTitle}`);
  }
}

// Manually schedule a new notification (for when user adds to watchlist)
export function scheduleNewNotification(notification) {
  scheduleNotification(notification);
}

// Cancel a notification (for when user removes from watchlist)
export function cancelNotification(watchlistId) {
  if (activeJobs.has(watchlistId)) {
    clearTimeout(activeJobs.get(watchlistId));
    activeJobs.delete(watchlistId);
  }
}
