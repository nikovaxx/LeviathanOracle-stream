import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchAnimeDetails, fetchAnimeDetailsById } from '../utils/anilist.js';
import { 
  addToWatchlist, 
  removeFromWatchlist, 
  getUserWatchlist,
  checkRateLimit 
} from '../database/dbmanager.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add anime to your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to add')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove anime from your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to remove')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show your current watchlist')),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === 'add') {
        const title = interaction.options.getString('title');
        
        // Quick-add by AniList numeric ID if user provided a number
        const numericId = /^\s*\d+\s*$/;
        if (numericId.test(title)) {
          const animeId = Number(title.trim());
          await interaction.deferReply({ ephemeral: true });

          // Rate limit check
          const allowed = await checkRateLimit(interaction.user.id, 'watchlist_add', 10, 60);
          if (!allowed) {
            return await interaction.editReply({ 
              content: 'You are adding too quickly. Please wait a moment.', 
              ephemeral: true 
            });
          }

          try {
            const selectedAnime = await fetchAnimeDetailsById(animeId);
            if (!selectedAnime) {
              return await interaction.editReply({ 
                content: 'Could not find anime with that AniList ID.', 
                ephemeral: true 
              });
            }

            const displayTitle = selectedAnime.title.english || selectedAnime.title.romaji || selectedAnime.title.native;
            const nextAiringAt = selectedAnime.nextAiringEpisode?.airingAt * 1000 || null;

            const result = await addToWatchlist(userId, animeId, displayTitle, nextAiringAt);

            if (!result.success) {
              if (result.error === 'already_exists') {
                return await interaction.editReply({ 
                  content: 'Anime already in watchlist.', 
                  ephemeral: true 
                });
              }
              return await interaction.editReply({ 
                content: 'Failed to add to watchlist.', 
                ephemeral: true 
              });
            }

            // Schedule notification if there's a next airing episode
            if (nextAiringAt) {
              const { scheduleNotification } = await import('../index.js');
              const newRow = { 
                id: result.watchlistId, 
                user_id: userId, 
                anime_id: animeId, 
                anime_title: displayTitle, 
                next_airing_at: nextAiringAt 
              };
              scheduleNotification(newRow, interaction.client);
            }

            return await interaction.editReply({ 
              content: `**${displayTitle}** added to your watchlist.`, 
              ephemeral: true 
            });

          } catch (err) {
            errorHandler(err, 'watchlist: add by ID');
            return await interaction.editReply({ 
              content: 'Error fetching anime details by ID.', 
              ephemeral: true 
            });
          }
        }

        // Non-numeric search: show results
        await interaction.deferReply();

        // Rate limit check
        const allowed = await checkRateLimit(interaction.user.id, 'watchlist_search', 10, 60);
        if (!allowed) {
          return await interaction.editReply({ 
            content: 'You are searching too quickly. Please wait a moment.', 
            ephemeral: true 
          });
        }

        try {
          const animeList = await fetchAnimeDetails(title);

          if (!Array.isArray(animeList) || animeList.length === 0) {
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('No Results Found')
              .setDescription('No anime found with the provided title. Please try again with a different title.');
            return await interaction.editReply({ embeds: [embed], ephemeral: true });
          }

          // Present compact results with instructions to use autocomplete or numeric ID
          const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
          const embed = new EmbedBuilder()
            .setTitle('Search results (use autocomplete or quick-add by ID)')
            .setColor(0x00AE86)
            .setDescription('This command uses autocomplete suggestions or numeric AniList IDs for direct add. Run `/watchlist add` with the ID to add directly.')
            .setTimestamp();

          for (let i = 0; i < Math.min(10, animeList.length); i++) {
            const a = animeList[i];
            const displayTitle = a.title.english || a.title.romaji || a.title.native || `#${a.id}`;
            const short = truncate(displayTitle, 80);
            embed.addFields({ name: `${i + 1}. ${short}`, value: `AniList ID: ${a.id}` });
          }

          await interaction.editReply({ embeds: [embed], ephemeral: true });

        } catch (error) {
          errorHandler(error, 'watchlist: add search');
          const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error Fetching Anime')
            .setDescription('An error occurred while fetching anime details. Please try again later.');
          await interaction.editReply({ embeds: [embed], ephemeral: true });
        }

      } else if (subcommand === 'remove') {
        const inputTitle = interaction.options.getString('title').toLowerCase();
        await interaction.deferReply({ ephemeral: true });

        // Rate limit check
        const allowed = await checkRateLimit(interaction.user.id, 'watchlist_remove', 10, 60);
        if (!allowed) {
          return await interaction.editReply({ 
            content: 'You are removing too quickly. Please wait a moment.', 
            ephemeral: true 
          });
        }

        try {
          const watchlist = await getUserWatchlist(userId);

          if (!watchlist || watchlist.length === 0) {
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Watchlist Empty')
              .setDescription('Your watchlist is currently empty.');
            return await interaction.editReply({ embeds: [embed] });
          }

          // Find match by comparing input to anime_title (case-insensitive, partial match)
          const inputWords = inputTitle.split(/\s+/).filter(Boolean);
          const matchedRow = watchlist.find(row => {
            const titleLower = row.anime_title.toLowerCase();
            return inputWords.every(word => titleLower.includes(word));
          });

          // If not found, try fetching AniList details for more title variants
          if (!matchedRow) {
            for (const row of watchlist) {
              try {
                const animeDetails = await fetchAnimeDetails(row.anime_title);
                const possibleTitles = [
                  animeDetails.title?.english,
                  animeDetails.title?.romaji,
                  animeDetails.title?.native
                ].filter(Boolean).map(t => t.toLowerCase());

                if (possibleTitles.some(title => inputWords.every(word => title.includes(word)))) {
                  const result = await removeFromWatchlist(userId, row.anime_id);
                  
                  if (!result.success) {
                    const embed = new EmbedBuilder()
                      .setColor('Red')
                      .setTitle('Error Removing Anime')
                      .setDescription('An error occurred while removing the anime from your watchlist.');
                    return await interaction.editReply({ embeds: [embed] });
                  }

                  const embed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('Anime Removed')
                    .setDescription(`**${row.anime_title}** has been removed from your watchlist.`);
                  return await interaction.editReply({ embeds: [embed] });
                }
              } catch (fetchErr) {
                // Ignore fetch errors and continue
              }
            }

            // No match found
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Anime Not Found')
              .setDescription(`No matching anime found in your watchlist for **${inputTitle}**.`);
            return await interaction.editReply({ embeds: [embed] });
          }

          // If found by anime_title, remove it
          const result = await removeFromWatchlist(userId, matchedRow.anime_id);

          if (!result.success) {
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setTitle('Error Removing Anime')
              .setDescription('An error occurred while removing the anime from your watchlist.');
            return await interaction.editReply({ embeds: [embed] });
          }

          const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('Anime Removed')
            .setDescription(`**${matchedRow.anime_title}** has been removed from your watchlist.`);
          await interaction.editReply({ embeds: [embed] });

        } catch (error) {
          errorHandler(error, 'watchlist: remove');
          const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error Removing Anime')
            .setDescription('An error occurred while accessing your watchlist.');
          await interaction.editReply({ embeds: [embed] });
        }

      } else if (subcommand === 'show') {
        await interaction.deferReply({ ephemeral: true });

        // Rate limit check
        const allowed = await checkRateLimit(interaction.user.id, 'watchlist_show', 10, 60);
        if (!allowed) {
          return await interaction.editReply({ 
            content: 'You are checking too quickly. Please wait a moment.', 
            ephemeral: true 
          });
        }

        try {
          const watchlist = await getUserWatchlist(userId);

          if (!watchlist || watchlist.length === 0) {
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Watchlist Empty')
              .setDescription('Your watchlist is currently empty.');
            return await interaction.editReply({ embeds: [embed] });
          }

          const watchlistDisplay = watchlist
            .map((row, i) => `${i + 1}. **${row.anime_title}**`)
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('Your Watchlist')
            .setDescription(watchlistDisplay);
          await interaction.editReply({ embeds: [embed] });

        } catch (error) {
          errorHandler(error, 'watchlist: show');
          const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('Error Fetching Watchlist')
            .setDescription('An error occurred while fetching your watchlist. Please try again later.');
          await interaction.editReply({ embeds: [embed] });
        }
      }

    } catch (error) {
      errorHandler(error, 'watchlist: execute');
      try {
        await interaction.editReply({ 
          content: 'There was an error while executing this command!', 
          components: [] 
        });
      } catch (e) {
        try {
          await interaction.reply({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
        } catch (e2) {}
      }
    }
  },

  // Autocomplete handler for the "title" option on the add subcommand
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

      // If user typed a numeric ID, suggest that as a direct-add option
      if (/^\d+$/.test(value)) {
        return await interaction.respond([
          { name: `Add AniList ID ${value}`, value: value }
        ]);
      }

      // Call AniList search for suggestions
      const results = await fetchAnimeDetails(value);
      if (!Array.isArray(results) || results.length === 0) {
        return await interaction.respond([]);
      }

      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const suggestions = results.slice(0, 25).map(a => {
        const titleEnglish = a.title?.english || a.title?.romaji || a.title?.native || `#${a.id}`;
        const name = truncate(titleEnglish, 100);
        return { name: name, value: String(a.id) };
      });

      await interaction.respond(suggestions);
    } catch (err) {
      errorHandler(err, 'watchlist: autocomplete');
      try {
        await interaction.respond([]);
      } catch (e) {}
    }
  }
};
