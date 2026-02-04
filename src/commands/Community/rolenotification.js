const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../schemas/db');
const { fetchAnimeDetails, fetchAnimeDetailsById } = require('../../utils/anilist');
const scheduler = require('../../functions/notificationScheduler');
const { embed } = require('../../functions/ui');

module.exports = {
    disabled: false,
    data: new SlashCommandBuilder()
        .setName('rolenotification')
        .setDescription('Manage role-based anime notifications')
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add anime notification for a role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to notify').setRequired(true))
            .addStringOption(opt => opt.setName('anime').setDescription('Anime title or ID').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove anime notification for a role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
            .addStringOption(opt => opt.setName('anime').setDescription('Anime title').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all role notifications')
            .addRoleOption(opt => opt.setName('role').setDescription('Filter by role').setRequired(false))),

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;
            await interaction.deferReply({ ephemeral: true });

        if (sub === 'add') {
            const role = interaction.options.getRole('role');
            const input = interaction.options.getString('anime');
            
            const data = /^\d+$/.test(input) ? await fetchAnimeDetailsById(input) : await fetchAnimeDetails(input);
            const anime = Array.isArray(data) ? data[0] : data;

            if (!anime) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'Anime not found.', color: 'Red' })] });

            const { rowCount } = await db.query('SELECT 1 FROM role_notifications WHERE role_id = $1 AND anime_id = $2', [role.id, anime.id]);
            if (rowCount) return interaction.editReply({ embeds: [embed({ title: 'Duplicate', desc: 'This role is already subscribed to this anime.', color: 'Yellow' })] });

            const title = anime.title.english || anime.title.romaji;
            const airDate = anime.nextAiringEpisode?.airingAt * 1000 || null;
            const { rows } = await db.query('INSERT INTO role_notifications (role_id, guild_id, anime_id, anime_title, next_airing_at) VALUES ($1, $2, $3, $4, $5) RETURNING id', 
                [role.id, guildId, anime.id, title, airDate]);

            if (airDate) scheduler.scheduleRoleNotification({ id: rows[0].id, role_id: role.id, guild_id: guildId, anime_title: title, anime_id: anime.id, next_airing_at: airDate });
            
            return interaction.editReply({ embeds: [embed({ title: 'Role Notification Added', desc: `${role} will be notified when **${title}** episodes release!`, color: 'Green' })] });
        }

        if (sub === 'remove') {
            const role = interaction.options.getRole('role');
            const query = interaction.options.getString('anime').toLowerCase();
            
            const { rows } = await db.query('SELECT * FROM role_notifications WHERE role_id = $1 AND guild_id = $2', [role.id, guildId]);
            const match = rows.find(r => r.anime_title.toLowerCase().includes(query));

            if (!match) return interaction.editReply({ embeds: [embed({ title: 'Not Found', desc: 'No matching anime for this role.', color: 'Yellow' })] });

            await db.query('DELETE FROM role_notifications WHERE id = $1', [match.id]);
            scheduler.cancelRoleNotification(match.id);
            
            return interaction.editReply({ embeds: [embed({ title: 'Removed', desc: `${role} will no longer be notified about **${match.anime_title}**.`, color: 'Green' })] });
        }

        if (sub === 'list') {
            const role = interaction.options.getRole('role');
            const query = role 
                ? 'SELECT * FROM role_notifications WHERE guild_id = $1 AND role_id = $2 ORDER BY created_at DESC'
                : 'SELECT * FROM role_notifications WHERE guild_id = $1 ORDER BY created_at DESC';
            const params = role ? [guildId, role.id] : [guildId];

            const { rows } = await db.query(query, params);
            
            if (!rows.length) return interaction.editReply({ embeds: [embed({ title: 'No Notifications', desc: role ? `No anime notifications set for ${role}.` : 'No role notifications set in this server.', color: 'Yellow' })] });

            const list = rows.map((r, i) => `${i + 1}. <@&${r.role_id}> → **${r.anime_title}**`).join('\n');
            
            return interaction.editReply({ embeds: [embed({ title: role ? `Notifications for ${role.name}` : 'Server Role Notifications', desc: list, color: '#0099ff' })] });
        }
        } catch (error) {
            console.error('Error in rolenotification command:', error);
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
