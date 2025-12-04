import axios from 'axios';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { errorHandler } from './errorHandler.js';
import { getCachedSearchResults, cacheSearchResults } from '../database/dbmanager.js';

const BASE_URL = 'https://animeschedule.net/api/v3';
const API_KEY = process.env.ANIMESCHEDULE_TOKEN;

export async function fetchDailySchedule(day, airType = 'all') {
  try {
    const cacheKey = `schedule:${day}:${airType}`;
    
    // Check cache first (5 minute TTL)
    const cached = await getCachedSearchResults(cacheKey);
    if (cached) return cached;

    const response = await axios.get(`${BASE_URL}/timetables/${airType}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Cache-Control': 'no-cache'
      }
    });

    if (response.data && response.data.length > 0) {
      const dayOfWeek = day.toLowerCase();
      const filteredData = response.data.filter(anime => {
        try {
          const date = new Date(anime.episodeDate);
          const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          return weekday === dayOfWeek;
        } catch (err) {
          return false;
        }
      });

      // Cache for 5 minutes
      await cacheSearchResults(cacheKey, filteredData, 300);
      return filteredData;
    }

    return [];
  } catch (error) {
    errorHandler(error, `Anime Schedule Fetch: ${day}`);
    return [];
  }
}

export function createAnimeEmbed(animeList, page = 1) {
  const embed = new EmbedBuilder()
    .setTitle('Upcoming Anime Episodes')
    .setColor('#0099ff')
    .setFooter({ text: `Page ${page}` });

  const start = (page - 1) * 10;
  const end = start + 10;
  const pageData = animeList.slice(start, end);

  pageData.forEach(anime => {
    embed.addFields({ 
      name: `${anime.english || anime.title || 'UNKNOWN TITLE'}`, 
      value: `**Episode ${anime.episodeNumber || 'TBA'}** - Airs on ${new Date(anime.episodeDate).toLocaleString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      })}`
    });
  });

  return embed;
}

export function createPaginationButtons(currentPage, totalPages) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );
}
