const { SlashCommandBuilder } = require('discord.js');
const db = require('../../schemas/db');
const { embed } = require('../../functions/ui');

module.exports = {
    disabled: false,
    data: new SlashCommandBuilder()
        .setName('preference')
        .setDescription('Manage your bot preferences')
        .addSubcommand(sub => sub
            .setName('notification')
            .setDescription('Set how you want to receive anime notifications')
            .addStringOption(opt => opt
                .setName('type')
                .setDescription('Notification delivery method')
                .setRequired(true)
                .addChoices(
                    { name: 'Direct Message (DM)', value: 'dm' },
                    { name: 'Server (requires channel setup)', value: 'server' }
                )))
        .addSubcommand(sub => sub
            .setName('watchlist')
            .setDescription('Set watchlist visibility')
            .addStringOption(opt => opt
                .setName('visibility')
                .setDescription('Who can view your watchlist')
                .setRequired(true)
                .addChoices(
                    { name: 'Private (only you)', value: 'private' },
                    { name: 'Public (anyone can view/copy)', value: 'public' }
                )))
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View your current preferences')),

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'notification') {
            const type = interaction.options.getString('type');
            
            const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
            
            if (rows.length) {
                await db.query('UPDATE user_preferences SET notification_type = $1, updated_at = $2 WHERE user_id = $3', 
                    [type, Date.now(), userId]);
            } else {
                await db.query('INSERT INTO user_preferences (user_id, notification_type) VALUES ($1, $2)', 
                    [userId, type]);
            }

            return interaction.editReply({ 
                embeds: [embed({ 
                    title: 'Notification Preference Updated', 
                    desc: `You will now receive notifications via **${type === 'dm' ? 'Direct Message' : 'Server mentions'}**.${type === 'server' ? '\\n\\n⚠️ **Note:** Server notifications require an admin to set up a notification channel using `/setchannel`.' : ''}`,
                    color: 'Green' 
                })] 
            });
        }

        if (sub === 'watchlist') {
            const visibility = interaction.options.getString('visibility');
            
            const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
            
            if (rows.length) {
                await db.query('UPDATE user_preferences SET watchlist_visibility = $1, updated_at = $2 WHERE user_id = $3', 
                    [visibility, Date.now(), userId]);
            } else {
                await db.query('INSERT INTO user_preferences (user_id, watchlist_visibility) VALUES ($1, $2)', 
                    [userId, visibility]);
            }

            return interaction.editReply({ 
                embeds: [embed({ 
                    title: 'Watchlist Visibility Updated', 
                    desc: `Your watchlist is now **${visibility}**.${visibility === 'public' ? '\\n\\nOthers can view and copy your watchlist!' : '\\n\\nOnly you can view your watchlist.'}`,
                    color: 'Green' 
                })] 
            });
        }

        if (sub === 'view') {
            const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
            
            const prefs = rows.length ? rows[0] : { notification_type: 'dm', watchlist_visibility: 'private' };

            return interaction.editReply({ 
                embeds: [embed({ 
                    title: 'Your Preferences', 
                    fields: [
                        { name: 'Notifications', value: prefs.notification_type === 'dm' ? '📩 Direct Message' : '🔔 Server mentions', inline: true },
                        { name: 'Watchlist', value: prefs.watchlist_visibility === 'private' ? '🔒 Private' : '🌐 Public', inline: true }
                    ],
                    color: '#0099ff' 
                })] 
            });
        }
        } catch (error) {
            console.error('Error in preference command:', error);
            const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(errorMessage).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply(errorMessage).catch(() => {});
            }
        }
    }
};
