const { fetchRSSFeedWithRetries, filterEnglishAnimeItems } = require('../../utils/nyaaRSS');
const { embed } = require('../../functions/ui');

module.exports = {
  disabled: false,
  devOnly: true,
  name: 'nyaa',
  description: 'Search for English-translated anime on Nyaa',
  aliases: ['torrent'],

  async execute(message) {
    try {
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

      const fields = englishAnimeItems.slice(0, 10).map((item, i) => ({
        name: `${i + 1}. ${item.title}`,
        value: item.link
      }));

      message.reply({ embeds: [embed({ title: `Search Results for "${query}"`, fields, color: 0x0099ff })] });
    } catch (error) {
      console.error('Error in nyaa command:', error);
      return message.reply('An error occurred while executing this command. Please try again later.').catch(() => {});
    }
  },
};
