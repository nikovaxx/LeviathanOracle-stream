const { EmbedBuilder } = require('discord.js');

module.exports = (options = {}) => {
  const embed = new EmbedBuilder()
    .setColor(options.color || '#0099ff')
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.url) embed.setURL(options.url);
  if (options.desc || options.description) embed.setDescription(options.desc || options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.footer) embed.setFooter(typeof options.footer === 'string' ? { text: options.footer } : options.footer);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(typeof options.author === 'string' ? { name: options.author } : options.author);

  return embed;
};
