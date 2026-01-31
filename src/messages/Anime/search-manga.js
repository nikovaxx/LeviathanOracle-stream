const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  disabled: false,
  name: 'search-manga',
  description: 'Fetch manga details from Jikan API',
  aliases: ['manga', 'searchmanga'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const query = args.join(' ');

    if (!query) {
      return message.reply('Please provide a manga name. Usage: `!search-manga <title>`');
    }

    if (/^\s*\d+\s*$/.test(query)) {
      const malId = query.trim();
      const fullResp = await axios.get(`https://api.jikan.moe/v4/manga/${malId}/full`, { timeout: 5000 });
      const manga = fullResp.data.data;
      
      let cleanSynopsis = manga.synopsis ? manga.synopsis.replace(/<[^>]*>/g, '') : 'No description available.';
      if (cleanSynopsis.length > 1000) cleanSynopsis = cleanSynopsis.substring(0, 1000) + '...';

      const embed = new EmbedBuilder()
        .setTitle(manga.title || `#${manga.mal_id}`)
        .setURL(manga.url)
        .setDescription(
          `**Score:** ${manga.score || 'N/A'}\n` +
          `**Volumes:** ${manga.volumes || 'N/A'}\n` +
          `**Status:** ${manga.status || 'N/A'}\n\n` +
          `**Synopsis:** ${cleanSynopsis}`
        )
        .setColor(0x00AE86);
        
      if (manga.images?.jpg?.image_url) embed.setImage(manga.images.jpg.image_url);

      return message.reply({ embeds: [embed] });
    }

    const response = await axios.get('https://api.jikan.moe/v4/manga', {
      params: { q: query, limit: 10 },
      timeout: 5000
    });

    const mangaList = response.data.data;
    if (!mangaList || mangaList.length === 0) {
      return message.reply('No results found.');
    }

    const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
    const embed = new EmbedBuilder()
      .setTitle(`Search results for "${truncate(query, 80)}"`)
      .setColor(0x00AE86)
      .setTimestamp();

    for (let i = 0; i < Math.min(10, mangaList.length); i++) {
      const a = mangaList[i];
      const name = a.title || a.title_english || `#${a.mal_id}`;
      const synopsis = truncate((a.synopsis || '').replace(/<[^>]*>/g, ''), 200) || 'No synopsis available.';
      embed.addFields({ name: `${i + 1}. ${truncate(name, 80)}`, value: `MAL ID: ${a.mal_id}\n${synopsis}\n${a.url}` });
    }

    message.reply({ embeds: [embed] });
  },
};
