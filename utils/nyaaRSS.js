import Parser from 'rss-parser';
import { errorHandler } from './errorHandler.js';
import { getCachedSearchResults, cacheSearchResults } from '../database/dbmanager.js';

const parser = new Parser();
const NYAA_RSS_FEED_URL = 'https://nyaa.si/?page=rss';

// Filter English-translated anime items
export function filterEnglishAnimeItems(items) {
  try {
    const englishKeywords = ['eng', 'english', 'sub', 'dub', 'subtitled'];
    return items.filter(item => {
      try {
        const title = item.title.toLowerCase();
        return englishKeywords.some(keyword => title.includes(keyword));
      } catch (err) {
        return false;
      }
    });
  } catch (err) {
    errorHandler(err, 'Nyaa Filter English Items');
    return [];
  }
}

// Fetch RSS feed with retries
async function fetchRSSFeedWithRetries(url, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const feed = await parser.parseURL(url);
      return feed;
    } catch (error) {
      if (i === retries - 1) {
        errorHandler(error, 'Nyaa RSS Fetch Failed');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch and process RSS feed with caching (supports custom query)
export async function fetchEnglishAnimeFromNyaa(query = null) {
  try {
    const url = query 
      ? `https://nyaa.si/?page=rss&f=0&c=0_0&q=${encodeURIComponent(query)}`
      : NYAA_RSS_FEED_URL;
    
    const cacheKey = query ? `nyaa:search:${query}` : 'nyaa:english_anime';
    
    // Check cache first (10 minute TTL)
    const cached = await getCachedSearchResults(cacheKey);
    if (cached) return cached;

    const feed = await fetchRSSFeedWithRetries(url);
    const englishAnimeItems = filterEnglishAnimeItems(feed.items);

    // Cache for 10 minutes
    await cacheSearchResults(cacheKey, englishAnimeItems, 600);

    return englishAnimeItems;
  } catch (error) {
    errorHandler(error, 'Nyaa Fetch English Anime');
    throw error;
  }
}
