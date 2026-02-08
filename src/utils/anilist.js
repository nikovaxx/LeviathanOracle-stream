const axios = require('axios');
const redis = require('../schemas/redis');

const API_URL = 'https://graphql.anilist.co';
const TTL = 3600;

/**
 * Shared requester to handle Cache and API calls
 */
async function request(cacheKey, query, variables) {
  if (redis.client) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);
  }

  try {
    const { data: { data } } = await axios.post(API_URL, { query, variables });
    const result = data.Media || data.Page.media;

    if (redis.client && result) {
      await redis.set(cacheKey, JSON.stringify(result), { EX: TTL }).catch(() => null);
    }
    return result;
  } catch (err) {
    console.error(`AniList Error [${cacheKey}]:`, err.response?.data || err.message);
    return null;
  }
}

const MEDIA_FIELDS = `
  id idMal title { romaji english native } status
  nextAiringEpisode { airingAt timeUntilAiring episode }
  coverImage { large }`;

module.exports = {
  fetchAnimeDetails: (search) => request(
    `anime:search:${search.toLowerCase()}`,
    `query ($search: String) { Page(perPage: 10) { media(search: $search, type: ANIME) { ${MEDIA_FIELDS} } } }`,
    { search }
  ),

  fetchAnimeDetailsById: (id) => request(
    `anime:id:${id}`,
    `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`,
    { id }
  ),

  fetchAnimeByMalId: (malId) => request(
    `anime:mal:${malId}`,
    `query ($malId: Int) { Media(idMal: $malId, type: ANIME) { ${MEDIA_FIELDS} } }`,
    { malId }
  )
};
