const axios = require('axios');
const redis = require('../schemas/redis');

const ANILIST_API_URL = 'https://graphql.anilist.co';
const CACHE_TTL = 3600; // 1 hour cache for anime details

/**
 * Fetch anime details by search query
 */
async function fetchAnimeDetails(search) {
  const cacheKey = `anime:search:${search.toLowerCase()}`;
  
  // Check cache first
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
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          status
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          coverImage {
            large
          }
        }
      }
    }
  `;

  const variables = { search };

  try {
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const results = response.data.data.Page.media;
    
    // Cache results
    if (redis.client && results) {
      try {
        await redis.set(cacheKey, JSON.stringify(results), { EX: CACHE_TTL });
      } catch (error) {
        console.error('Redis set error:', error.message);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching anime details:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch anime details by ID
 */
async function fetchAnimeDetailsById(id) {
  const cacheKey = `anime:id:${id}`;
  
  // Check cache first
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
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        status
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
        coverImage {
          large
        }
      }
    }
  `;

  const variables = { id };

  try {
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const result = response.data.data.Media;
    
    // Cache result
    if (redis.client && result) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { EX: CACHE_TTL });
      } catch (error) {
        console.error('Redis set error:', error.message);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching anime details by ID:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  fetchAnimeDetails,
  fetchAnimeDetailsById,
};
