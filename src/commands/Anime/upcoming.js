const { SlashCommandBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { fetchDailySchedule } = require('../../utils/anime-schedule');
const { embed, ui } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder().setName('upcoming').setDescription('Upcoming anime episodes'),

  async execute(interaction) {
    try {
      const msg = await interaction.deferReply();
      const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const rows = [ui.row(days.slice(0, 4).map(d => ({ id: d, label: d, style: ButtonStyle.Primary }))), ui.row(days.slice(4).map(d => ({ id: d, label: d, style: ButtonStyle.Primary })))];

      await interaction.editReply({ content: 'Select a day:', components: rows });
      const dClick = await msg.awaitMessageComponent({ time: 30000 }).catch(() => null);
      if (!dClick) return interaction.editReply({ content: 'Timed out.', components: [] });

      await dClick.update({ content: `Day: **${dClick.customId}**. Type:`, components: [ui.row(['Sub', 'Dub', 'Raw'].map(t => ({ id: t, label: t, style: ButtonStyle.Secondary })))] });
      const tClick = await msg.awaitMessageComponent({ time: 30000 }).catch(() => null);
      if (!tClick) return interaction.editReply({ content: 'Timed out.', components: [] });

      const data = await fetchDailySchedule(dClick.customId, tClick.customId);
      if (!data?.length) return tClick.update({ content: 'No episodes found.', components: [] });

      let page = 1, total = Math.ceil(data.length / 10);
      const getPage = () => ({
        content: `Schedule: **${dClick.customId}** (${tClick.customId})`,
        embeds: [embed({ 
          title: 'Upcoming Anime', 
          fields: data.slice((page - 1) * 10, page * 10).map(a => ({ name: a.english || a.title, value: `**Ep ${a.episodeNumber}** - <t:${Math.floor(new Date(a.episodeDate).getTime() / 1000)}:f>` })),
          footer: `Page ${page}/${total}` 
        })],
        components: [ui.pagination(page, total)]
      });

      await tClick.update(getPage());
      const col = msg.createMessageComponentCollector({ time: 120000 });
      col.on('collect', i => { page += i.customId === 'prev' ? -1 : 1; i.update(getPage()); });
      col.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
      
    } catch (e) {
      console.error(e);
      const err = { content: 'Error fetching schedule.', flags: MessageFlags.Ephemeral };
      interaction.deferred ? interaction.editReply(err) : interaction.reply(err);
    }
  }
};
