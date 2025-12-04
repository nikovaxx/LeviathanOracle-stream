import { SlashCommandBuilder } from 'discord.js';
import { fetchEnglishAnimeFromNyaa } from '../utils/nyaaRSS.js';
import { checkRateLimit } from '../database/dbmanager.js';
import { infoEmbed, errorEmbed, warningEmbed } from '../utils/embeds/commandembeds.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nyaa')
    .setDescription('Search for English-translated anime on Nyaa')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search term (e.g. anime title)')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const query = interaction.options.getString('query');

      // Rate limit check
      const allowed = await checkRateLimit(interaction.user.id, 'search', 10, 60);
      if (!allowed) {
        return interaction.editReply({ 
          embeds: [warningEmbed('Rate Limit', 'You are searching too quickly. Please wait a moment.')], 
          ephemeral: true 
        });
      }

      const englishAnimeItems = await fetchEnglishAnimeFromNyaa(query);

      if (!englishAnimeItems || englishAnimeItems.length === 0) {
        return interaction.editReply({ 
          embeds: [warningEmbed('No Results', `No results found for "${query}".`)] 
        });
      }

      const embed = infoEmbed(`Search Results for "${query}"`, null);
      embed.addFields(
        englishAnimeItems.slice(0, 10).map((item, index) => ({
          name: `${index + 1}. ${item.title.substring(0, 250)}`,
          value: item.link
        }))
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      errorHandler(error, 'nyaa: execute');
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'An error occurred while fetching data from Nyaa.')] 
      }).catch(() => {});
    }
  },
};
