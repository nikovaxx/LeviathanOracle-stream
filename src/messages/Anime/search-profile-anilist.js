const { EmbedBuilder } = require('discord.js');
const { fetchAniListUser } = require('../../utils/querry');

module.exports = {
  disabled: false,
  name: 'search-profile-anilist',
  description: 'Fetch AniList user profile',
  aliases: ['anilist', 'searchanilist'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const username = args.join(' ');

    if (!username) {
      return message.reply('Please provide an AniList username. Usage: `!search-profile-anilist <username>`');
    }

    const userData = await fetchAniListUser(username);
    if (!userData) {
      return message.reply('Failed to fetch AniList profile. User may not exist.');
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

    message.reply({ embeds: [embed] });
  },
};
