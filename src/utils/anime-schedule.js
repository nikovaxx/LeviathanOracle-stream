const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const redis = require('../schemas/redis');
const config = require('../../config.json');

const BASE_URL = 'https://animeschedule.net/api/v3';
const API_KEY = config.animeScheduleToken || process.env.ANIMESCHEDULE_TOKEN;

async function fetchDailySchedule(day, airType = 'all') {
  const cacheKey = `schedule:${day}:${airType}`;
  
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
  
  try {
    const response = await axios.get(`${BASE_URL}/timetables/${airType}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      timeout: 5000,
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

      if (redis.client && filteredData.length > 0) {
        try {
          await redis.set(cacheKey, JSON.stringify(filteredData), { EX: 300 });
        } catch (error) {
          console.error('Redis set error:', error.message);
        }
      }

      return filteredData;
    }
    return [];
  } catch (error) {
    console.error('Error fetching daily schedule:', error.message);
    return [];
  }
}

function createAnimeEmbed(animeList, page = 1) {
  const embed = new EmbedBuilder()
    .setTitle('Upcoming Anime Episodes')
    .setColor(0x0099ff)
    .setFooter({ text: `Page ${page}` });

  const start = (page - 1) * 10;
  const end = start + 10;
  const pageData = animeList.slice(start, end);

  pageData.forEach(anime => {
    const episodeDate = new Date(anime.episodeDate);
    const formattedDate = episodeDate.toLocaleString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: true 
    });

    embed.addFields({ 
      name: anime.english || anime.title || 'Unknown Title', 
      value: `**Episode ${anime.episodeNumber || 'TBA'}** - ${formattedDate}`
    });
  });

  return embed;
}

function createPaginationButtons(currentPage, totalPages) {
  const row = new ActionRowBuilder().addComponents(
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

  return row;
}

module.exports = {
  fetchDailySchedule,
  createAnimeEmbed,
  createPaginationButtons,
};
