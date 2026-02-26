const Parser = require('rss-parser');
const parser = new Parser();

function filterEnglishAnimeItems(items) {
  try {
    const englishKeywords = ['eng', 'english', 'sub', 'dub', 'subtitled'];
    return items.filter(item => {
      try {
        const title = item.title.toLowerCase();
        return englishKeywords.some(keyword => title.includes(keyword));
      } catch (err) {
        return false;
      }
    });
  } catch (err) {
    console.error('Error filtering English anime items:', err.message);
    return [];
  }
}

async function fetchRSSFeedWithRetries(url, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  filterEnglishAnimeItems,
  fetchRSSFeedWithRetries,
};
