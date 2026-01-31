const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { fetchAniListUser } = require('../../utils/querry');
const db = require('../../schemas/database');

module.exports = {
  disabled: false,
  name: 'linkedprofile',
  description: 'View your linked profile(s)',
  aliases: ['linked', 'myprofiles'],

  async execute(message) {
    const discordId = message.author.id;

    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [discordId]
    );

    if (result.rows.length === 0) {
      return message.reply('You have not linked any profiles yet. Use `!linkprofile <mal|anilist> <username>` to link.');
    }

    const row = result.rows[0];
    const malUsername = row.mal_username;
    const anilistUsername = row.anilist_username;

    if (malUsername && !anilistUsername) {
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
      return message.reply({ embeds: [embed] });
    } else if (anilistUsername && !malUsername) {
      const userData = await fetchAniListUser(anilistUsername);
      if (!userData) {
        return message.reply('Failed to fetch AniList profile.');
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
      return message.reply({ embeds: [embed] });
    } else if (malUsername && anilistUsername) {
      return message.reply(`You have both profiles linked!\n**MyAnimeList:** ${malUsername}\n**AniList:** ${anilistUsername}\n\nUse \`!search-profile-mal ${malUsername}\` or \`!search-profile-anilist ${anilistUsername}\` to view them.`);
    }
  },
};
