import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Replies with pong and the bot's latency!"),
  async execute(interaction) {
    try {
      const sent = await interaction.reply({ 
        content: 'Pong!', 
        fetchReply: true,
        allowedMentions: { users: [interaction.user.id] }
      });

      const latency = sent.createdTimestamp - interaction.createdTimestamp;

      await interaction.editReply({ 
        content: `Pong! Latency is ${latency}ms.`,
        allowedMentions: { users: [interaction.user.id] }
      });
    } catch (error) {
      console.error('ping command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      } else {
        await interaction.followUp({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      }
    }
  },
};