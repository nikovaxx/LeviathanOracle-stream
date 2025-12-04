import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchDailySchedule, createAnimeEmbed, createPaginationButtons } from '../utils/anime-schedule.js';
import { checkRateLimit } from '../database/dbmanager.js';
import { errorHandler } from '../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show the upcoming anime episodes'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Rate limit check
      const allowed = await checkRateLimit(interaction.user.id, 'upcoming', 5, 60);
      if (!allowed) {
        return await interaction.editReply({ 
          content: 'You are using this command too quickly. Please wait a moment.', 
          ephemeral: true 
        });
      }

      const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const dayButtons = daysOfWeek.map(day => 
        new ButtonBuilder()
          .setCustomId(day.toLowerCase())
          .setLabel(day)
          .setStyle(ButtonStyle.Primary)
      );

      // Split buttons into rows (max 5 per row)
      const rows = [];
      for (let i = 0; i < dayButtons.length; i += 5) {
        const rowComponents = dayButtons.slice(i, i + 5);
        if (rowComponents.length > 0) {
          rows.push(new ActionRowBuilder().addComponents(rowComponents));
        }
      }

      await interaction.editReply({ content: 'Please select a day of the week:', components: rows });

      const filter = i => daysOfWeek.map(day => day.toLowerCase()).includes(i.customId);
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          const selectedDay = i.customId;
          
          const airTypeButtons = ['sub', 'dub', 'raw'].map(type => 
            new ButtonBuilder()
              .setCustomId(type)
              .setLabel(type)
              .setStyle(ButtonStyle.Secondary)
          );

          const airTypeRow = new ActionRowBuilder().addComponents(airTypeButtons);
          await i.editReply({ 
            content: `Selected day: ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}. Now select the air type:`, 
            components: [airTypeRow] 
          });

          const airTypeFilter = i => ['sub', 'dub', 'raw'].includes(i.customId);
          const airTypeCollector = interaction.channel.createMessageComponentCollector({ filter: airTypeFilter, time: 15000 });

          airTypeCollector.on('collect', async i => {
            try {
              await i.deferUpdate();
              const selectedAirType = i.customId;
              let animeData = [];
              
              try {
                animeData = await fetchDailySchedule(selectedDay, selectedAirType);
              } catch (fetchErr) {
                errorHandler(fetchErr, 'upcoming: fetchDailySchedule');
                return await i.editReply({ 
                  content: 'Failed to fetch schedule. Please try again later.', 
                  components: [] 
                });
              }

              if (!animeData || animeData.length === 0) {
                return await i.editReply({ 
                  content: `No upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} with air type ${selectedAirType}.`, 
                  components: [] 
                });
              }

              const totalPages = Math.ceil(animeData.length / 10);
              let currentPage = 1;

              const embed = createAnimeEmbed(animeData, currentPage);
              const row = createPaginationButtons(currentPage, totalPages);

              await i.editReply({ 
                content: `Upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} (${selectedAirType}):`, 
                embeds: [embed], 
                components: [row] 
              });

              const pageFilter = i => i.customId === 'prev' || i.customId === 'next';
              const pageCollector = interaction.channel.createMessageComponentCollector({ filter: pageFilter, time: 60000 });

              pageCollector.on('collect', async i => {
                try {
                  await i.deferUpdate();
                  
                  if (i.customId === 'prev' && currentPage > 1) currentPage--;
                  if (i.customId === 'next' && currentPage < totalPages) currentPage++;

                  const newEmbed = createAnimeEmbed(animeData, currentPage);
                  const newRow = createPaginationButtons(currentPage, totalPages);

                  await i.editReply({ embeds: [newEmbed], components: [newRow] });
                } catch (err) {
                  errorHandler(err, 'upcoming: pagination collector');
                }
              });

              pageCollector.on('end', () => {
                i.editReply({ components: [] }).catch(() => {});
              });

            } catch (err) {
              errorHandler(err, 'upcoming: airType collector');
              try {
                await i.editReply({ 
                  content: 'An error occurred while processing your request.', 
                  components: [] 
                });
              } catch (e) {}
            }
          });

          airTypeCollector.on('end', collected => {
            if (collected.size === 0) {
              interaction.editReply({ content: 'No air type selected.', components: [] }).catch(() => {});
            }
          });

        } catch (err) {
          errorHandler(err, 'upcoming: day collector');
          try {
            await i.editReply({ 
              content: 'An error occurred while processing your request.', 
              components: [] 
            });
          } catch (e) {}
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'No day selected.', components: [] }).catch(() => {});
        }
      });

    } catch (error) {
      errorHandler(error, 'upcoming: execute');
      try {
        await interaction.editReply({ 
          content: 'There was an error while executing this command!', 
          components: [] 
        });
      } catch (e) {
        try {
          await interaction.reply({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
        } catch (e2) {}
      }
    }
  },
};
