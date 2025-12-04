import axios from 'axios';
import { getCachedAnimeData, cacheAnimeData, getCachedSearchResults, cacheSearchResults } from '../database/dbmanager.js';
import { errorHandler } from './errorHandler.js';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// Fetch anime details with caching
export async function fetchAnimeDetails(search) {
  try {
    // Check cache first
    const cached = await getCachedSearchResults(search);
    if (cached) return cached;

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
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const results = response.data.data.Page.media;

    // Cache results for 30 minutes
    await cacheSearchResults(search, results, 1800);

    return results;
  } catch (error) {
    errorHandler(error, `AniList Fetch Anime Details: ${search}`);
    throw error;
  }
}

// Fetch anime details by ID with caching
export async function fetchAnimeDetailsById(id) {
  try {
    // Check cache first
    const cached = await getCachedAnimeData(id);
    if (cached) return cached;

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
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const result = response.data.data.Media;

    // Cache for 1 hour
    await cacheAnimeData(id, result, 3600);

    return result;
  } catch (error) {
    errorHandler(error, `AniList Fetch Anime By ID: ${id}`);
    throw error;
  }
}
