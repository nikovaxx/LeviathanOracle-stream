const { SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { fetchDailySchedule } = require('../../utils/anime-schedule');
const { embed, ui } = require('../../functions/ui');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder().setName('upcoming').setDescription('Show upcoming anime episodes'),

  async execute(interaction) {
    try {
      const reply = await interaction.deferReply();
      const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const dayRows = [
      ui.row(days.slice(0, 4).map(d => ({ id: d, label: d, style: ButtonStyle.Primary }))),
      ui.row(days.slice(4).map(d => ({ id: d, label: d, style: ButtonStyle.Primary })))
    ];

    await interaction.editReply({ content: 'Select a day:', components: dayRows });

    const dayClick = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
    if (!dayClick) return interaction.editReply({ content: 'Timed out.', components: [] });

    await dayClick.update({ content: `Day: **${dayClick.customId}**. Select type:`, components: [ui.row(['Sub', 'Dub', 'Raw'].map(t => ({ id: t, label: t, style: ButtonStyle.Secondary })))] });

    const typeClick = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
    if (!typeClick) return interaction.editReply({ content: 'Timed out.', components: [] });

    const animeData = await fetchDailySchedule(dayClick.customId, typeClick.customId);
    if (!animeData?.length) return typeClick.update({ content: 'No episodes found.', components: [] });

    let page = 1;
    const total = Math.ceil(animeData.length / 10);

    const getPage = () => {
      const start = (page - 1) * 10;
      const fields = animeData.slice(start, start + 10).map(a => ({
        name: a.english || a.title,
        value: `**Ep ${a.episodeNumber}** - <t:${Math.floor(new Date(a.episodeDate).getTime() / 1000)}:f>`
      }));

      return {
        content: `Schedule for **${dayClick.customId}** (${typeClick.customId}):`,
        embeds: [embed({ title: 'Upcoming Anime', fields, footer: `Page ${page}/${total} • ${typeClick.customId.toUpperCase()}` })],
        components: [ui.pagination(page, total)]
      };
    };

    await typeClick.update(getPage());

    const collector = reply.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
      i.customId === 'prev' ? page-- : page++;
      await i.update(getPage());
    });

    collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
    } catch (error) {
      console.error('Error in upcoming command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  }
};
