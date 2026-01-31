const { EmbedBuilder } = require('discord.js');
const db = require('../../schemas/database');
const { fetchAnimeDetails, fetchAnimeDetailsById } = require('../../utils/anilist');
const scheduler = require('../../functions/notificationScheduler');

module.exports = {
  disabled: false,
  name: 'watchlist',
  description: 'Manage your anime watchlist',
  aliases: ['wl'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const subcommand = args[0]?.toLowerCase();
    const userId = message.author.id;

    if (!subcommand || !['add', 'remove', 'show'].includes(subcommand)) {
      return message.reply('Usage: `!watchlist <add|remove|show> [title]`');
    }

    if (subcommand === 'add') {
      const title = args.slice(1).join(' ');
      if (!title) {
        return message.reply('Please provide an anime title. Usage: `!watchlist add <title>`');
      }

      if (/^\s*\d+\s*$/.test(title)) {
        const animeId = Number(title.trim());
        const selectedAnime = await fetchAnimeDetailsById(animeId);
        
        if (!selectedAnime) {
          return message.reply('Could not find anime with that AniList ID.');
        }

        const result = await db.query(
          'SELECT * FROM watchlists WHERE user_id = $1 AND anime_id = $2',
          [userId, animeId]
        );

        if (result.rows.length > 0) {
          return message.reply('Anime already in watchlist.');
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

        return message.reply(`**${displayTitle}** added to your watchlist.`);
      }

      const animeList = await fetchAnimeDetails(title);

      if (!Array.isArray(animeList) || animeList.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('No Results Found')
          .setDescription('No anime found. Try using the AniList ID directly: `!watchlist add <anilist_id>`');
        return message.reply({ embeds: [embed] });
      }

      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const embed = new EmbedBuilder()
        .setTitle('Search Results - Use AniList ID to add')
        .setColor(0x00AE86)
        .setDescription('Use `!watchlist add <anilist_id>` to add an anime.')
        .setTimestamp();

      for (let i = 0; i < Math.min(10, animeList.length); i++) {
        const a = animeList[i];
        const displayTitle = a.title.english || a.title.romaji || a.title.native || `#${a.id}`;
        const short = truncate(displayTitle, 80);
        embed.addFields({ name: `${i + 1}. ${short}`, value: `AniList ID: ${a.id}` });
      }

      return message.reply({ embeds: [embed] });
      
    } else if (subcommand === 'remove') {
      const inputTitle = args.slice(1).join(' ').toLowerCase();
      if (!inputTitle) {
        return message.reply('Please provide an anime title. Usage: `!watchlist remove <title>`');
      }

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
              return message.reply({ embeds: [embed] });
            }
          }
        }

        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Anime Not Found')
          .setDescription(`No matching anime found in your watchlist for **${inputTitle}**.`);
        return message.reply({ embeds: [embed] });
      }

      await db.query('DELETE FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, matchedRow.anime_id]);
      scheduler.cancelNotification(matchedRow.id);

      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('Anime Removed')
        .setDescription(`**${matchedRow.anime_title}** has been removed from your watchlist.`);
      return message.reply({ embeds: [embed] });
      
    } else if (subcommand === 'show') {
      const result = await db.query(
        'SELECT anime_title FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      if (!result.rows || result.rows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Watchlist Empty')
          .setDescription('Your watchlist is currently empty.');
        return message.reply({ embeds: [embed] });
      }

      const watchlistDisplay = result.rows
        .map((row, i) => `${i + 1}. **${row.anime_title}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('Your Watchlist')
        .setDescription(watchlistDisplay);
      message.reply({ embeds: [embed] });
    }
  },
};
