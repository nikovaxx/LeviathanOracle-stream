const { EmbedBuilder } = require('discord.js');
const db = require('../../schemas/database');

module.exports = {
  disabled: false,
  name: 'linkprofile',
  description: 'Link your MAL or AniList account',
  aliases: ['link'],

  async execute(message) {
    const args = message.content.split(' ').slice(1);
    const platform = args[0]?.toLowerCase();
    const username = args.slice(1).join(' ');

    if (!platform || !['mal', 'anilist'].includes(platform)) {
      return message.reply('Usage: `!linkprofile <mal|anilist> <username>`');
    }

    if (!username) {
      return message.reply(`Please provide your ${platform === 'mal' ? 'MyAnimeList' : 'AniList'} username.`);
    }

    const discordId = message.author.id;
    const updateField = platform === 'mal' ? 'mal_username' : 'anilist_username';

    const checkResult = await db.query(
      `SELECT user_id FROM user_profiles WHERE ${updateField} = $1`,
      [username]
    );

    if (checkResult.rows.length > 0 && checkResult.rows[0].user_id !== discordId) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Linking Failed')
        .setDescription(`That username is already linked to <@${checkResult.rows[0].user_id}>.`);
      return message.reply({ embeds: [embed] });
    }

    const selectResult = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [discordId]
    );

    if (selectResult.rows.length > 0) {
      await db.query(
        `UPDATE user_profiles SET ${updateField} = $1 WHERE user_id = $2`,
        [username, discordId]
      );
    } else {
      const malUsername = platform === 'mal' ? username : null;
      const anilistUsername = platform === 'anilist' ? username : null;
      await db.query(
        'INSERT INTO user_profiles (user_id, mal_username, anilist_username) VALUES ($1, $2, $3)',
        [discordId, malUsername, anilistUsername]
      );
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Account Linked')
      .setDescription(`${platform === 'mal' ? 'MyAnimeList' : 'AniList'} account linked: ${username}`);
    message.reply({ embeds: [embed] });
  },
};
