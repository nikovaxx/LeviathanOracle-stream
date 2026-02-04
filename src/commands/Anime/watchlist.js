const { SlashCommandBuilder } = require('discord.js');
const db = require('../../schemas/db');
const { fetchAnimeDetails, fetchAnimeDetailsById } = require('../../utils/anilist');
const scheduler = require('../../functions/notificationScheduler');
const { embed } = require('../../functions/ui');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    .addSubcommand(s => s.setName('add').setDescription('Add anime').addStringOption(o => o.setName('title').setDescription('Anime title to add').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove anime').addStringOption(o => o.setName('title').setDescription('Anime title to remove').setRequired(true)))
    .addSubcommand(s => s.setName('show').setDescription('Show watchlist')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const userId = interaction.user.id;
      await interaction.deferReply({ ephemeral: true });

    if (sub === 'add') {
      const input = interaction.options.getString('title');
      const data = /^\d+$/.test(input) ? await fetchAnimeDetailsById(input) : await fetchAnimeDetails(input);
      const anime = Array.isArray(data) ? data[0] : data;

      if (!anime) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'Anime not found.', color: 'Red' })] });

      const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime.id]);
      if (rowCount) return interaction.editReply({ embeds: [embed({ title: 'Duplicate', desc: 'Already in your list.', color: 'Yellow' })] });

      const title = anime.title.english || anime.title.romaji;
      const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
      const { rows } = await db.query('INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4) RETURNING id', [userId, anime.id, title, airDate]);

      if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
      return interaction.editReply({ embeds: [embed({ title: 'Added', desc: `**${title}** added!`, color: 'Green' })] });
    }

    if (sub === 'remove') {
      const query = interaction.options.getString('title').toLowerCase();
      const { rows } = await db.query('SELECT * FROM watchlists WHERE user_id = $1', [userId]);
      const match = rows.find(r => r.anime_title.toLowerCase().includes(query));

      if (!match) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'No match in your list.', color: 'Yellow' })] });

      await db.query('DELETE FROM watchlists WHERE id = $1', [match.id]);
      scheduler.cancelNotification(match.id);
      return interaction.editReply({ embeds: [embed({ title: 'Removed', desc: `**${match.anime_title}** removed.`, color: 'Green' })] });
    }

    if (sub === 'show') {
      const { rows } = await db.query('SELECT anime_title FROM watchlists WHERE user_id = $1', [userId]);
      const list = rows.map((r, i) => `${i + 1}. **${r.anime_title}**`).join('\n') || 'Your list is empty.';
      return interaction.editReply({ embeds: [embed({ title: 'Your Watchlist', desc: list })] });
    }
    } catch (error) {
      console.error('Error in watchlist command:', error);
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
    const results = await fetchAnimeDetails(value);
    await interaction.respond(results.slice(0, 25).map(a => ({ name: (a.title.english || a.title.romaji).substring(0, 100), value: String(a.id) })));
  }
};
