const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchDailySchedule, createAnimeEmbed, createPaginationButtons } = require('../../utils/anime-schedule');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show the upcoming anime episodes'),

  async execute(interaction) {
    await interaction.deferReply();

    const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayButtons = daysOfWeek.map(day => 
      new ButtonBuilder()
        .setCustomId(day.toLowerCase())
        .setLabel(day)
        .setStyle(ButtonStyle.Primary)
    );

    const rows = [];
    for (let i = 0; i < dayButtons.length; i += 5) {
      const rowComponents = dayButtons.slice(i, i + 5);
      if (rowComponents.length > 0) rows.push(new ActionRowBuilder().addComponents(rowComponents));
    }

    await interaction.editReply({ content: 'Please select a day of the week:', components: rows });

    const filter = i => daysOfWeek.map(day => day.toLowerCase()).includes(i.customId);
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async i => {
      await i.deferUpdate();
      const selectedDay = i.customId;
      
      const airTypeButtons = ['sub', 'dub', 'raw'].map(type => 
        new ButtonBuilder()
          .setCustomId(type)
          .setLabel(type)
          .setStyle(ButtonStyle.Secondary)
      );

      const airTypeRow = new ActionRowBuilder().addComponents(airTypeButtons);

      await i.editReply({ content: `Selected day: ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}. Now select the air type:`, components: [airTypeRow] });

      const airTypeFilter = i => ['sub', 'dub', 'raw'].includes(i.customId);
      const airTypeCollector = interaction.channel.createMessageComponentCollector({ filter: airTypeFilter, time: 15000 });

      airTypeCollector.on('collect', async i => {
        await i.deferUpdate();
        const selectedAirType = i.customId;
        
        const animeData = await fetchDailySchedule(selectedDay, selectedAirType);

        if (!animeData || animeData.length === 0) {
          return i.editReply({ content: `No upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} with air type ${selectedAirType}.`, components: [] });
        }

        const totalPages = Math.ceil(animeData.length / 10);
        let currentPage = 1;

        const embed = createAnimeEmbed(animeData, currentPage);
        const row = createPaginationButtons(currentPage, totalPages);

        await i.editReply({ content: `Upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} (${selectedAirType}):`, embeds: [embed], components: [row] });

        const pageFilter = i => i.customId === 'prev' || i.customId === 'next';
        const pageCollector = interaction.channel.createMessageComponentCollector({ filter: pageFilter, time: 60000 });

        pageCollector.on('collect', async i => {
          await i.deferUpdate();
          if (i.customId === 'prev' && currentPage > 1) currentPage--;
          if (i.customId === 'next' && currentPage < totalPages) currentPage++;

          const newEmbed = createAnimeEmbed(animeData, currentPage);
          const newRow = createPaginationButtons(currentPage, totalPages);

          await i.editReply({ embeds: [newEmbed], components: [newRow] });
        });

        pageCollector.on('end', () => {
          i.editReply({ components: [] }).catch(() => {});
        });
      });

      airTypeCollector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'No air type selected.', components: [] }).catch(() => {});
        }
      });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'No day selected.', components: [] }).catch(() => {});
      }
    });
  },
};
