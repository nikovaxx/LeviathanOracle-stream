const { EmbedBuilder } = require('discord.js');
const { fetchRSSFeedWithRetries, filterEnglishAnimeItems } = require('../../utils/nyaaRSS');

module.exports = {
  disabled: false,
  name: 'nyaa',
  description: 'Search for English-translated anime on Nyaa',
  aliases: ['torrent'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const query = args.join(' ');

    if (!query) {
      return message.reply('Please provide a search term. Usage: `!nyaa <anime title>`');
    }

    const url = `https://nyaa.si/?page=rss&f=0&c=0_0&q=${encodeURIComponent(query)}`;

    const feed = await fetchRSSFeedWithRetries(url);
    const englishAnimeItems = filterEnglishAnimeItems(feed.items);

    if (englishAnimeItems.length === 0) {
      return message.reply(`No results found for "${query}".`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`Search Results for "${query}"`)
      .setTimestamp();

    englishAnimeItems.slice(0, 10).forEach((item, i) => {
      embed.addFields({ name: `${i + 1}. ${item.title}`, value: item.link });
    });

    message.reply({ embeds: [embed] });
  },
};
