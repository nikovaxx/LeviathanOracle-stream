import { SlashCommandBuilder } from 'discord.js';
import { linkProfile } from '../database/dbmanager.js';
import { successEmbed, errorEmbed } from '../utils/embeds/commandembeds.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('linkprofile')
    .setDescription('Link your MAL or AniList account')
    .addSubcommand(subcommand =>
      subcommand
        .setName('mal')
        .setDescription('Link your MyAnimeList account')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your MyAnimeList username')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('anilist')
        .setDescription('Link your AniList account')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your AniList username')
            .setRequired(true))),

  async execute(interaction) {
    try {
      const discordId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();
      const username = interaction.options.getString('username');

      await interaction.deferReply();

      const result = await linkProfile(discordId, subcommand, username);

      if (!result.success) {
        if (result.error === 'username_taken') {
          return interaction.editReply({ 
            embeds: [errorEmbed(
              'Username Already Linked', 
              `That username is already linked to <@${result.existingUser}>.`
            )], 
            ephemeral: true 
          });
        }
        return interaction.editReply({ 
          embeds: [errorEmbed('Error', 'There was an error linking your account.')], 
          ephemeral: true 
        });
      }

      const platform = subcommand === 'mal' ? 'MyAnimeList' : 'AniList';
      interaction.editReply({ 
        embeds: [successEmbed('Account Linked', `${platform} account linked: **${username}**`)] 
      });
    } catch (error) {
      errorHandler(error, 'linkprofile: execute');
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'There was an error linking your account.')], 
        ephemeral: true 
      }).catch(() => {});
    }
  },
};
