const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const db = require('../../schemas/db');
const { fetchAnimeDetails, fetchAnimeDetailsById, fetchAnimeByMalId } = require('../../utils/anilist');
const { bestMatch } = require('../../utils/fuzzy');
const scheduler = require('../../functions/notificationScheduler');
const { embed } = require('../../functions/ui');
const axios = require('axios');

const reply = (i, title, desc, color) => i.editReply({ embeds: [embed({ title, desc, color })] });

const INSERT_SQL = 'INSERT INTO watchlists (user_id, discord_username, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4, $5) RETURNING id';

async function insertAnime(userId, username, anime, titleFallback) {
  const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime?.id]);
  if (rowCount || !anime) return false;

  const title = anime.title?.english || anime.title?.romaji || titleFallback;
  const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
  const { rows } = await db.query(INSERT_SQL, [userId, username, anime.id, title, airDate]);

  if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
  return true;
}

module.exports = {
  diabled: false,
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    .addSubcommand(s => s.setName('add').setDescription('Add anime').addStringOption(o => o.setName('title').setDescription('Anime title to add').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove anime').addStringOption(o => o.setName('title').setDescription('Anime title to remove').setRequired(true)))
    .addSubcommand(s => s.setName('view').setDescription('View a user\'s watchlist').addUserOption(o => o.setName('user').setDescription('User to view (leave empty for your own)')))
    .addSubcommand(s => s.setName('export').setDescription('Export your watchlist').addStringOption(o => o.setName('format').setDescription('Export format').setRequired(true).addChoices({ name: 'MAL (XML)', value: 'mal' }, { name: 'AniList (JSON)', value: 'anilist' })))
    .addSubcommand(s => s.setName('import').setDescription('Import a watchlist').addStringOption(o => o.setName('format').setDescription('Import format').setRequired(true).addChoices({ name: 'MAL (XML)', value: 'mal' }, { name: 'AniList (JSON)', value: 'anilist' })).addAttachmentOption(o => o.setName('file').setDescription('Exported file to import').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { id: userId, username } = interaction.user;

    try {
      if (sub === 'add') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const input = interaction.options.getString('title');
        const data = /^\d+$/.test(input) ? await fetchAnimeDetailsById(input) : await fetchAnimeDetails(input);
        const anime = Array.isArray(data) ? data[0] : data;

        if (!anime) return reply(interaction, 'Not Found', 'Anime not found.', 'Red');

        const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime.id]);
        if (rowCount) return reply(interaction, 'Duplicate', 'Already in your list.', 'Yellow');

        await insertAnime(userId, username, anime);
        return reply(interaction, 'Added', `**${anime.title.english || anime.title.romaji}** added!`, 'Green');
      }

      if (sub === 'remove') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { rows } = await db.query('SELECT * FROM watchlists WHERE user_id = $1', [userId]);
        const match = bestMatch(interaction.options.getString('title').toLowerCase(), rows, r => [r.anime_title])[0];

        if (!match) return reply(interaction, 'Not Found', 'No match in your list.', 'Yellow');

        await db.query('DELETE FROM watchlists WHERE id = $1', [match.id]);
        scheduler.cancelNotification(match.id);
        return reply(interaction, 'Removed', `**${match.anime_title}** removed.`, 'Green');
      }

      if (sub === 'view') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === userId;
        await interaction.deferReply({ flags: isSelf ? MessageFlags.Ephemeral : 0 });

        if (!isSelf) {
          const { rows } = await db.query('SELECT watchlist_visibility FROM user_preferences WHERE user_id = $1', [targetUser.id]);
          if ((rows[0]?.watchlist_visibility || 'private') === 'private')
            return reply(interaction, 'Private', 'This user\'s watchlist is private.', 'Yellow');
        }

        const { rows } = await db.query('SELECT anime_title FROM watchlists WHERE user_id = $1', [targetUser.id]);
        const list = rows.map((r, i) => `${i + 1}. **${r.anime_title}**`).join('\n') || 'Watchlist is empty.';
        return reply(interaction, `${targetUser.username}'s Watchlist`, list);
      }

      if (sub === 'export') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const format = interaction.options.getString('format');
        const { rows } = await db.query('SELECT anime_id, anime_title FROM watchlists WHERE user_id = $1', [userId]);

        if (!rows.length) return reply(interaction, 'Empty', 'Your watchlist is empty.', 'Yellow');

        const [content, name] = format === 'mal'
          ? [
              `<?xml version="1.0" encoding="UTF-8"?>\n<myanimelist>\n  <myinfo>\n    <user_export_type>1</user_export_type>\n  </myinfo>\n${rows.map(r => `  <anime>\n    <series_animedb_id>${r.anime_id}</series_animedb_id>\n    <series_title><![CDATA[${r.anime_title}]]></series_title>\n    <my_status>Plan to Watch</my_status>\n  </anime>`).join('\n')}\n</myanimelist>`,
              'watchlist-mal-export.xml'
            ]
          : [JSON.stringify({ userId, entries: rows.map(r => ({ anilistId: r.anime_id, title: r.anime_title })) }, null, 2), 'watchlist-anilist-export.json'];

        return interaction.editReply({ content: `Here is your ${format === 'mal' ? 'MAL' : 'AniList'}-compatible export:`, files: [new AttachmentBuilder(Buffer.from(content), { name })] });
      }

      if (sub === 'import') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const format = interaction.options.getString('format');
        const attachment = interaction.options.getAttachment('file');
        if (!attachment) return reply(interaction, 'Error', 'No file provided.', 'Red');

        const { data: fileContent } = await axios.get(attachment.url, { responseType: 'text' });
        let imported = 0, skipped = 0;

        if (format === 'mal') {
          const ids = fileContent.match(/<series_animedb_id>(\d+)<\/series_animedb_id>/g) || [];
          for (const tag of ids) {
            const malId = parseInt(tag.match(/(\d+)/)[1]);
            const anime = await fetchAnimeByMalId(malId);
            (await insertAnime(userId, username, anime, `MAL#${malId}`)) ? imported++ : skipped++;
          }
        } else {
          let entries;
          try { entries = JSON.parse(fileContent).entries; } catch { return reply(interaction, 'Error', 'Invalid JSON file.', 'Red'); }
          if (!Array.isArray(entries)) return reply(interaction, 'Error', 'Invalid export format.', 'Red');

          for (const entry of entries) {
            const anime = await fetchAnimeDetailsById(entry.anilistId);
            (await insertAnime(userId, username, anime || { id: entry.anilistId }, entry.title)) ? imported++ : skipped++;
          }
        }

        return reply(interaction, 'Import Complete', `**Imported:** ${imported}\n**Skipped:** ${skipped}`, 'Green');
      }
    } catch (e) {
      console.error('Watchlist error:', e);
      const msg = { content: 'An error occurred. Please try again later.' };
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ ...msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      else if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
    }
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused();
    if (!value) return interaction.respond([]);
    const results = (await fetchAnimeDetails(value)) || [];
    const ranked = bestMatch(value, results, a => [a.title?.english, a.title?.romaji, a.title?.native]);
    await interaction.respond(
      (ranked.length ? ranked : results).slice(0, 25).map(a => ({ name: (a.title.english || a.title.romaji).substring(0, 100), value: String(a.id) }))
    );
  }
};
