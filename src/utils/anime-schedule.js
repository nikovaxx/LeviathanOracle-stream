const axios = require('axios');
const redis = require('../schemas/redis');
const config = require('../../config.json');

const BASE_URL = 'https://animeschedule.net/api/v3';
const API_KEY = config.apitokens.animeschedule;

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function getSchedule(type) {
  const cacheKey = `schedule:${type}`;
  if (redis.client) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);
  }

  try {
    const { data } = await axios.get(`${BASE_URL}/timetables/${type}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 5000
    });
    if (redis.client && data?.length) await redis.set(cacheKey, JSON.stringify(data), { EX: 300 });
    return data || [];
  } catch { return []; }
}

async function findNextSubEpisodeByTitles(titles) {
  const targets = titles.filter(Boolean).map(normalize);
  const list = await getSchedule('sub');

  const match = list.find(a => targets.includes(normalize(a.title))) || 
                list.find(a => targets.some(t => t.length > 3 && (normalize(a.title).includes(t) || t.includes(normalize(a.title)))));

  return match ? { title: match.title, episodeDate: match.episodeDate, episodeNumber: match.episodeNumber } : null;
}

async function fetchDailySchedule(day, airType = 'all') {
  const list = await getSchedule(airType);
  return list.filter(a => new Date(a.episodeDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === day.toLowerCase());
}

module.exports = { fetchDailySchedule, findNextSubEpisodeByTitles };
