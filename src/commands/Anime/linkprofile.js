const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../schemas/db');
const { embed } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkprofile')
    .setDescription('Link your MAL or AniList account')
    .addSubcommand(s => s.setName('mal').setDescription('Link MAL').addStringOption(o => o.setName('username').setRequired(true).setDescription('MAL username')))
    .addSubcommand(s => s.setName('anilist').setDescription('Link AniList').addStringOption(o => o.setName('username').setRequired(true).setDescription('AniList username'))),

  async execute(interaction) {
    const type = interaction.options.getSubcommand(), name = interaction.options.getString('username');
    const field = `${type}_username`;

    try {
      const { rows } = await db.query(`SELECT user_id FROM user_profiles WHERE ${field} = $1`, [name]);
      if (rows[0] && rows[0].user_id !== interaction.user.id) 
        return interaction.reply({ embeds: [embed({ title: 'Error', desc: `Linked to <@${rows[0].user_id}>`, color: 0xFF0000 })], flags: MessageFlags.Ephemeral });

      await db.query(`INSERT INTO user_profiles (user_id, ${field}) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ${field} = EXCLUDED.${field}`, [interaction.user.id, name]);
      
      interaction.reply({ embeds: [embed({ title: 'Success', desc: `Linked ${type.toUpperCase()}: **${name}**`, color: 0x00FF00 })] });
    } catch (e) {
      console.error(e);
      const msg = { content: 'Error linking profile.', flags: MessageFlags.Ephemeral };
      interaction.replied || interaction.deferred ? await interaction.editReply(msg) : await interaction.reply(msg);
    }
  }
};
