const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const redis = require('../../schemas/redis');
const config = require('../../../config.json');

const API_KEY = config.animeScheduleToken || process.env.ANIMESCHEDULE_TOKEN;
const BASE_URL = 'https://animeschedule.net/api/v3';

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from Jikan API')
    .addStringOption(option =>
      option.setName('anime')
        .setDescription('Anime name')
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction) {
    const query = interaction.options.getString('anime');
    if (!query) {
      return interaction.reply({ content: 'Please provide an anime name.', ephemeral: true });
    }

    if (/^\s*\d+\s*$/.test(query)) {
      const malId = query.trim();
      await interaction.deferReply();
      
      const fullResp = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/full`, { timeout: 5000 });
      const anime = fullResp.data.data;
      
      let cleanSynopsis = anime.synopsis ? anime.synopsis.replace(/<[^>]*>/g, '') : 'No description available.';
      if (cleanSynopsis.length > 1000) cleanSynopsis = cleanSynopsis.substring(0, 1000) + '...';
      
      let status = anime.status || 'Unknown';
      let nextEpisode = '';
      
      if (status.toLowerCase() === 'currently airing') {
        const timetableResponse = await axios.get(`${BASE_URL}/timetables/sub`, {
          headers: { 'Authorization': `Bearer ${API_KEY}` },
          timeout: 3000
        });
        
        const scheduleData = timetableResponse.data;
        if (scheduleData && scheduleData.length > 0) {
          const scheduledAnime = scheduleData.find(a => a.title.toLowerCase() === (anime.title || '').toLowerCase());
          if (scheduledAnime) {
            const episodeDate = new Date(scheduledAnime.episodeDate);
            const formattedDate = `${episodeDate.getMonth() + 1}/${episodeDate.getDate()}/${episodeDate.getFullYear()}, ${episodeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
            nextEpisode = `**Episode ${scheduledAnime.episodeNumber || 'TBA'}** - ${formattedDate}`;
          } else {
            nextEpisode = '**Next Episode:** To be aired.';
          }
        } else {
          nextEpisode = '**Next Episode:** To be aired.';
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(anime.title || anime.title_english || anime.title_japanese || `#${anime.mal_id}`)
        .setURL(anime.url)
        .setDescription(
          `**Score:** ${anime.score || 'N/A'}\n` +
          `**Episodes:** ${anime.episodes || 'N/A'}\n` +
          `**Status:** ${status}\n` +
          (nextEpisode ? `${nextEpisode}\n\n` : '\n') +
          `**Synopsis:** ${cleanSynopsis}`
        )
        .setImage(anime.images?.jpg?.image_url || null)
        .setColor(0x00AE86);

      return interaction.editReply({ embeds: [embed] });
    }

    await interaction.deferReply();
    const jikanResponse = await axios.get('https://api.jikan.moe/v4/anime', {
      params: { q: query, limit: 10 },
      timeout: 5000
    });
    
    const animeList = jikanResponse.data.data;
    if (!animeList || animeList.length === 0) {
      return interaction.editReply('No results found.');
    }

    const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
    const embed = new EmbedBuilder()
      .setTitle(`Search results for "${truncate(query, 80)}"`)
      .setColor(0x00AE86)
      .setTimestamp();

    for (let i = 0; i < Math.min(10, animeList.length); i++) {
      const a = animeList[i];
      const name = a.title || a.title_english || `#${a.mal_id}`;
      const synopsis = truncate((a.synopsis || '').replace(/<[^>]*>/g, ''), 200) || 'No synopsis available.';
      embed.addFields({ name: `${i + 1}. ${truncate(name, 80)}`, value: `${synopsis}\n${a.url}` });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const value = focused.value;
    
    if (!value || value.length === 0) {
      return interaction.respond([]);
    }

    if (/^\d+$/.test(value)) {
      return interaction.respond([{ name: `Search MAL ID ${value}`, value }]);
    }

    const cacheKey = `autocomplete:anime:${value.toLowerCase()}`;
    
    if (redis.client) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return interaction.respond(JSON.parse(cached));
      }
    }

    const response = await axios.get('https://api.jikan.moe/v4/anime', {
      params: { q: value, limit: 25 },
      timeout: 3000
    });

    const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
    const suggestions = response.data.data.slice(0, 25).map(a => ({
      name: truncate(a.title || a.title_english || `#${a.mal_id}`, 100),
      value: String(a.mal_id)
    }));

    if (redis.client && suggestions.length > 0) {
      await redis.set(cacheKey, JSON.stringify(suggestions), { EX: 1800 });
    }

    await interaction.respond(suggestions);
  },
};
