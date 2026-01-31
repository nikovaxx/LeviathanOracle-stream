const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { fetchAniListUser } = require('../../utils/querry');
const db = require('../../schemas/database');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('linkedprofile')
    .setDescription('View your linked profile(s)'),
    
  async execute(interaction) {
    const discordId = interaction.user.id;

    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [discordId]
    );

    if (result.rows.length === 0) {
      return interaction.reply({ content: 'You have not linked any profiles yet.', ephemeral: true });
    }

    const row = result.rows[0];
    const malUsername = row.mal_username;
    const anilistUsername = row.anilist_username;

    const sendMalProfile = async (updateFn) => {
      const userResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}`);
      const userData = userResponse.data.data;
      const statsResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}/statistics`);
      const animeStats = statsResponse.data.data.anime || {};
      const mangaStats = statsResponse.data.data.manga || {};

      const embed = new EmbedBuilder()
        .setColor(0x2e51a2)
        .setTitle(`${userData.username}'s MyAnimeList Profile`)
        .setURL(`https://myanimelist.net/profile/${userData.username}`)
        .setThumbnail(userData.images.jpg.image_url)
        .addFields(
          { name: 'Anime Stats', value: `**Total Entries:** ${animeStats.total_entries || 'N/A'}\n**Mean Score:** ${animeStats.mean_score || 'N/A'}\n**Days Watched:** ${animeStats.days_watched || 'N/A'}`, inline: true },
          { name: 'Manga Stats', value: `**Total Entries:** ${mangaStats.total_entries || 'N/A'}\n**Mean Score:** ${mangaStats.mean_score || 'N/A'}\n**Days Read:** ${mangaStats.days_read || 'N/A'}`, inline: true }
        );
      await updateFn({ embeds: [embed], content: undefined, components: [] });
    };

    const sendAniListProfile = async (updateFn) => {
      const userData = await fetchAniListUser(anilistUsername);
      if (!userData) {
        return updateFn({ content: 'Failed to fetch AniList profile.', components: [] });
      }
      
      const daysWatched = (userData.statistics.anime.minutesWatched / 1440).toFixed(1);
      const embed = new EmbedBuilder()
        .setColor(0x2e51a2)
        .setTitle(`${userData.name}'s AniList Profile`)
        .setURL(`https://anilist.co/user/${userData.name}`)
        .setThumbnail(userData.avatar.large)
        .addFields(
          { name: 'Anime Stats', value: `**Total Anime:** ${userData.statistics.anime.count}\n**Mean Score:** ${userData.statistics.anime.meanScore}\n**Days Watched:** ${daysWatched}`, inline: true },
          { name: 'Manga Stats', value: `**Total Manga:** ${userData.statistics.manga.count}\n**Chapters Read:** ${userData.statistics.manga.chaptersRead}\n**Volumes Read:** ${userData.statistics.manga.volumesRead}`, inline: true }
        );
      await updateFn({ embeds: [embed], content: undefined, components: [] });
    };

    if (malUsername && !anilistUsername) {
      await interaction.reply({ content: 'Fetching your MyAnimeList profile...', ephemeral: true });
      sendMalProfile(interaction.editReply.bind(interaction));
    } else if (anilistUsername && !malUsername) {
      await interaction.reply({ content: 'Fetching your AniList profile...', ephemeral: true });
      sendAniListProfile(interaction.editReply.bind(interaction));
    } else if (malUsername && anilistUsername) {
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('profile_mal')
          .setLabel('MyAnimeList')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('profile_anilist')
          .setLabel('AniList')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ content: 'Which profile would you like to view?', components: [buttons], ephemeral: true });
      
      const collectorFilter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter: collectorFilter,
        time: 60000,
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        if (i.customId === 'profile_mal') {
          sendMalProfile(i.editReply.bind(i));
        } else if (i.customId === 'profile_anilist') {
          sendAniListProfile(i.editReply.bind(i));
        }
        collector.stop();
      });

      collector.on('end', () => {
        if (collector.collected.size === 0) {
          interaction.editReply({ content: 'Selection timed out.', components: [] }).catch(() => {});
        }
      });
    }
  },
};
