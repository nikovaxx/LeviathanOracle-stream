import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { checkRateLimit } from '../database/dbmanager.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Search for manga details')
    .addStringOption(option =>
      option.setName('manga')
        .setDescription('Manga name')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value;
      
      if (!value || value.length === 0) {
        return await interaction.respond([]);
      }

      // Rate limit check
      const allowed = await checkRateLimit(interaction.user.id, 'autocomplete', 20, 10);
      if (!allowed) {
        return await interaction.respond([]);
      }

      const resp = await axios.get('https://api.jikan.moe/v4/manga', { 
        params: { q: value, limit: 25 }, 
        timeout: 2500 
      });
      
      const list = resp.data.data || [];
      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      
      const suggestions = list.slice(0, 25).map(a => {
        const titleEnglish = a.title_english || a.title || `#${a.mal_id}`;
        const rawName = `${titleEnglish}${a.year ? ` (${a.year})` : ''}`.trim();
        const name = truncate(rawName, 100);
        return { name: name || `#${a.mal_id}`, value: String(a.mal_id) };
      });

      if (suggestions.length === 0) {
        return await interaction.respond([]);
      }

      await interaction.respond(suggestions);
    } catch (err) {
      errorHandler(err, 'search-manga: autocomplete');
      try { await interaction.respond([]); } catch (e) {}
    }
  },

  async execute(interaction) {
    try {
      const query = interaction.options.getString('manga');
      
      if (!query) {
        return await interaction.reply({ 
          content: 'Please provide a manga name.', 
          ephemeral: true 
        });
      }

      await interaction.deferReply();

      // Rate limit check
      const allowed = await checkRateLimit(interaction.user.id, 'search', 10, 60);
      if (!allowed) {
        return interaction.editReply({ 
          content: 'You are searching too quickly. Please wait a moment.', 
          ephemeral: true 
        });
      }

      // If numeric ID (from autocomplete), fetch directly
      if (/^\s*\d+\s*$/.test(query)) {
        const malId = query.trim();
        
        const fullResp = await axios.get(`https://api.jikan.moe/v4/manga/${malId}/full`, { 
          timeout: 5000 
        });
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

        return await interaction.editReply({ embeds: [embed] });
      }

      // Non-numeric search: show compact list
      const response = await axios.get('https://api.jikan.moe/v4/manga', {
        params: { q: query, limit: 10 },
        timeout: 5000
      });

      const mangaList = response.data.data;
      
      if (!mangaList || mangaList.length === 0) {
        return await interaction.editReply('No results found.');
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
        embed.addFields({ 
          name: `${i + 1}. ${truncate(name, 80)}`, 
          value: `${synopsis}\n${a.url}` 
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      errorHandler(error, 'search-manga: execute');
      try {
        await interaction.editReply({ 
          content: 'Failed to fetch manga details.', 
          components: [] 
        });
      } catch (e) {
        try {
          await interaction.reply({ 
            content: 'Failed to fetch manga details.', 
            ephemeral: true 
          });
        } catch (e2) {}
      }
    }
  },
};
