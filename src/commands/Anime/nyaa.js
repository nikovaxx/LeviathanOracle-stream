const { SlashCommandBuilder } = require('discord.js');
const { fetchRSSFeedWithRetries, filterEnglishAnimeItems } = require('../../utils/nyaaRSS');
const { embed } = require('../../functions/ui');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('nyaa')
    .setDescription('Search for English-translated anime on Nyaa')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search term (e.g. anime title)')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const query = interaction.options.getString('query');
      const url = `https://nyaa.si/?page=rss&f=0&c=0_0&q=${encodeURIComponent(query)}`;

      const feed = await fetchRSSFeedWithRetries(url);
      const englishAnimeItems = filterEnglishAnimeItems(feed.items);

      if (englishAnimeItems.length === 0) {
        return interaction.editReply(`No results found for "${query}".`);
      }

      const fields = englishAnimeItems.slice(0, 10).map((item, i) => ({
        name: `${i + 1}. ${item.title}`,
        value: item.link
      }));

      await interaction.editReply({ embeds: [embed({ title: `Search Results for "${query}"`, fields, color: 0x0099ff })] });
    } catch (error) {
      console.error('Error in nyaa command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  },
};
