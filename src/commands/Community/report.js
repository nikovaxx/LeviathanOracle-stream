const { SlashCommandBuilder, TextInputStyle, InteractionContextType } = require('discord.js');
const { modal, ui } = require('../../functions/ui');
const { bot: { reportChannelId: chanId } } = require('../../../config.json');

const MODAL_ID = 'rep';

const buildReportCard = ({ title, description, steps, interaction }) => ({
  title: '🔧 Bug Report',
  color: 0xff6b6b,
  fields: [
    { name: 'Title', value: title },
    { name: 'Description', value: description },
    { name: 'Steps', value: steps || 'N/A' },
    { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
    { name: 'Context', value: interaction.guild ? interaction.guild.name : 'DM', inline: true }
  ],
  footer: { text: `Sent: ${new Date().toLocaleString()}` }
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a bug')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction) {
    try {
      await interaction.showModal(modal({
        id: MODAL_ID,
        title: 'Report Issue',
        inputs: [
          { id: 't', label: 'Title', style: TextInputStyle.Short, minLength: 5, required: true },
          { id: 'd', label: 'Description', style: TextInputStyle.Paragraph, minLength: 20, required: true },
          { id: 's', label: 'Steps', style: TextInputStyle.Paragraph, required: false }
        ]
      }));

      const submission = await interaction.awaitModalSubmit({ filter: x => x.customId === MODAL_ID, time: 300000 }).catch(() => null);
      if (!submission) return;

      const chan = await interaction.client.channels.fetch(chanId).catch(() => null);
      if (!chan) {
        return submission.reply(ui.interactionPublic({ content: 'Report channel error.', componentsV2: false }));
      }

      const [title, description, steps] = ['t', 'd', 's'].map(f => submission.fields.getTextInputValue(f));

      await chan.send(ui.interactionPrivate(buildReportCard({ title, description, steps, interaction: submission }), { ephemeral: false }));

      await submission.reply(ui.interactionPublic({ content: 'Report submitted!', componentsV2: false }));
    } catch (e) {
      console.error(e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(ui.interactionPublic({ content: 'Failed to submit report.', componentsV2: false })).catch(() => {});
      }
    }
  }
};
