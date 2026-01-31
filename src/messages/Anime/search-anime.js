const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../../../config.json');

const API_KEY = config.animeScheduleToken || process.env.ANIMESCHEDULE_TOKEN;
const BASE_URL = 'https://animeschedule.net/api/v3';

module.exports = {
  disabled: false,
  name: 'search-anime',
  description: 'Fetch anime details from Jikan API',
  aliases: ['anime', 'searchanime'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const query = args.join(' ');

    if (!query) {
      return message.reply('Please provide an anime name. Usage: `!search-anime <title>`');
    }

    if (/^\s*\d+\s*$/.test(query)) {
      const malId = query.trim();
      const fullResp = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/full`, { timeout: 5000 });
      const anime = fullResp.data.data;
      
      let cleanSynopsis = anime.synopsis ? anime.synopsis.replace(/<[^>]*>/g, '') : 'No description available.';
      if (cleanSynopsis.length > 1000) cleanSynopsis = cleanSynopsis.substring(0, 1000) + '...';
      
      let status = anime.status || 'Unknown';
      let nextEpisode = '';
      
      if (status.toLowerCase() === 'currently airing') {
        try {
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
          }
        } catch (err) {
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

      return message.reply({ embeds: [embed] });
    }

    const jikanResponse = await axios.get('https://api.jikan.moe/v4/anime', {
      params: { q: query, limit: 10 },
      timeout: 5000
    });
    
    const animeList = jikanResponse.data.data;
    if (!animeList || animeList.length === 0) {
      return message.reply('No results found.');
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
      embed.addFields({ name: `${i + 1}. ${truncate(name, 80)}`, value: `MAL ID: ${a.mal_id}\n${synopsis}\n${a.url}` });
    }

    message.reply({ embeds: [embed] });
  },
};
