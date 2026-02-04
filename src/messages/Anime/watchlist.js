const db = require('../../schemas/db');
const { fetchAnimeDetails, fetchAnimeDetailsById } = require('../../utils/anilist');
const scheduler = require('../../functions/notificationScheduler');
const { embed } = require('../../functions/ui');
module.exports = {
  disabled: false,
  name: 'watchlist',
  aliases: ['wl'],

  async execute(message) {
    try {
      const args = message.content.split(/\s+/).slice(1);
      const sub = args[0]?.toLowerCase();
      const query = args.slice(1).join(' ');
      const userId = message.author.id;

      if (!['add', 'remove', 'show'].includes(sub)) 
        return message.reply('Usage: `!watchlist <add|remove|show> [title/ID]`');

      if (sub === 'add') {
        if (!query) return message.reply('Usage: `!watchlist add <title or ID>`');
        
        const isId = /^\d+$/.test(query);
        const anime = isId ? await fetchAnimeDetailsById(query) : (await fetchAnimeDetails(query))[0];

        if (!anime) {
          const list = await fetchAnimeDetails(query);
          const desc = list?.slice(0, 10).map(a => `ID: \`${a.id}\` - **${a.title.english || a.title.romaji}**`).join('\n');
          return message.reply({ embeds: [embed({ title: 'Search Results', desc: desc || 'No results.', color: 'Yellow' })] });
        }

        const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime.id]);
        if (rowCount) return message.reply('Already in your watchlist.');

        const title = anime.title.english || anime.title.romaji;
        const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
        const { rows } = await db.query('INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4) RETURNING id', [userId, anime.id, title, airDate]);

        if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
        return message.reply(`Added **${title}**!`);
      }

      if (sub === 'remove') {
        if (!query) return message.reply('Usage: `!watchlist remove <title>`');
        const { rows } = await db.query('SELECT * FROM watchlists WHERE user_id = $1', [userId]);
        const match = rows.find(r => r.anime_title.toLowerCase().includes(query.toLowerCase()));

        if (!match) return message.reply({ embeds: [embed({ title: 'Not Found', desc: 'No match in your list.', color: 'Yellow' })] });

        await db.query('DELETE FROM watchlists WHERE id = $1', [match.id]);
        scheduler.cancelNotification(match.id);
        return message.reply({ embeds: [embed({ title: 'Removed', desc: `**${match.anime_title}** removed.`, color: 'Green' })] });
      }

      if (sub === 'show') {
        const { rows } = await db.query('SELECT anime_title FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        const list = rows.map((r, i) => `${i + 1}. **${r.anime_title}**`).join('\n') || 'List is empty.';
        return message.reply({ embeds: [embed({ title: 'Your Watchlist', desc: list })] });
      }
    } catch (error) {
      console.error('Error in watchlist command:', error);
      return message.reply('An error occurred while executing this command. Please try again later.').catch(() => {});
    }
  },
};
