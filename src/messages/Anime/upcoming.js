const { EmbedBuilder } = require('discord.js');
const { fetchDailySchedule, createAnimeEmbed } = require('../../utils/anime-schedule');

module.exports = {
  disabled: false,
  name: 'upcoming',
  description: 'Show the upcoming anime episodes',
  aliases: ['schedule'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const day = args[0]?.toLowerCase();
    const airType = args[1]?.toLowerCase() || 'sub';

    const validDays = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const validTypes = ['sub', 'dub', 'raw'];

    if (!day || !validDays.includes(day)) {
      return message.reply('Usage: `!upcoming <day> [type]`\n**Days:** saturday, sunday, monday, tuesday, wednesday, thursday, friday\n**Types:** sub, dub, raw (default: sub)');
    }

    if (!validTypes.includes(airType)) {
      return message.reply('Invalid air type. Use: sub, dub, or raw');
    }

    const animeData = await fetchDailySchedule(day, airType);

    if (!animeData || animeData.length === 0) {
      return message.reply(`No upcoming anime episodes for ${day.charAt(0).toUpperCase() + day.slice(1)} with air type ${airType}.`);
    }

    const embed = createAnimeEmbed(animeData, 1);
    const totalPages = Math.ceil(animeData.length / 10);
    
    if (totalPages > 1) {
      embed.setFooter({ text: `Page 1/${totalPages} | Use !upcoming ${day} ${airType} to refresh` });
    }

    message.reply({ embeds: [embed] });
  },
};
