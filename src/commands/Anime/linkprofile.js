const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../schemas/database');

module.exports = {
  disabled: false,
  data: new SlashCommandBuilder()
    .setName('linkprofile')
    .setDescription('Link your MAL or AniList account')
    .addSubcommand(subcommand =>
      subcommand
        .setName('mal')
        .setDescription('Link your MyAnimeList account')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your MyAnimeList username')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('anilist')
        .setDescription('Link your AniList account')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your AniList username')
            .setRequired(true))),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');
    const updateField = subcommand === 'mal' ? 'mal_username' : 'anilist_username';

    const checkResult = await db.query(
      `SELECT user_id FROM user_profiles WHERE ${updateField} = $1`,
      [username]
    );

    if (checkResult.rows.length > 0 && checkResult.rows[0].user_id !== discordId) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Linking Failed')
        .setDescription(`That username is already linked to <@${checkResult.rows[0].user_id}>.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
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
      const malUsername = subcommand === 'mal' ? username : null;
      const anilistUsername = subcommand === 'anilist' ? username : null;
      await db.query(
        'INSERT INTO user_profiles (user_id, mal_username, anilist_username) VALUES ($1, $2, $3)',
        [discordId, malUsername, anilistUsername]
      );
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Account Linked')
      .setDescription(`${subcommand === 'mal' ? 'MyAnimeList' : 'AniList'} account linked: ${username}`);
    interaction.reply({ embeds: [embed] });
  },
};
