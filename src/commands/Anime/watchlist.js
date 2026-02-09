const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const db = require('../../schemas/db');
const { fetchAnimeDetails, fetchAnimeDetailsById, fetchAnimeByMalId } = require('../../utils/anilist');
const { bestMatch } = require('../../utils/fuzzy');
const scheduler = require('../../functions/notificationScheduler');
const { embed } = require('../../functions/ui');
const axios = require('axios');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    .addSubcommand(s => s.setName('add').setDescription('Add anime').addStringOption(o => o.setName('title').setDescription('Anime title to add').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove anime').addStringOption(o => o.setName('title').setDescription('Anime title to remove').setRequired(true)))
    .addSubcommand(s => s.setName('view').setDescription('View a user\'s watchlist').addUserOption(o => o.setName('user').setDescription('User to view (leave empty for your own)')))
    .addSubcommand(s => s.setName('export').setDescription('Export your watchlist').addStringOption(o => o.setName('format').setDescription('Export format').setRequired(true).addChoices({ name: 'MAL (XML)', value: 'mal' }, { name: 'AniList (JSON)', value: 'anilist' })))
    .addSubcommand(s => s.setName('import').setDescription('Import a watchlist').addStringOption(o => o.setName('format').setDescription('Import format').setRequired(true).addChoices({ name: 'MAL (XML)', value: 'mal' }, { name: 'AniList (JSON)', value: 'anilist' })).addAttachmentOption(o => o.setName('file').setDescription('Exported file to import').setRequired(true))),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();
      const userId = interaction.user.id;
      const {username} = interaction.user;

      if (sub === 'add') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const input = interaction.options.getString('title');
        const data = /^\d+$/.test(input) ? await fetchAnimeDetailsById(input) : await fetchAnimeDetails(input);
        const anime = Array.isArray(data) ? data[0] : data;

        if (!anime) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'Anime not found.', color: 'Red' })] });

        const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime.id]);
        if (rowCount) return interaction.editReply({ embeds: [embed({ title: 'Duplicate', desc: 'Already in your list.', color: 'Yellow' })] });

        const title = anime.title.english || anime.title.romaji;
        const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
        const { rows } = await db.query(
          'INSERT INTO watchlists (user_id, discord_username, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [userId, username, anime.id, title, airDate]
        );

        if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
        return interaction.editReply({ embeds: [embed({ title: 'Added', desc: `**${title}** added!`, color: 'Green' })] });
      }

      if (sub === 'remove') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const query = interaction.options.getString('title').toLowerCase();
        const { rows } = await db.query('SELECT * FROM watchlists WHERE user_id = $1', [userId]);
        const matched = bestMatch(query, rows, r => [r.anime_title]);
        const match = matched[0];

        if (!match) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'No match in your list.', color: 'Yellow' })] });

        await db.query('DELETE FROM watchlists WHERE id = $1', [match.id]);
        scheduler.cancelNotification(match.id);
        return interaction.editReply({ embeds: [embed({ title: 'Removed', desc: `**${match.anime_title}** removed.`, color: 'Green' })] });
      }

      if (sub === 'view') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === userId;
        await interaction.deferReply({ flags: isSelf ? MessageFlags.Ephemeral : 0 });

        if (!isSelf) {
          const { rows: prefRows } = await db.query('SELECT watchlist_visibility FROM user_preferences WHERE user_id = $1', [targetUser.id]);
          const visibility = prefRows[0]?.watchlist_visibility || 'private';
          if (visibility === 'private') {
            return interaction.editReply({ embeds: [embed({ title: 'Private', desc: 'This user\'s watchlist is private.', color: 'Yellow' })] });
          }
        }

        const { rows } = await db.query('SELECT anime_title FROM watchlists WHERE user_id = $1', [targetUser.id]);
        const list = rows.map((r, i) => `${i + 1}. **${r.anime_title}**`).join('\n') || 'Watchlist is empty.';
        return interaction.editReply({ embeds: [embed({ title: `${targetUser.username}'s Watchlist`, desc: list })] });
      }

      if (sub === 'export') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const format = interaction.options.getString('format');
        const { rows } = await db.query('SELECT anime_id, anime_title FROM watchlists WHERE user_id = $1', [userId]);

        if (!rows.length) return interaction.editReply({ embeds: [embed({ title: 'Empty', desc: 'Your watchlist is empty.', color: 'Yellow' })] });

        if (format === 'mal') {
          const xmlItems = rows.map(r => `  <anime>\n    <series_animedb_id>${r.anime_id}</series_animedb_id>\n    <series_title><![CDATA[${r.anime_title}]]></series_title>\n    <my_status>Plan to Watch</my_status>\n  </anime>`).join('\n');
          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<myanimelist>\n  <myinfo>\n    <user_export_type>1</user_export_type>\n  </myinfo>\n${xmlItems}\n</myanimelist>`;
          const file = new AttachmentBuilder(Buffer.from(xml), { name: 'watchlist-mal-export.xml' });
          return interaction.editReply({ content: 'Here is your MAL-compatible export:', files: [file] });
        }

        const jsonData = { userId, entries: rows.map(r => ({ anilistId: r.anime_id, title: r.anime_title })) };
        const file = new AttachmentBuilder(Buffer.from(JSON.stringify(jsonData, null, 2)), { name: 'watchlist-anilist-export.json' });
        return interaction.editReply({ content: 'Here is your AniList-compatible export:', files: [file] });
      }

      if (sub === 'import') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const format = interaction.options.getString('format');
        const attachment = interaction.options.getAttachment('file');

        if (!attachment) return interaction.editReply({ embeds: [embed({ title: 'Error', desc: 'No file provided.', color: 'Red' })] });

        const { data: fileContent } = await axios.get(attachment.url, { responseType: 'text' });
        let imported = 0, skipped = 0;

        if (format === 'mal') {
          const animeMatches = fileContent.match(/<series_animedb_id>(\d+)<\/series_animedb_id>/g) || [];
          const titleMatches = fileContent.match(/<series_title><!\[CDATA\[(.+?)\]\]><\/series_title>/g) || [];

          for (let i = 0; i < animeMatches.length; i++) {
            const malId = animeMatches[i].match(/(\d+)/)[1];
            const titleRaw = titleMatches[i]?.match(/<!\[CDATA\[(.+?)\]\]>/)?.[1] || `MAL#${malId}`;

            const anime = await fetchAnimeByMalId(parseInt(malId));
            if (!anime) { skipped++; continue; }

            const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, anime.id]);
            if (rowCount) { skipped++; continue; }

            const title = anime.title.english || anime.title.romaji || titleRaw;
            const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
            const { rows } = await db.query(
              'INSERT INTO watchlists (user_id, discord_username, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
              [userId, username, anime.id, title, airDate]
            );
            if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
            imported++;
          }
        } else {
          let entries;
          try { entries = JSON.parse(fileContent).entries; } catch { return interaction.editReply({ embeds: [embed({ title: 'Error', desc: 'Invalid JSON file.', color: 'Red' })] }); }
          if (!Array.isArray(entries)) return interaction.editReply({ embeds: [embed({ title: 'Error', desc: 'Invalid export format.', color: 'Red' })] });

          for (const entry of entries) {
            const { rowCount } = await db.query('SELECT 1 FROM watchlists WHERE user_id = $1 AND anime_id = $2', [userId, entry.anilistId]);
            if (rowCount) { skipped++; continue; }

            const anime = await fetchAnimeDetailsById(entry.anilistId);
            const title = anime?.title?.english || anime?.title?.romaji || entry.title;
            const airDate = anime?.nextAiringEpisode?.airingAt * 1000 || null;
            const { rows } = await db.query(
              'INSERT INTO watchlists (user_id, discord_username, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
              [userId, username, anime?.id || entry.anilistId, title, airDate]
            );
            if (airDate) scheduler.scheduleNotification({ id: rows[0].id, user_id: userId, anime_title: title, next_airing_at: airDate });
            imported++;
          }
        }

        return interaction.editReply({ embeds: [embed({ title: 'Import Complete', desc: `**Imported:** ${imported}\n**Skipped (duplicates/errors):** ${skipped}`, color: 'Green' })] });
      }
    } catch (error) {
      console.error('Error in watchlist command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.' };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ ...errorMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused();
    if (!value) return interaction.respond([]);
    const results = (await fetchAnimeDetails(value)) || [];
    const ranked = bestMatch(value, results, a => [a.title?.english, a.title?.romaji, a.title?.native]);
    const out = (ranked.length ? ranked : results)
      .slice(0, 25)
      .map(a => ({ name: (a.title.english || a.title.romaji).substring(0, 100), value: String(a.id) }));
    await interaction.respond(out);
  }
};
