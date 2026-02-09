const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  row: (buttons) => new ActionRowBuilder().addComponents(
    buttons.map(b => new ButtonBuilder()
      .setCustomId(b.id)
      .setLabel(b.label)
      .setStyle(b.style || ButtonStyle.Primary)
      .setDisabled(b.disabled || false))
  ),

  pagination: (current, total) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(current === 1),
    new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(current === total)
  )
};
