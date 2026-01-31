const axios = require('axios');
const redis = require('../schemas/redis');

const ANILIST_API = 'https://graphql.anilist.co';

async function fetchAniListUser(username) {
  const cacheKey = `anilist:user:${username.toLowerCase()}`;
  
  if (redis.client) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis get error:', error.message);
    }
  }
  
  const query = `
    query ($username: String) {
      User(name: $username) {
        id
        name
        about
        avatar {
          large
        }
        statistics {
          anime {
            count
            meanScore
            minutesWatched
          }
          manga {
            count
            chaptersRead
            volumesRead
          }
        }
        favourites {
          anime {
            nodes {
              id
              title {
                romaji
                english
              }
              averageScore
              coverImage {
                large
              }
            }
          }
          manga {
            nodes {
              id
              title {
                romaji
                english
              }
              averageScore
              coverImage {
                large
              }
            }
          }
        }
      }
    }
  `;

  const variables = { username };

  try {
    const response = await axios.post(ANILIST_API, { query, variables });
    const userData = response.data.data.User;
    
    if (redis.client && userData) {
      try {
        await redis.set(cacheKey, JSON.stringify(userData), { EX: 900 });
      } catch (error) {
        console.error('Redis set error:', error.message);
      }
    }
    
    return userData;
  } catch (error) {
    console.error('AniList API Error:', error.message);
    return null;
  }
}

module.exports = {
  fetchAniListUser,
};
