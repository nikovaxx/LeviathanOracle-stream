import { EmbedBuilder } from 'discord.js';

export function notificationEmbed(animeTitle, episodeNumber, airingTime, coverImage) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`🎬 New Episode Released!`)
    .setDescription(
      `**${animeTitle}**\n\n` +
      `Episode **${episodeNumber}** is now available!\n\n` +
      `📅 Aired at: ${new Date(airingTime).toUTCString()}\n\n` +
      `⏰ *Note: Episode may take some time to appear on streaming platforms*`
    )
    .setTimestamp(new Date(airingTime))
    .setFooter({ text: 'Enjoy watching!' });

  if (coverImage) {
    embed.setThumbnail(coverImage);
  }

  return embed;
}
