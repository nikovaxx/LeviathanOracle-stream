const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../schemas/database');
const { fetchAnimeDetails, fetchAnimeDetailsById } = require('../../utils/anilist');
const scheduler = require('../../functions/notificationScheduler');

module.exports = {
  disabled: false,
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
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'add') {
      const title = interaction.options.getString('title');
      
      if (/^\s*\d+\s*$/.test(title)) {
        const animeId = Number(title.trim());
        await interaction.deferReply({ ephemeral: true });
        
        const selectedAnime = await fetchAnimeDetailsById(animeId);
        if (!selectedAnime) {
          return interaction.editReply({ content: 'Could not find anime with that AniList ID.' });
        }

        const result = await db.query(
          'SELECT * FROM watchlists WHERE user_id = $1 AND anime_id = $2',
          [userId, animeId]
        );

        if (result.rows.length > 0) {
          return interaction.editReply({ content: 'Anime already in watchlist.' });
        }

        const displayTitle = selectedAnime.title.english || selectedAnime.title.romaji || selectedAnime.title.native;
        const nextAiringAt = selectedAnime.nextAiringEpisode?.airingAt * 1000 || null;

        const insertResult = await db.query(
          'INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4) RETURNING id',
          [userId, animeId, displayTitle, nextAiringAt]
        );

        if (nextAiringAt) {
          const newRow = {
            id: insertResult.rows[0].id,
            user_id: userId,
            anime_id: animeId,
            anime_title: displayTitle,
            next_airing_at: nextAiringAt,
          };
          scheduler.scheduleNotification(newRow);
        }

        return interaction.editReply({ content: `**${displayTitle}** added to your watchlist.` });
      }

      await interaction.deferReply();
      const animeList = await fetchAnimeDetails(title);

      if (!Array.isArray(animeList) || animeList.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('No Results Found')
          .setDescription('No anime found with the provided title. Please try again with a different title.');
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }

      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const embed = new EmbedBuilder()
        .setTitle('Search results (use autocomplete or quick-add by ID)')
        .setColor(0x00AE86)
        .setDescription('Use the autocomplete suggestions or pass a numeric AniList ID to add directly.')
        .setTimestamp();

      for (let i = 0; i < Math.min(10, animeList.length); i++) {
        const a = animeList[i];
        const displayTitle = a.title.english || a.title.romaji || a.title.native || `#${a.id}`;
        const short = truncate(displayTitle, 80);
        embed.addFields({ name: `${i + 1}. ${short}`, value: `AniList ID: ${a.id}` });
      }

      await interaction.editReply({ embeds: [embed], ephemeral: true });
      
    } else if (subcommand === 'remove') {
      const inputTitle = interaction.options.getString('title').toLowerCase();
      await interaction.deferReply({ ephemeral: true });

      const result = await db.query(
        'SELECT id, anime_id, anime_title FROM watchlists WHERE user_id = $1',
        [userId]
      );

      const inputWords = inputTitle.split(/\s+/).filter(Boolean);
      const matchedRow = result.rows.find(row => {
        const titleLower = row.anime_title.toLowerCase();
        return inputWords.every(word => titleLower.includes(word));
      });

      if (!matchedRow) {
        for (const row of result.rows) {
          const animeDetails = await fetchAnimeDetailsById(row.anime_id);
          if (animeDetails) {
            const possibleTitles = [
              animeDetails.title.english,
              animeDetails.title.romaji,
              animeDetails.title.native
            ].filter(Boolean).map(t => t.toLowerCase());

            if (possibleTitles.some(title => inputWords.every(word => title.includes(word)))) {
              await db.query('DELETE FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, row.anime_id]);
              scheduler.cancelNotification(row.id);
              
              const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('Anime Removed')
                .setDescription(`**${row.anime_title}** has been removed from your watchlist.`);
              return interaction.editReply({ embeds: [embed] });
            }
          }
        }

        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Anime Not Found')
          .setDescription(`No matching anime found in your watchlist for **${inputTitle}**.`);
        return interaction.editReply({ embeds: [embed] });
      }

      await db.query('DELETE FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, matchedRow.anime_id]);
      scheduler.cancelNotification(matchedRow.id);

      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('Anime Removed')
        .setDescription(`**${matchedRow.anime_title}** has been removed from your watchlist.`);
      return interaction.editReply({ embeds: [embed] });
      
    } else if (subcommand === 'show') {
      await interaction.deferReply({ ephemeral: true });

      const result = await db.query(
        'SELECT anime_title FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      if (!result.rows || result.rows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Watchlist Empty')
          .setDescription('Your watchlist is currently empty.');
        return interaction.editReply({ embeds: [embed] });
      }

      const watchlistDisplay = result.rows
        .map((row, i) => `${i + 1}. **${row.anime_title}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('Your Watchlist')
        .setDescription(watchlistDisplay);
      interaction.editReply({ embeds: [embed] });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const value = focused.value;
    
    if (/^\d+$/.test(value)) {
      await interaction.respond([{ name: `Add AniList ID ${value}`, value: value }]);
      return;
    }

    const results = await fetchAnimeDetails(value);
    if (!Array.isArray(results) || results.length === 0) {
      await interaction.respond([]);
      return;
    }

    const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
    const suggestions = results.slice(0, 25).map(a => {
      const titleEnglish = a.title?.english || a.title?.romaji || a.title?.native || `#${a.id}`;
      const name = truncate(titleEnglish, 100);
      return { name, value: String(a.id) };
    });

    await interaction.respond(suggestions);
  },
};
