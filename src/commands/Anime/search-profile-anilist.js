const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { fetchAniListUser } = require('../../utils/querry');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('search-profile-anilist')
    .setDescription('Fetch AniList user profile')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('AniList username')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const username = interaction.options.getString('username');

    const userData = await fetchAniListUser(username);
    if (!userData) {
      return interaction.editReply('Failed to fetch AniList profile.');
    }

    const daysWatched = (userData.statistics.anime.minutesWatched / 1440).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor(0x2e51a2)
      .setTitle(`${userData.name}'s AniList Profile`)
      .setURL(`https://anilist.co/user/${userData.name}`)
      .setThumbnail(userData.avatar.large)
      .addFields(
        { name: 'Anime Stats', value: `**Total Anime**: ${userData.statistics.anime.count}\n**Mean Score**: ${userData.statistics.anime.meanScore}\n**Days Watched**: ${daysWatched}`, inline: true },
        { name: 'Manga Stats', value: `**Total Manga**: ${userData.statistics.manga.count}\n**Chapters Read**: ${userData.statistics.manga.chaptersRead}\n**Volumes Read**: ${userData.statistics.manga.volumesRead}`, inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fav_anime')
        .setLabel('Favorite Anime')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('fav_manga')
        .setLabel('Favorite Manga')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = i => i.customId === 'fav_anime' || i.customId === 'fav_manga';
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'fav_anime') {
        const favAnime = userData.favourites?.anime?.nodes || [];
        if (!favAnime.length) {
          return i.update({ content: 'No favorite anime found for this user.', components: [] });
        }

        const favAnimeOptions = favAnime.map(anime => ({
          label: anime.title.romaji,
          description: anime.title.english || 'No English title',
          value: anime.id.toString(),
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_fav_anime')
          .setPlaceholder('Select your favorite anime')
          .addOptions(favAnimeOptions);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        await i.update({ content: '**Select your favorite anime:**', components: [selectRow] });

        const selectFilter = si => si.customId === 'select_fav_anime';
        const selectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000 });

        selectCollector.on('collect', async selectInteraction => {
          const selectedAnimeId = selectInteraction.values[0];
          const selectedAnime = favAnime.find(anime => anime.id.toString() === selectedAnimeId);

          if (!selectedAnime) {
            return selectInteraction.reply({ content: 'Could not find the selected anime.', ephemeral: true });
          }

          const animeEmbed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(selectedAnime.title.romaji)
            .setURL(`https://anilist.co/anime/${selectedAnime.id}`)
            .setImage(selectedAnime.coverImage.large)
            .addFields(
              { name: 'English Title', value: selectedAnime.title.english || 'N/A', inline: true },
              { name: 'Average Score', value: selectedAnime.averageScore?.toString() || 'N/A', inline: true },
            );

          await selectInteraction.reply({ embeds: [animeEmbed], ephemeral: true });
        });
      } else if (i.customId === 'fav_manga') {
        const favManga = userData.favourites?.manga?.nodes || [];
        if (!favManga.length) {
          return i.update({ content: 'No favorite manga found for this user.', components: [] });
        }

        const favMangaOptions = favManga.map(manga => ({
          label: manga.title.romaji,
          description: manga.title.english || 'No English title',
          value: manga.id.toString(),
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_fav_manga')
          .setPlaceholder('Select your favorite manga')
          .addOptions(favMangaOptions);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        await i.update({ content: '**Select your favorite manga:**', components: [selectRow] });

        const selectFilter = si => si.customId === 'select_fav_manga';
        const selectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000 });

        selectCollector.on('collect', async selectInteraction => {
          const selectedMangaId = selectInteraction.values[0];
          const selectedManga = favManga.find(manga => manga.id.toString() === selectedMangaId);

          if (!selectedManga) {
            return selectInteraction.reply({ content: 'Could not find the selected manga.', ephemeral: true });
          }

          const mangaEmbed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(selectedManga.title.romaji)
            .setURL(`https://anilist.co/manga/${selectedManga.id}`)
            .setImage(selectedManga.coverImage.large)
            .addFields(
              { name: 'English Title', value: selectedManga.title.english || 'N/A', inline: true },
              { name: 'Average Score', value: selectedManga.averageScore?.toString() || 'N/A', inline: true },
            );

          await selectInteraction.reply({ embeds: [mangaEmbed], ephemeral: true });
        });
      }
    });
  },
};
