const { DiscoBase } = require('discobase-core');
const { GatewayIntentBits } = require('discord.js');
const path = require('path');

// Create DiscoBase instance
const bot = new DiscoBase({
    // Customize client options here
    clientOptions: {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ]
    }
});

// Access the Discord client if needed
const client = bot.getClient();

// Add custom client event listeners here if needed
// client.on('clientReady', () => {
//     console.log('Custom ready event!');
// });

// Start the bot
bot.start();

const scheduler = require('./functions/notificationScheduler');

client.once('clientReady', () => {
    const dashboardPath = path.join(__dirname, '../node_modules/discobase-core/admin/dashboard.js');
    require(dashboardPath)(client);
    scheduler.initialize(client);
});
