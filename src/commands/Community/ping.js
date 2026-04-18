const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { ui } = require('../../functions/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('This is the ping command.')
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async execute(interaction) {
        try {
            const ping = Date.now() - interaction.createdTimestamp;
            const latency = Math.abs(ping);
            const latencyFormatted = `${latency.toString().substring(0, 2)}ms`;
            const emoji = "⏱️";

            await interaction.reply({ content: `${emoji} Pong! Latency is ${latencyFormatted}!` });
        } catch (error) {
            console.error('Error in ping command:', error);
            const errorMessage = { content: 'An error occurred while executing this command. Please try again later.' };
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(ui.interactionPublic({ ...errorMessage, componentsV2: false })).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply(errorMessage).catch(() => {});
            }
        }
    }
};
