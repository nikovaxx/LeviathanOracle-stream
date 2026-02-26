const db = require('../../schemas/db');
const { embed } = require('../../functions/ui');

module.exports = {
    disabled: false,
    devOnly: true,
    name: 'preference',
    description: 'Manage your bot preferences',
    aliases: ['pref', 'settings'],

    async execute(message) {
        try {
            const args = message.content.split(/\s+/).slice(1);
            const sub = args[0]?.toLowerCase();
            const value = args[1]?.toLowerCase();
            const userId = message.author.id;

            if (!sub || !['notification', 'watchlist', 'view'].includes(sub)) {
                return message.reply('Usage: `!preference <notification|watchlist|view> [dm/server|private/public]`');
            }

            if (sub === 'notification') {
                if (!value || !['dm', 'server'].includes(value)) {
                    return message.reply('Usage: `!preference notification <dm|server>`');
                }

                const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
                
                if (rows.length) {
                    await db.query('UPDATE user_preferences SET notification_type = $1, updated_at = $2 WHERE user_id = $3', 
                        [value, Date.now(), userId]);
                } else {
                    await db.query('INSERT INTO user_preferences (user_id, notification_type) VALUES ($1, $2)', 
                        [userId, value]);
                }

                return message.reply({ 
                    embeds: [embed({ 
                        title: 'Notification Preference Updated', 
                        desc: `You will now receive notifications via **${value === 'dm' ? 'Direct Message' : 'Server mentions'}**.${value === 'server' ? '\\n\\n⚠️ **Note:** Requires notification channel setup.' : ''}`,
                        color: 'Green' 
                    })] 
                });
            }

            if (sub === 'watchlist') {
                if (!value || !['private', 'public'].includes(value)) {
                    return message.reply('Usage: `!preference watchlist <private|public>`');
                }

                const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
                
                if (rows.length) {
                    await db.query('UPDATE user_preferences SET watchlist_visibility = $1, updated_at = $2 WHERE user_id = $3', 
                        [value, Date.now(), userId]);
                } else {
                    await db.query('INSERT INTO user_preferences (user_id, watchlist_visibility) VALUES ($1, $2)', 
                        [userId, value]);
                }

                return message.reply({ 
                    embeds: [embed({ 
                        title: 'Watchlist Visibility Updated', 
                        desc: `Your watchlist is now **${value}**.`,
                        color: 'Green' 
                    })] 
                });
            }

            if (sub === 'view') {
                const { rows } = await db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
                
                const prefs = rows.length ? rows[0] : { notification_type: 'dm', watchlist_visibility: 'private' };

                return message.reply({ 
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
            return message.reply('An error occurred while executing this command. Please try again later.').catch(() => {});
        }
    }
};
