const axios = require('axios');
const redis = require('../schemas/redis');

const API_URL = 'https://graphql.anilist.co';
const TTL = 900; // 15 minutes

async function request(cacheKey, query, variables) {
  if (redis.client) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);
  }

  try {
    const { data: { data } } = await axios.post(API_URL, { query, variables });
    if (redis.client && data.User) {
      await redis.set(cacheKey, JSON.stringify(data.User), { EX: TTL }).catch(() => null);
    }
    return data.User;
  } catch (err) {
    console.error(`AniList User Error [${variables.username}]:`, err.message);
    return null;
  }
}

const USER_QUERY = `
  query ($username: String) {
    User(name: $username) {
      id name about avatar { large }
      statistics {
        anime { count meanScore minutesWatched }
        manga { count chaptersRead volumesRead }
      }
      favourites {
        anime { nodes { id title { romaji english } averageScore coverImage { large } } }
        manga { nodes { id title { romaji english } averageScore coverImage { large } } }
      }
    }
  }`;

module.exports = {
  fetchAniListUser: (username) => request(`anilist:user:${username.toLowerCase()}`, USER_QUERY, { username })
};
