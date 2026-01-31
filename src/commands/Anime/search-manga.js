const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const redis = require('../../schemas/redis');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Fetch manga details from Jikan API')
    .addStringOption(option =>
      option.setName('manga')
        .setDescription('Manga name')
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction) {
    const query = interaction.options.getString('manga');
    if (!query) {
      return interaction.reply({ content: 'Please provide a manga name.', ephemeral: true });
    }

    if (/^\s*\d+\s*$/.test(query)) {
      const malId = query.trim();
      await interaction.deferReply();
      
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

      return interaction.editReply({ embeds: [embed] });
    }

    await interaction.deferReply();
    const response = await axios.get('https://api.jikan.moe/v4/manga', {
      params: { q: query, limit: 10 },
      timeout: 5000
    });

    const mangaList = response.data.data;
    if (!mangaList || mangaList.length === 0) {
      return interaction.editReply('No results found.');
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

    const cacheKey = `autocomplete:manga:${value.toLowerCase()}`;
    
    if (redis.client) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return interaction.respond(JSON.parse(cached));
      }
    }

    const response = await axios.get('https://api.jikan.moe/v4/manga', {
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
