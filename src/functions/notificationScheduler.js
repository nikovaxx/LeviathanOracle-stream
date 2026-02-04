const cron = require('node-cron');
const db = require('../schemas/db');
const { embed } = require('../functions/ui');
const { fetchAnimeDetailsById } = require('../utils/anilist');

let discordClient = null;
const activeJobs = new Map();
const activeRoleJobs = new Map();

async function initialize(client) {
  discordClient = client;
  console.log('Initializing scheduler...');

  const { rows: userRows } = await db.query('SELECT * FROM watchlists WHERE next_airing_at > $1', [Date.now()]);
  userRows.forEach(row => scheduleNotification(row));

  const { rows: roleRows } = await db.query('SELECT * FROM role_notifications WHERE next_airing_at > $1', [Date.now()]);
  roleRows.forEach(row => scheduleRoleNotification(row));

  cron.schedule('0 * * * *', updateAnimeSchedules);
}

function scheduleNotification(entry) {
  if (!entry.next_airing_at || entry.next_airing_at <= Date.now()) return;

  cancelNotification(entry.id);

  const delay = entry.next_airing_at - Date.now();
  const timeout = setTimeout(() => sendNotification(entry), delay);
  activeJobs.set(entry.id, timeout);
}

function scheduleRoleNotification(entry) {
  if (!entry.next_airing_at || entry.next_airing_at <= Date.now()) return;

  cancelRoleNotification(entry.id);

  const delay = entry.next_airing_at - Date.now();
  const timeout = setTimeout(() => sendRoleNotification(entry), delay);
  activeRoleJobs.set(entry.id, timeout);
}

async function sendNotification(entry) {
  try {
    const anime = await fetchAnimeDetailsById(entry.anime_id);
    if (!anime) return;

    const ep = anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 'Latest';
    const notificationEmbed = embed({
      title: `Episode Released: ${anime.title.english || anime.title.romaji}`,
      desc: `**Episode ${ep}** is now available!\\n\\n<t:${Math.floor(entry.next_airing_at / 1000)}:R>`,
      thumbnail: anime.coverImage?.large,
      color: '#0099ff'
    });

    const { rows: prefRows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [entry.user_id]);
    const notifType = prefRows.length ? prefRows[0].notification_type : 'dm';

    if (notifType === 'dm') {
      const user = await discordClient.users.fetch(entry.user_id).catch(() => null);
      if (user) await user.send({ embeds: [notificationEmbed] }).catch(() => null);
    } else {
      const guilds = discordClient.guilds.cache;
      for (const guild of guilds.values()) {
        const member = await guild.members.fetch(entry.user_id).catch(() => null);
        if (member) {
          const { rows: guildRows } = await db.query('SELECT notification_channel_id FROM guild_settings WHERE guild_id = $1', [guild.id]);
          const channelId = guildRows.length ? guildRows[0].notification_channel_id : null;
          
          if (channelId) {
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (channel) {
              await channel.send({ content: `<@${entry.user_id}>`, embeds: [notificationEmbed] }).catch(() => null);
              break;
            }
          }
        }
      }
    }

    activeJobs.delete(entry.id);

    if (anime.nextAiringEpisode) {
      const nextTime = anime.nextAiringEpisode.airingAt * 1000;
      await db.query('UPDATE watchlists SET next_airing_at = $1 WHERE id = $2', [nextTime, entry.id]);
      scheduleNotification({ ...entry, next_airing_at: nextTime });
    }
  } catch (err) {
    console.error(`Notification error [ID ${entry.id}]:`, err.message);
  }
}

async function sendRoleNotification(entry) {
  try {
    const anime = await fetchAnimeDetailsById(entry.anime_id);
    if (!anime) return;

    const ep = anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 'Latest';
    const notificationEmbed = embed({
      title: `Episode Released: ${anime.title.english || anime.title.romaji}`,
      desc: `**Episode ${ep}** is now available!\\n\\n<t:${Math.floor(entry.next_airing_at / 1000)}:R>`,
      thumbnail: anime.coverImage?.large,
      color: '#0099ff'
    });

    const guild = await discordClient.guilds.fetch(entry.guild_id).catch(() => null);
    if (guild) {
      const { rows: guildRows } = await db.query('SELECT notification_channel_id FROM guild_settings WHERE guild_id = $1', [guild.id]);
      const channelId = guildRows.length ? guildRows[0].notification_channel_id : null;
      
      if (channelId) {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel.send({ content: `<@&${entry.role_id}>`, embeds: [notificationEmbed] }).catch(() => null);
        }
      }
    }

    activeRoleJobs.delete(entry.id);

    if (anime.nextAiringEpisode) {
      const nextTime = anime.nextAiringEpisode.airingAt * 1000;
      await db.query('UPDATE role_notifications SET next_airing_at = $1 WHERE id = $2', [nextTime, entry.id]);
      scheduleRoleNotification({ ...entry, next_airing_at: nextTime });
    }
  } catch (err) {
    console.error(`Role notification error [ID ${entry.id}]:`, err.message);
  }
}

async function updateAnimeSchedules() {
  const { rows: userRows } = await db.query('SELECT * FROM watchlists WHERE next_airing_at IS NOT NULL');
  const { rows: roleRows } = await db.query('SELECT * FROM role_notifications WHERE next_airing_at IS NOT NULL');
  
  for (const row of userRows) {
    const anime = await fetchAnimeDetailsById(row.anime_id);
    const newTime = anime?.nextAiringEpisode?.airingAt * 1000;

    if (newTime && newTime !== row.next_airing_at) {
      await db.query('UPDATE watchlists SET next_airing_at = $1 WHERE id = $2', [newTime, row.id]);
      scheduleNotification({ ...row, next_airing_at: newTime });
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  for (const row of roleRows) {
    const anime = await fetchAnimeDetailsById(row.anime_id);
    const newTime = anime?.nextAiringEpisode?.airingAt * 1000;

    if (newTime && newTime !== row.next_airing_at) {
      await db.query('UPDATE role_notifications SET next_airing_at = $1 WHERE id = $2', [newTime, row.id]);
      scheduleRoleNotification({ ...row, next_airing_at: newTime });
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

function cancelNotification(id) {
  if (activeJobs.has(id)) {
    clearTimeout(activeJobs.get(id));
    activeJobs.delete(id);
  }
}

function cancelRoleNotification(id) {
  if (activeRoleJobs.has(id)) {
    clearTimeout(activeRoleJobs.get(id));
    activeRoleJobs.delete(id);
  }
}

module.exports = { initialize, scheduleNotification, scheduleRoleNotification, cancelNotification, cancelRoleNotification };
