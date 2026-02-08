const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    disabled: false,
    //! The 'data' property defines the slash command's structure using SlashCommandBuilder.
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('This is the ping command.'),

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
                await interaction.reply({ ...errorMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply(errorMessage).catch(() => {});
            }
        }
    }
};
