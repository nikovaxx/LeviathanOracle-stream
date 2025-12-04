import axios from 'axios';
import { errorHandler } from './errorHandler.js';
import { getCachedAnimeData, cacheAnimeData } from '../database/dbmanager.js';

const ANILIST_API_URL = 'https://graphql.anilist.co';

export async function fetchAniListUser(username) {
  try {
    const cacheKey = `anilist_user:${username}`;
    
    // Check cache first (15 minute TTL)
    const cached = await getCachedAnimeData(cacheKey);
    if (cached) return cached;

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
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const userData = response.data.data.User;

    // Cache for 15 minutes
    await cacheAnimeData(cacheKey, userData, 900);

    return userData;
  } catch (error) {
    errorHandler(error, `AniList User Fetch: ${username}`);
    return null;
  }
}

export async function fetchMangaDetails(mangaTitle) {
  try {
    const cacheKey = `manga:${mangaTitle}`;
    
    // Check cache first
    const cached = await getCachedAnimeData(cacheKey);
    if (cached) return cached;

    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
          }
          chapters
        }
      }
    `;

    const variables = { search: mangaTitle };
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    const mangaData = response.data.data.Media;

    // Cache for 1 hour
    await cacheAnimeData(cacheKey, mangaData, 3600);

    return mangaData;
  } catch (error) {
    errorHandler(error, `AniList Manga Fetch: ${mangaTitle}`);
    return null;
  }
}
