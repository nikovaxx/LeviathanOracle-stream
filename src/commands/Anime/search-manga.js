const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { embed } = require('../../functions/ui');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Fetch manga details from MyAnimeList/Jikan')
    .addStringOption(o => o.setName('manga').setDescription('Manga name').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    try {
      const query = interaction.options.getString('manga');
      await interaction.deferReply();
      const isId = /^\d+$/.test(query);

      if (isId) {
        // 1. Detail View (Selected via Autocomplete ID or manual ID)
        const { data: { data: manga } } = await axios.get(`https://api.jikan.moe/v4/manga/${query}/full`);

        return interaction.editReply({
          embeds: [embed({
            title: manga.title || manga.title_english,
            desc: `**Score:** ${manga.score || 'N/A'} | **Volumes:** ${manga.volumes || 'N/A'}\n**Status:** ${manga.status || 'N/A'}\n\n**Synopsis:** ${manga.synopsis?.replace(/<[^>]*>/g, '').slice(0, 800) || 'No description available.'}...`,
            image: manga.images?.jpg?.large_image_url,
            color: '#00AE86'
          })]
        });
      }

      // 2. Search List (Manual text query)
      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/manga', { params: { q: query, limit: 10 } });
      if (!list?.length) return interaction.editReply('No results found.');

      const fields = list.map((m, i) => ({
        name: `${i + 1}. ${m.title}`,
        value: `ID: \`${m.mal_id}\` | [MyAnimeList](${m.url})`
      }));

      return interaction.editReply({
        embeds: [embed({ title: `Search results for "${query.slice(0, 50)}"`, fields, color: '#00AE86' })]
      });
    } catch (error) {
      console.error('Error in search-manga command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused();
    if (!value) return interaction.respond([]);

    try {
      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/manga', { params: { q: value, limit: 25 }, timeout: 2500 });
      const suggestions = list.slice(0, 25).map(m => ({
        name: `${m.title_english || m.title}${m.published?.prop?.from?.year ? ` (${m.published.prop.from.year})` : ''}`.slice(0, 100),
        value: String(m.mal_id)
      }));
      await interaction.respond(suggestions);
    } catch {
      await interaction.respond([]);
    }
  }
};
