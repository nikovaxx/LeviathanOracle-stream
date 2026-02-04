const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { fetchAniListUser } = require('../../utils/querry');
const { embed } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-anilist')
    .setDescription('Fetch AniList user profile')
    .addStringOption(opt => opt.setName('username').setDescription('AniList username').setRequired(true)),

  async execute(interaction) {
    try {
      const user = await fetchAniListUser(interaction.options.getString('username'));
      if (!user) return interaction.reply('User not found.');

    const stats = user.statistics;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('fav_anime').setLabel('Fav Anime').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('fav_manga').setLabel('Fav Manga').setStyle(ButtonStyle.Success)
    );

    const mainEmbed = embed({
      title: `${user.name}'s Profile`,
      url: `https://anilist.co/user/${user.name}`,
      thumbnail: user.avatar.large,
      fields: [
        { name: 'Anime', value: `Count: ${stats.anime.count}\nScore: ${stats.anime.meanScore}\nDays: ${(stats.anime.minutesWatched / 1440).toFixed(1)}`, inline: true },
        { name: 'Manga', value: `Count: ${stats.manga.count}\nChapters: ${stats.manga.chaptersRead}`, inline: true }
      ],
      color: 0x2e51a2
    });

    const msg = await interaction.reply({ embeds: [mainEmbed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      const type = i.customId.split('_')[1]; // 'anime' or 'manga'
      const list = user.favourites?.[type]?.nodes || [];
      
      if (!list.length) return i.reply({ content: `No favorite ${type} found.`, ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_${type}`)
        .setPlaceholder(`Select a favorite ${type}`)
        .addOptions(list.map(m => ({ label: m.title.romaji.slice(0, 100), value: m.id.toString() })));

      const reply = await i.update({ components: [new ActionRowBuilder().addComponents(menu)], fetchReply: true });
      
      reply.awaitMessageComponent({ time: 30000 }).then(async sel => {
        const item = list.find(m => m.id.toString() === sel.values[0]);
        await sel.reply({ embeds: [embed({
          title: item.title.romaji,
          url: `https://anilist.co{type}/${item.id}`,
          image: item.coverImage.large,
          fields: [{ name: 'Score', value: `${item.averageScore || 'N/A'}%`, inline: true }],
          color: 0x2e51a2
        })], ephemeral: true });
      }).catch(() => {});
    });
    } catch (error) {
      console.error('Error in search-profile-anilist command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  }
};
