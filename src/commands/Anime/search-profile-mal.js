const { SlashCommandBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { embed, ui } = require('../../functions/ui');

const getJikan = async (path) => (await axios.get(`https://api.jikan.moe/v4/${path}`)).data.data;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-mal')
    .setDescription('Fetch MyAnimeList user profile')
    .addStringOption(opt => opt.setName('username').setDescription('MAL username').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getString('username');
    await interaction.deferReply();

    try {
      const [u, s] = await Promise.all([getJikan(`users/${user}`), getJikan(`users/${user}/statistics`)]);
      const row = ui.row([
        { id: 'anime', label: 'Fav Anime', style: ButtonStyle.Primary },
        { id: 'manga', label: 'Fav Manga', style: ButtonStyle.Success }
      ]);

      const msg = await interaction.editReply({
        components: [row],
        embeds: [embed({
          title: `${u.username}'s Profile`, url: u.url, thumbnail: u.images.jpg.image_url, color: 0x2e51a2,
          fields: [
            { name: 'Anime', value: `Total: ${s.anime.total_entries}\nScore: ${s.anime.mean_score}`, inline: true },
            { name: 'Manga', value: `Total: ${s.manga.total_entries}\nScore: ${s.manga.mean_score}`, inline: true }
          ]
        })]
      });

      const col = msg.createMessageComponentCollector({ time: 60000 });
      col.on('collect', async i => {
        const favs = (await getJikan(`users/${user}/favorites`))[i.customId] || [];
        if (!favs.length) return i.reply({ content: `No favorites found.`, flags: MessageFlags.Ephemeral });

        const menu = new StringSelectMenuBuilder().setCustomId('sel').setPlaceholder(`Select ${i.customId}`)
          .addOptions(favs.slice(0, 25).map(f => ({ label: f.title.slice(0, 100), value: String(f.mal_id) })));

        const reply = await i.update({ components: [new ActionRowBuilder().addComponents(menu)], fetchReply: true });
        const sel = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
        if (!sel) return;

        const item = await getJikan(`${i.customId}/${sel.values[0]}`);
        sel.reply({ flags: MessageFlags.Ephemeral, embeds: [embed({
          title: item.title, url: item.url, image: item.images.jpg.image_url, color: 0x2e51a2,
          fields: [
            { name: 'Score', value: `${item.score || 'N/A'}`, inline: true },
            { name: i.customId === 'anime' ? 'Episodes' : 'Volumes', value: `${item.episodes || item.volumes || 'N/A'}`, inline: true }
          ]
        })]});
      });
    } catch (e) {
      console.error(e);
      const err = { content: 'User not found or API error.', flags: MessageFlags.Ephemeral };
      interaction.deferred ? await interaction.editReply(err) : await interaction.reply(err);
    }
  }
};
