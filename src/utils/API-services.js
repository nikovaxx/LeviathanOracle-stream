/**
* Responsibilities:
*  JIKAN: Assigned for all manga, manga search, manga autocomplete, MAL profile linking & manga notification(Coming Soon) related functions.
*  ANILIST: Assigned for all anime, anime search, anime autocomplete, AL profile linking & anime notification related functions.
*  ANIMESCHEDULE (Requires token): Only assigned for `/upcoming` & `/daily-schedule` commands.
**/

const axios = require('axios');
const redis = require('../schemas/redis');
const config = require('../../config.json');
const tracer = require('./tracer');

const JIKAN = 'https://api.jikan.moe/v4';
const ANILIST = 'https://graphql.anilist.co';
const ANIMESCHEDULE = 'https://animeschedule.net/api/v3';
const SCHEDULE_KEY = config.apitokens.animeschedule1;

const TTL = { search: 1800, details: 21600, schedule: 900, profile: 3600 };

const ANILIST_ANIME_FIELDS = `
  id
  idMal
  title { romaji english native }
  status
  format
  episodes
  duration
  description
  averageScore
  popularity
  favourites
  genres
  coverImage { large }
  bannerImage
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

const ANILIST_USER_FIELDS = `
  id
  name
  about
  avatar { large }
  statistics {
    anime { count meanScore minutesWatched episodesWatched }
    manga { count meanScore chaptersRead volumesRead }
  }
  favourites {
    anime { nodes { id title { romaji english native } averageScore coverImage { large } } }
    manga { nodes { id title { romaji english native } averageScore coverImage { large } } }
  }
`;

async function cached(key, ttl, fetcher) {
  if (redis.client) {
    try {
      const hit = await redis.get(key);
      if (hit) {
        tracer.debug('API: Cache', `HIT ${key}`);
        return JSON.parse(hit);
      }
    } catch (error) {
      tracer.warn('API: Cache', `Redis GET failed for ${key}`, error);
    }
  }

  const data = await fetcher();

  if (redis.client && data != null) {
    redis.set(key, JSON.stringify(data), { EX: ttl }).catch((error) =>
      tracer.warn('API: Cache', `Redis SET failed for ${key}`, error)
    );
  }

  return data;
}

async function jikanGet(path, params = {}) {
  const t = tracer.start('API: Jikan', { path, params });
  try {
    const { data } = await axios.get(`${JIKAN}/${path}`, { params, timeout: 5000 });
    t.end('API: Jikan', 'jikanGet request successful');
    return data.data;
  } catch (error) {
    t.error('API: Jikan', 'jikanGet request failed', error);
    throw error;
  }
}

async function anilistPost(query, variables = {}) {
  const t = tracer.start('API: AniList', { variables });
  try {
    const response = await axios.post(ANILIST, { query, variables }, { timeout: 5000 });
    const payload = response?.data;

    if (payload?.errors?.length) {
      const message = payload.errors.map((err) => err.message).join('; ');
      throw new Error(message || 'AniList GraphQL request failed');
    }

    t.end('API: AniList', 'anilistPost request successful');
    return payload?.data ?? null;
  } catch (error) {
    t.error('API: AniList', 'anilistPost request failed', error);
    throw error;
  }
}

async function animeScheduleRequest(type) {
  const t = tracer.start('API: AnimeSchedule', { type });
  try {
    const { data } = await axios.get(`${ANIMESCHEDULE}/timetables/${type}`, {
      headers: { Authorization: `Bearer ${SCHEDULE_KEY}` },
      timeout: 5000,
    });
    t.end('API: AnimeSchedule', 'animeScheduleRequest request successful');
    return data || [];
  } catch (error) {
    t.error('API: AnimeSchedule', 'animeScheduleRequest request failed', error);
    throw error;
  }
}

const stripHtml = (text) => String(text || '').replace(/<[^>]*>/g, '').trim();

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/&#x([\da-fA-F]+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 16)));
}

async function fetchMalAboutFromProfilePage(username) {
  const t = tracer.start('API: MAL Profile Fallback', { username });
  try {
    const { data: html } = await axios.get(`https://myanimelist.net/profile/${encodeURIComponent(username)}`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    const blockMatch = html.match(/<div class="word-break">([\s\S]*?)<\/td>/i);
    if (!blockMatch) {
      t.end('MAL profile page has no about block');
      return '';
    }

    const withLineBreaks = blockMatch[1].replace(/<br\s*\/?>/gi, '\n');
    const plain = stripHtml(decodeHtmlEntities(withLineBreaks));
    t.end('Fetched MAL profile about from HTML fallback');
    return plain;
  } catch (error) {
    t.error('Failed to fetch MAL profile HTML fallback', error);
    throw error;
  }
}

function mapAniListAnime(media) {
  if (!media) return null;

  const next = media.nextAiringEpisode;
  return {
    anilist_id: media.id,
    mal_id: media.idMal ?? null,
    title: media.title?.english || media.title?.romaji || media.title?.native || null,
    title_english: media.title?.english || null,
    title_romaji: media.title?.romaji || null,
    title_native: media.title?.native || null,
    status: media.status || null,
    format: media.format || null,
    episodes: media.episodes ?? null,
    duration: media.duration ?? null,
    genres: media.genres || [],
    average_score: media.averageScore ?? null,
    popularity: media.popularity ?? null,
    favourites: media.favourites ?? null,
    description: stripHtml(media.description),
    cover_image: media.coverImage?.large || null,
    banner_image: media.bannerImage || null,
    next_airing: next
      ? {
          airing_at: next.airingAt,
          episode: next.episode,
          time_until_airing: next.timeUntilAiring,
          airing_date_iso: new Date(next.airingAt * 1000).toISOString(),
        }
      : null,
    url: `https://anilist.co/anime/${media.id}`,
    source: 'anilist',
  };
}

const safeLower = (value) => String(value || '').toLowerCase();

const searchAnimeByAniList = (query, limit = 10) => cached(
  `svc:anilist:anime:search:${safeLower(query)}:${limit}`,
  TTL.search,
  () => anilistPost(
    `query($search:String,$limit:Int){
      Page(perPage:$limit){
        media(search:$search,type:ANIME){
          ${ANILIST_ANIME_FIELDS}
        }
      }
    }`,
    { search: query, limit }
  ).then((data) => (data?.Page?.media || []).map(mapAniListAnime).filter(Boolean))
);

const getAnimeByAniListId = (anilistId) => cached(
  `svc:anilist:anime:id:${anilistId}`,
  TTL.details,
  () => anilistPost(
    `query($id:Int){
      Media(id:$id,type:ANIME){
        ${ANILIST_ANIME_FIELDS}
      }
    }`,
    { id: Number.parseInt(anilistId, 10) }
  ).then((data) => mapAniListAnime(data?.Media))
);

const getAnimeByMalId = (malId) => cached(
  `svc:anilist:anime:mal:${malId}`,
  TTL.details,
  () => anilistPost(
    `query($idMal:Int){
      Media(idMal:$idMal,type:ANIME){
        ${ANILIST_ANIME_FIELDS}
      }
    }`,
    { idMal: Number.parseInt(malId, 10) }
  ).then((data) => mapAniListAnime(data?.Media))
);

const searchAnimeCatalog = (query, limit = 10) => searchAnimeByAniList(query, limit);
const getAnimeDetailsByMalId = (malId) => getAnimeByMalId(malId);

const getAnimeAiringScheduleByAniListId = (anilistId, perPage = 10) => cached(
  `svc:anilist:anime:airing:${anilistId}:${perPage}`,
  TTL.schedule,
  () => anilistPost(
    `query($id:Int,$perPage:Int){
      Media(id:$id,type:ANIME){
        id
        title { romaji english native }
        nextAiringEpisode { airingAt timeUntilAiring episode }
        airingSchedule(notYetAired:true,perPage:$perPage){
          nodes { airingAt episode }
          pageInfo { total perPage currentPage hasNextPage }
        }
      }
    }`,
    { id: Number.parseInt(anilistId, 10), perPage }
  ).then((data) => {
    const media = data?.Media;
    if (!media) return null;

    return {
      anilist_id: media.id,
      title: media.title?.english || media.title?.romaji || media.title?.native || null,
      next_airing: media.nextAiringEpisode
        ? {
            airing_at: media.nextAiringEpisode.airingAt,
            episode: media.nextAiringEpisode.episode,
            time_until_airing: media.nextAiringEpisode.timeUntilAiring,
          }
        : null,
      upcoming: (media.airingSchedule?.nodes || []).map((node) => ({
        airing_at: node.airingAt,
        episode: node.episode,
        airing_date_iso: new Date(node.airingAt * 1000).toISOString(),
      })),
      page_info: media.airingSchedule?.pageInfo || null,
    };
  })
);

async function getNextAiringByTitles(titles) {
  for (const rawTitle of titles || []) {
    const title = String(rawTitle || '').trim();
    if (!title) continue;

    const cacheKey = `svc:anilist:anime:nextairing:title:${safeLower(title)}`;
    const result = await cached(cacheKey, TTL.schedule, async () => {
      const data = await anilistPost(
        `query($search:String){
          Media(search:$search,type:ANIME,status:RELEASING){
            id
            title { romaji english native }
            nextAiringEpisode { airingAt timeUntilAiring episode }
          }
        }`,
        { search: title }
      );

      const media = data?.Media;
      const next = media?.nextAiringEpisode;
      if (!media || !next) return null;

      return {
        anilistId: media.id,
        title: media.title?.english || media.title?.romaji || media.title?.native || title,
        episodeDate: new Date(next.airingAt * 1000).toISOString(),
        episodeNumber: next.episode,
        timeUntilAiring: next.timeUntilAiring,
      };
    }).catch(() => null);

    if (result) return result;
  }

  return null;
}

const searchMangaCatalog = (query, limit = 10) => cached(
  `svc:jikan:manga:search:${safeLower(query)}:${limit}`,
  TTL.search,
  () => jikanGet('manga', { q: query, limit })
);

const getMangaDetailsByMalId = (malId) => cached(
  `svc:jikan:manga:details:${malId}`,
  TTL.details,
  () => jikanGet(`manga/${malId}/full`)
);

const getMalUserProfile = (username, options = {}) => {
  const key = `svc:jikan:user:full:${safeLower(username)}`;
  const fetcher = () => jikanGet(`users/${username}/full`);
  return options.fresh ? fetcher() : cached(key, TTL.profile, fetcher);
};

const getMalUserStats = (username, options = {}) => {
  const key = `svc:jikan:user:stats:${safeLower(username)}`;
  const fetcher = async () => {
    const profile = await getMalUserProfile(username, options);
    return profile?.statistics || null;
  };
  return options.fresh ? fetcher() : cached(key, TTL.profile, fetcher);
};

const getMalUserFavorites = (username, options = {}) => {
  const key = `svc:jikan:user:favorites:${safeLower(username)}`;
  const fetcher = async () => {
    const profile = await getMalUserProfile(username, options);
    return profile?.favorites || null;
  };
  return options.fresh ? fetcher() : cached(key, TTL.profile, fetcher);
};

const getAniListUserProfile = (username, options = {}) => {
  const key = `svc:anilist:user:${safeLower(username)}`;
  const fetcher = () => anilistPost(
    `query($name:String){
      User(name:$name){
        ${ANILIST_USER_FIELDS}
      }
    }`,
    { name: username }
  ).then((data) => data?.User || null);

  return options.fresh ? fetcher() : cached(key, TTL.profile, fetcher);
};

const malVerification = async (username) => {
  const profile = await jikanGet(`users/${username}/full`);
  const about = String(profile?.about || '').trim();
  if (about) return about;

  tracer.warn('API: Jikan', 'MAL about is null/empty from Jikan full endpoint; using profile HTML fallback', { username });
  return fetchMalAboutFromProfilePage(username);
};

const anilistVerification = async (username) => {
  const data = await anilistPost(
    `query($name:String){
      User(name:$name){
        about
      }
    }`,
    { name: username }
  );

  return String(data?.User?.about || '');
};

const getScheduleByType = (type = 'all') => cached(
  `svc:animeschedule:timetable:${type}`,
  TTL.schedule,
  () => animeScheduleRequest(type).catch((error) => {
    tracer.warn('API: AnimeSchedule', `Failed to fetch timetable: ${type}`, error);
    return [];
  })
);

async function getDailyScheduleByDay(day, airType = 'all') {
  const list = await getScheduleByType(airType);
  const targetDay = safeLower(day);

  return (list || []).filter((entry) => {
    const weekday = new Date(entry.episodeDate)
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    return weekday === targetDay;
  });
}

module.exports = {
  searchAnimeCatalog,
  getAnimeDetailsByMalId,
  searchAnimeByAniList,
  getAnimeByAniListId,
  getAnimeByMalId,
  getAnimeAiringScheduleByAniListId,
  getNextAiringByTitles,
  searchMangaCatalog,
  getMangaDetailsByMalId,
  getMalUserProfile,
  getMalUserStats,
  getMalUserFavorites,
  malVerification,
  getAniListUserProfile,
  anilistVerification,
  getScheduleByType,
  getDailyScheduleByDay,
};
