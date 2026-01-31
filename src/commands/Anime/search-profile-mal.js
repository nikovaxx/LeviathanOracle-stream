const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('search-profile-mal')
    .setDescription('Fetch MyAnimeList user profile')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('MyAnimeList username')
        .setRequired(true)),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    await interaction.deferReply();

    const userResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}`);
    const userData = userResponse.data.data;

    const animeStatsResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/statistics`);
    const animeStats = animeStatsResponse.data.data.anime || {};
    const mangaStats = animeStatsResponse.data.data.manga || {};

    const embed = new EmbedBuilder()
      .setColor(0x2e51a2)
      .setTitle(`${userData.username}'s MyAnimeList Profile`)
      .setURL(`https://myanimelist.net/profile/${userData.username}`)
      .setThumbnail(userData.images.jpg.image_url)
      .addFields(
        { name: 'Anime Stats', value: `**Total Entries**: ${animeStats.total_entries || 'N/A'}\n**Mean Score**: ${animeStats.mean_score || 'N/A'}\n**Days Watched**: ${animeStats.days_watched || 'N/A'}`, inline: true },
        { name: 'Manga Stats', value: `**Total Entries**: ${mangaStats.total_entries || 'N/A'}\n**Mean Score**: ${mangaStats.mean_score || 'N/A'}\n**Days Read**: ${mangaStats.days_read || 'N/A'}`, inline: true },
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
        const favAnimeResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/favorites`);
        const favAnime = favAnimeResponse.data.data.anime || [];
        
        if (!favAnime.length) {
          return i.update({ content: 'No favorite anime found for this user.', components: [] });
        }

        const favAnimeOptions = favAnime.map(anime => ({
          label: anime.title,
          description: 'No English title',
          value: anime.mal_id.toString(),
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
          if (!selectInteraction.values || !selectInteraction.values[0]) {
            return selectInteraction.reply({ content: 'No anime selected.', ephemeral: true });
          }

          const selectedAnimeId = selectInteraction.values[0];
          const selectedAnime = favAnime.find(anime => anime.mal_id.toString() === selectedAnimeId);

          if (!selectedAnime) {
            return selectInteraction.reply({ content: 'Could not find the selected anime.', ephemeral: true });
          }

          const animeDetailsResponse = await axios.get(`https://api.jikan.moe/v4/anime/${selectedAnimeId}/full`);
          const animeDetails = animeDetailsResponse.data.data;

          const animeEmbed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(animeDetails.title)
            .setURL(animeDetails.url)
            .setImage(animeDetails.images.jpg.image_url)
            .addFields(
              { name: 'Score', value: animeDetails.score?.toString() || 'N/A', inline: true },
              { name: 'Episodes', value: animeDetails.episodes?.toString() || 'N/A', inline: true },
            );

          await selectInteraction.reply({ embeds: [animeEmbed], ephemeral: true });
        });
      } else if (i.customId === 'fav_manga') {
        const favMangaResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/favorites`);
        const favManga = favMangaResponse.data.data.manga || [];
        
        if (!favManga.length) {
          return i.update({ content: 'No favorite manga found for this user.', components: [] });
        }

        const favMangaOptions = favManga.map(manga => ({
          label: manga.title,
          description: 'No English title',
          value: manga.mal_id.toString(),
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
          if (!selectInteraction.values || !selectInteraction.values[0]) {
            return selectInteraction.reply({ content: 'No manga selected.', ephemeral: true });
          }

          const selectedMangaId = selectInteraction.values[0];
          const selectedManga = favManga.find(manga => manga.mal_id.toString() === selectedMangaId);

          if (!selectedManga) {
            return selectInteraction.reply({ content: 'Could not find the selected manga.', ephemeral: true });
          }

          const mangaDetailsResponse = await axios.get(`https://api.jikan.moe/v4/manga/${selectedMangaId}/full`);
          const mangaDetails = mangaDetailsResponse.data.data;

          const mangaEmbed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(mangaDetails.title)
            .setURL(mangaDetails.url)
            .setImage(mangaDetails.images.jpg.image_url)
            .addFields(
              { name: 'Score', value: mangaDetails.score?.toString() || 'N/A', inline: true },
              { name: 'Volumes', value: mangaDetails.volumes?.toString() || 'N/A', inline: true },
            );

          await selectInteraction.reply({ embeds: [mangaEmbed], ephemeral: true });
        });
      }
    });
  },
};
