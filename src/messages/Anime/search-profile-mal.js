const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  disabled: false,
  name: 'search-profile-mal',
  description: 'Fetch MyAnimeList user profile',
  aliases: ['mal', 'searchmal'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const username = args.join(' ');

    if (!username) {
      return message.reply('Please provide a MyAnimeList username. Usage: `!search-profile-mal <username>`');
    }

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

    message.reply({ embeds: [embed] });
  },
};
