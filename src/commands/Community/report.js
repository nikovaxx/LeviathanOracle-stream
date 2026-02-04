const { SlashCommandBuilder, TextInputStyle } = require('discord.js');
const { modal, embed } = require('../../functions/ui');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report an issue or bug to the developers'),

  async execute(interaction) {
    try {
      const reportModal = modal({
        id: 'report_modal',
        title: 'Report an Issue',
        inputs: [
          {
            id: 'report_title',
            label: 'Issue Title',
            style: TextInputStyle.Short,
            placeholder: 'Brief description of the issue',
            minLength: 5,
            maxLength: 100,
            required: true
          },
          {
            id: 'report_description',
            label: 'Detailed Description',
            style: TextInputStyle.Paragraph,
            placeholder: 'Please describe the issue in detail...',
            minLength: 20,
            maxLength: 1000,
            required: true
          },
          {
            id: 'report_category',
            label: 'Steps to Reproduce',
            style: TextInputStyle.Paragraph,
            placeholder: 'Steps to reproduce the issue...',
            maxLength: 500,
            required: false
          }
        ]
      });

      await interaction.showModal(reportModal);

      const submitted = await interaction.awaitModalSubmit({
        filter: i => i.customId === 'report_modal' && i.user.id === interaction.user.id,
        time: 300000
      });

      const title = submitted.fields.getTextInputValue('report_title');
      const description = submitted.fields.getTextInputValue('report_description');
      const steps = submitted.fields.getTextInputValue('report_category') || 'Not provided';

      const reportChannel = await interaction.client.channels.fetch(config.bot.reportChannelId);
      
      if (!reportChannel) {
        return submitted.reply({ content: 'Report channel not found. Please set the channel ID in the config.json file.', ephemeral: true });
      }

      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear().toString().slice(-2)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

      const reportEmbed = embed({
        title: '🔧 New Bug Report',
        fields: [
          { name: 'Issue Title', value: title, inline: false },
          { name: 'Description', value: description, inline: false },
          { name: 'Steps to Reproduce', value: steps, inline: false },
          { name: 'Reported By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: 'Server', value: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'Direct Message', inline: true }
        ],
        color: 0xff6b6b,
        footer: { text: `Bug Report System - ${formattedDate}` }
      });

      await reportChannel.send({ embeds: [reportEmbed] });
      await submitted.reply({ content: 'Your report has been submitted successfully. Thank you!', ephemeral: true });
    } catch (error) {
      console.error('Error in report command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing your report. Please try again later.', ephemeral: true }).catch(() => {});
      }
    }
  }
};
