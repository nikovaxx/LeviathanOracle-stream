import { EmbedBuilder } from 'discord.js';

export function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function warningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function animeEmbed(anime) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(anime.title.english || anime.title.romaji || anime.title.native)
    .setDescription(`**Status:** ${anime.status || 'Unknown'}`)
    .setTimestamp();

  if (anime.coverImage?.large) {
    embed.setThumbnail(anime.coverImage.large);
  }

  if (anime.nextAiringEpisode) {
    const airingDate = new Date(anime.nextAiringEpisode.airingAt * 1000);
    embed.addFields({
      name: '📺 Next Episode',
      value: `Episode ${anime.nextAiringEpisode.episode}\nAirs: ${airingDate.toUTCString()}`
    });
  }

  return embed;
}

export function watchlistEmbed(animeList, userId) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📋 Your Watchlist')
    .setDescription(animeList.length === 0 ? 'Your watchlist is empty.' : null)
    .setTimestamp()
    .setFooter({ text: `User ID: ${userId}` });

  if (animeList.length > 0) {
    const display = animeList
      .map((item, i) => {
        const airingInfo = item.next_airing_at 
          ? `\n└ Next: ${new Date(item.next_airing_at).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`
          : '';
        return `${i + 1}. **${item.anime_title}**${airingInfo}`;
      })
      .join('\n\n');
    
    embed.setDescription(display);
  }

  return embed;
}

export function profileEmbed(userData, platform) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(`${platform === 'anilist' ? 'AniList' : 'MyAnimeList'} Profile`)
    .setDescription(`**${userData.name}**`)
    .setTimestamp();

  if (userData.avatar?.large) {
    embed.setThumbnail(userData.avatar.large);
  }

  if (userData.statistics) {
    if (userData.statistics.anime) {
      embed.addFields({
        name: '📺 Anime Stats',
        value: `Count: ${userData.statistics.anime.count}\nMean Score: ${userData.statistics.anime.meanScore}\nMinutes Watched: ${userData.statistics.anime.minutesWatched}`,
        inline: true
      });
    }

    if (userData.statistics.manga) {
      embed.addFields({
        name: '📖 Manga Stats',
        value: `Count: ${userData.statistics.manga.count}\nChapters Read: ${userData.statistics.manga.chaptersRead}\nVolumes Read: ${userData.statistics.manga.volumesRead}`,
        inline: true
      });
    }
  }

  return embed;
}

export function mangaEmbed(manga) {
  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle(manga.title.english || manga.title.romaji)
    .setDescription(`**Chapters:** ${manga.chapters || 'Unknown'}`)
    .setTimestamp();

  if (manga.coverImage?.large) {
    embed.setThumbnail(manga.coverImage.large);
  }

  return embed;
}

export function malProfileEmbed(userData, animeStats, mangaStats) {
  const embed = new EmbedBuilder()
    .setColor(0x2e51a2)
    .setTitle(`${userData.username}'s MyAnimeList Profile`)
    .setURL(`https://myanimelist.net/profile/${userData.username}`)
    .setTimestamp();

  if (userData.images?.jpg?.image_url) {
    embed.setThumbnail(userData.images.jpg.image_url);
  }

  if (animeStats) {
    embed.addFields({
      name: '📺 Anime Stats',
      value: `**Total Entries:** ${animeStats.total_entries || 'N/A'}\n**Mean Score:** ${animeStats.mean_score || 'N/A'}\n**Days Watched:** ${animeStats.days_watched || 'N/A'}`,
      inline: true
    });
  }

  if (mangaStats) {
    embed.addFields({
      name: '📖 Manga Stats',
      value: `**Total Entries:** ${mangaStats.total_entries || 'N/A'}\n**Mean Score:** ${mangaStats.mean_score || 'N/A'}\n**Days Read:** ${mangaStats.days_read || 'N/A'}`,
      inline: true
    });
  }

  return embed;
}
