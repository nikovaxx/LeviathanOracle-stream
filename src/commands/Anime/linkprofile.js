const { SlashCommandBuilder } = require('discord.js');
const db = require('../../schemas/db');
const { embed } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkprofile')
    .setDescription('Link your MAL or AniList account')
    .addSubcommand(s => s.setName('mal').setDescription('Link MAL').addStringOption(o => o.setName('username').setRequired(true).setDescription('MAL username')))
    .addSubcommand(s => s.setName('anilist').setDescription('Link AniList').addStringOption(o => o.setName('username').setRequired(true).setDescription('AniList username'))),

  async execute(interaction) {
    try {
      const type = interaction.options.getSubcommand();
      const name = interaction.options.getString('username');
      const field = type === 'mal' ? 'mal_username' : 'anilist_username';

      // 1. Ownership Check
      const owner = await db.query(`SELECT user_id FROM user_profiles WHERE ${field} = $1`, [name]);
      if (owner.rows[0] && owner.rows[0].user_id !== interaction.user.id) {
        return interaction.reply({ embeds: [embed({ title: 'Error', desc: `Username already linked to <@${owner.rows[0].user_id}>`, color: 0xFF0000 })], ephemeral: true });
      }

      // 2. Upsert (Insert or Update)
      await db.query(`
        INSERT INTO user_profiles (user_id, ${field}) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET ${field} = EXCLUDED.${field}`,
        [interaction.user.id, name]
      );

      interaction.reply({ embeds: [embed({ title: 'Success', desc: `Linked ${type.toUpperCase()}: **${name}**`, color: 0x00FF00 })] });
    } catch (error) {
      console.error('Error in linkprofile command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  },
};
