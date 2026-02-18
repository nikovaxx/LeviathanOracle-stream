const cron = require('node-cron');
const db = require('../schemas/db');
const { embed } = require('./ui');
const { getAnimeByAniListId } = require('../utils/API-services');

let bot = null;
const jobs = { user: new Map(), role: new Map() };
const inFlight = { user: new Set(), role: new Set() };
let cronRunning = false;

async function poll(ts) {
  if (ts) {
    const { rowCount } = await db.query("SELECT 1 FROM bot_state WHERE key = $1", ['last_poll']);
    return rowCount
      ? db.query("UPDATE bot_state SET value = $1 WHERE key = $2", [String(ts), 'last_poll'])
      : db.query("INSERT INTO bot_state (key, value) VALUES ($1, $2)", ['last_poll', String(ts)]);
  }
  const { rows } = await db.query("SELECT value FROM bot_state WHERE key = $1", ['last_poll']);
  return rows[0]?.value || 0;
}

async function initialize(client) {
  bot = client;
  await catchMissed();
  
  const users = await db.query('SELECT * FROM watchlists WHERE next_airing_at > $1', [Date.now()]);
  users.rows.forEach(r => schedule(r, 'user'));

  const roles = await db.query('SELECT * FROM role_notifications WHERE next_airing_at > $1', [Date.now()]);
  roles.rows.forEach(r => schedule(r, 'role'));

  cron.schedule('0 * * * *', async () => {
    if (cronRunning) return;
    cronRunning = true;
    try {
      await catchMissed();
      await updateSchedules();
      await poll(Date.now());
    } finally {
      cronRunning = false;
    }
  });
  await poll(Date.now());
}

async function catchMissed() {
  const last = await poll(), now = Date.now();
  const u = await db.query('SELECT * FROM watchlists WHERE next_airing_at > $1 AND next_airing_at <= $2', [last, now]);
  const r = await db.query('SELECT * FROM role_notifications WHERE next_airing_at > $1 AND next_airing_at <= $2', [last, now]);

  for (const row of [...u.rows.map(x => ({...x, type: 'user'})), ...r.rows.map(x => ({...x, type: 'role'}))]) {
    await send(row, row.type);
    await new Promise(res => setTimeout(res, 1000));
  }
}

function schedule(entry, type) {
  if (!entry.next_airing_at || entry.next_airing_at <= Date.now()) return;
  if (jobs[type].has(entry.id)) clearTimeout(jobs[type].get(entry.id));
  jobs[type].set(entry.id, setTimeout(() => send(entry, type), entry.next_airing_at - Date.now()));
}

async function send(entry, type) {
  if (inFlight[type].has(entry.id)) return;
  inFlight[type].add(entry.id);
  try {
    const a = await getAnimeByAniListId(entry.anime_id);
    if (!a) return;

    const epNum = a.nextAiringEpisode?.episode - 1 || 'Latest';
    const airedDate = new Date(entry.next_airing_at).toUTCString();
    const footer = `Episode just released!`;

    const e = embed({
      title: `New Episode of ${a.title.english || a.title.romaji} Released!`,
      desc: `Episode ${epNum} is now available!\nAired at: ${airedDate}. Remember that the episode might take some time depending on which platform you are watching on.`,
      thumbnail: a.coverImage?.large, color: '#0099ff',
      footer
    });

    if (type === 'user') {
      const { rows: p } = await db.query('SELECT notification_type FROM user_preferences WHERE user_id = $1', [entry.user_id]);
      const notifType = p[0]?.notification_type || 'dm';
      if (notifType === 'dm') {
        const u = await bot.users.fetch(entry.user_id).catch(() => null);
        if (u) await u.send({ embeds: [e] }).catch(() => null);
      } else {
        const g = bot.guilds.cache.find(g => g.members.cache.has(entry.user_id));
        const { rows: s } = await db.query('SELECT notification_channel_id FROM guild_settings WHERE guild_id = $1', [g?.id]);
        if (s[0]?.notification_channel_id) (await bot.channels.fetch(s[0].notification_channel_id))?.send({ content: `<@${entry.user_id}>`, embeds: [e] }).catch(() => null);
      }
    } else {
      const { rows: s } = await db.query('SELECT notification_channel_id FROM guild_settings WHERE guild_id = $1', [entry.guild_id]);
      if (s[0]?.notification_channel_id) (await bot.channels.fetch(s[0].notification_channel_id))?.send({ content: `<@&${entry.role_id}>`, embeds: [e] }).catch(() => null);
    }

    jobs[type].delete(entry.id);
    if (a.nextAiringEpisode?.airingAt) {
      const next = a.nextAiringEpisode.airingAt * 1000;
      const table = type === 'user' ? 'watchlists' : 'role_notifications';
      await db.query(`UPDATE ${table} SET next_airing_at = $1 WHERE id = $2`, [next, entry.id]);
      schedule({ ...entry, next_airing_at: next }, type);
    }
  } catch (err) { console.error(`Error [${type} ${entry.id}]:`, err.message); }
  finally {
    inFlight[type].delete(entry.id);
  }
}

async function updateSchedules() {
  const tables = { user: 'watchlists', role: 'role_notifications' };
  for (const [type, table] of Object.entries(tables)) {
    const { rows } = await db.query(`SELECT * FROM ${table} WHERE next_airing_at IS NOT NULL`);
    for (const row of rows) {
      const a = await getAnimeByAniListId(row.anime_id);
      const next = a?.nextAiringEpisode?.airingAt * 1000;
      if (next && next !== row.next_airing_at) {
        await db.query(`UPDATE ${table} SET next_airing_at = $1 WHERE id = $2`, [next, row.id]);
        schedule({ ...row, next_airing_at: next }, type);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function cancel(id, type) {
  if (jobs[type]?.has(id)) {
    clearTimeout(jobs[type].get(id));
    jobs[type].delete(id);
  }
}

module.exports = {
  initialize,
  schedule,
  cancel,
  scheduleNotification: (entry) => schedule(entry, 'user'),
  scheduleRoleNotification: (entry) => schedule(entry, 'role'),
  cancelNotification: (id) => cancel(id, 'user'),
  cancelRoleNotification: (id) => cancel(id, 'role'),
};
