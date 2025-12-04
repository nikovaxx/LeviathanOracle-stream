import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed, errorEmbed } from '../utils/embeds/commandembeds.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check bot latency"),

  async execute(interaction) {
    try {
      const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(interaction.client.ws.ping);

      await interaction.editReply({ 
        embeds: [infoEmbed(
          '🏓 Pong!', 
          `**Bot Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms`
        )]
      });
    } catch (error) {
      errorHandler(error, 'ping: execute');
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          embeds: [errorEmbed('Error', 'An error occurred while checking latency.')], 
          ephemeral: true 
        }).catch(() => {});
      } else {
        await interaction.editReply({ 
          embeds: [errorEmbed('Error', 'An error occurred while checking latency.')] 
        }).catch(() => {});
      }
    }
  },
};
