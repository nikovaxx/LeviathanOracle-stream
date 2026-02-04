const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');
const { embed } = require('../../functions/ui');

const getJikan = async (path) => (await axios.get(`https://api.jikan.moe/v4/${path}`)).data.data;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-mal')
    .setDescription('Fetch MyAnimeList user profile')
    .addStringOption(opt => opt.setName('username').setDescription('MAL username').setRequired(true)),

  async execute(interaction) {
    try {
      const user = interaction.options.getString('username');
      await interaction.deferReply();

      const [data, stats] = await Promise.all([getJikan(`users/${user}`), getJikan(`users/${user}/statistics`)]);

    const msg = await interaction.editReply({ embeds: [embed({
      title: `${data.username}'s Profile`,
      url: data.url,
      thumbnail: data.images.jpg.image_url,
      fields: [
        { name: 'Anime', value: `Total: ${stats.anime.total_entries}\nScore: ${stats.anime.mean_score}`, inline: true },
        { name: 'Manga', value: `Total: ${stats.manga.total_entries}\nScore: ${stats.manga.mean_score}`, inline: true }
      ],
      color: 0x2e51a2
    })], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      const type = i.customId;
      const favs = (await getJikan(`users/${user}/favorites`))[type] || [];
      
      if (!favs.length) return i.reply({ content: `No favorites found.`, ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_${type}`)
        .setPlaceholder(`Select ${type}`)
        .addOptions(favs.slice(0, 25).map(f => ({ label: f.title.slice(0, 100), value: f.mal_id.toString() })));

      const reply = await i.update({ content: `**Select a ${type}:**`, components: [new ActionRowBuilder().addComponents(menu)], fetchReply: true });
      
      const select = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
      if (!select) return;

      const item = await getJikan(`${type}/${select.values[0]}/full`);
      await select.reply({ embeds: [embed({
        title: item.title,
        url: item.url,
        image: item.images.jpg.image_url,
        fields: [
          { name: 'Score', value: `${item.score || 'N/A'}`, inline: true },
          { name: type === 'anime' ? 'Episodes' : 'Volumes', value: `${item.episodes || item.volumes || 'N/A'}`, inline: true }
        ],
        color: 0x2e51a2
      })], ephemeral: true });
    });
    } catch (error) {
      console.error('Error in search-profile-mal command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  }
};
