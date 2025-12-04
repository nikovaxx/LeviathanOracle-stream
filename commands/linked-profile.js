import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';
import { getLinkedProfile, getCachedSearchResults, cacheSearchResults } from '../database/dbmanager.js';
import { malProfileEmbed, profileEmbed, warningEmbed, errorEmbed } from '../utils/embeds/commandembeds.js';
import { fetchAniListUser } from '../utils/querry.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('linkedprofile')
    .setDescription('View your linked profile(s)'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const profile = await getLinkedProfile(interaction.user.id);

      if (!profile || (!profile.mal_username && !profile.anilist_username)) {
        return interaction.editReply({ 
          embeds: [warningEmbed(
            'No Linked Profiles', 
            'You have no linked profiles. Use `/linkprofile` to link your MAL or AniList account.'
          )] 
        });
      }

      const malUsername = profile.mal_username;
      const anilistUsername = profile.anilist_username;

      // Helper function to fetch and display MAL profile
      const sendMalProfile = async (updateFn) => {
        try {
          const cacheKey = `mal:profile:${malUsername}`;
          let userData, animeStats, mangaStats;
          
          const cached = await getCachedSearchResults(cacheKey);
          if (cached) {
            ({ userData, animeStats, mangaStats } = cached);
          } else {
            const userResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}`);
            userData = userResponse.data.data;
            
            const statsResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}/statistics`);
            animeStats = statsResponse.data.data.anime || {};
            mangaStats = statsResponse.data.data.manga || {};

            await cacheSearchResults(cacheKey, { userData, animeStats, mangaStats }, 900);
          }

          const embed = malProfileEmbed(userData, animeStats, mangaStats);
          await updateFn({ embeds: [embed], content: undefined, components: [] });
        } catch (error) {
          errorHandler(error, 'linkedprofile: sendMalProfile');
          await updateFn({ 
            embeds: [errorEmbed('Error', 'Failed to fetch MyAnimeList profile.')], 
            components: [] 
          });
        }
      };

      // Helper function to fetch and display AniList profile
      const sendAniListProfile = async (updateFn) => {
        try {
          const userData = await fetchAniListUser(anilistUsername);
          const embed = profileEmbed(userData);
          await updateFn({ embeds: [embed], content: undefined, components: [] });
        } catch (error) {
          errorHandler(error, 'linkedprofile: sendAniListProfile');
          await updateFn({ 
            embeds: [errorEmbed('Error', 'Failed to fetch AniList profile.')], 
            components: [] 
          });
        }
      };

      // If only one profile is linked
      if (malUsername && !anilistUsername) {
        await interaction.editReply({ content: 'Fetching your MyAnimeList profile...' });
        await sendMalProfile(interaction.editReply.bind(interaction));
      } else if (anilistUsername && !malUsername) {
        await interaction.editReply({ content: 'Fetching your AniList profile...' });
        await sendAniListProfile(interaction.editReply.bind(interaction));
      } else if (malUsername && anilistUsername) {
        // Both profiles linked - show buttons
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('profile_mal')
            .setLabel('MyAnimeList')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('profile_anilist')
            .setLabel('AniList')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({ 
          content: 'Which profile would you like to view?', 
          components: [buttons] 
        });

        const collectorFilter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
          filter: collectorFilter,
          time: 60000,
          max: 1
        });

        collector.on('collect', async i => {
          if (i.customId === 'profile_mal') {
            await i.update({ content: 'Fetching your MyAnimeList profile...', components: [] });
            await sendMalProfile(i.editReply.bind(i));
          } else if (i.customId === 'profile_anilist') {
            await i.update({ content: 'Fetching your AniList profile...', components: [] });
            await sendAniListProfile(i.editReply.bind(i));
          }
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ 
              content: 'No selection was made. Please try again.', 
              components: [] 
            }).catch(() => {});
          }
        });
      }
    } catch (error) {
      errorHandler(error, 'linkedprofile: execute');
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'An error occurred while fetching your linked profiles.')] 
      }).catch(() => {});
    }
  },
};
