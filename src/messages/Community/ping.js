//! This is a basic structure for a prefix command in a discoBase using discord.js
module.exports = {
    disabled: false,
    name: "ping",
    description: "This is the ping command.",
    aliases: ['p'],

    async execute (message) {
        try {
            const ping = Date.now() - message.createdTimestamp;

            const latency = Math.abs(ping);
            const latencyFormatted = `${latency.toString().substring(0, 2)}ms`;
            const emoji = "⏱️";

            message.reply(`${emoji} Pong! Latency is ${latencyFormatted}!`);
        } catch (error) {
            console.error('Error in ping command:', error);
            return message.reply('An error occurred while executing this command. Please try again later.').catch(() => {});
        }
    },
};
