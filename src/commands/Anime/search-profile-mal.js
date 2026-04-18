const { SlashCommandBuilder, ButtonStyle, StringSelectMenuBuilder, ActionRowBuilder, InteractionContextType } = require('discord.js');
const { getMalUserProfile, getMalUserStats, getMalUserFavorites, getAnimeDetailsByMalId, getMangaDetailsByMalId } = require('../../utils/API-services');
const { ui } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-mal')
    .setDescription('Fetch MyAnimeList user profile')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(opt => opt.setName('username').setDescription('MAL username').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getString('username');
    await interaction.deferReply(ui.interactionPublic());

    try {
      const [u, s] = await Promise.all([getMalUserProfile(user), getMalUserStats(user)]);
      if (!u) return interaction.editReply('User not found.');

      const row = ui.row([
        { id: 'anime', label: 'Fav Anime', style: ButtonStyle.Primary },
        { id: 'manga', label: 'Fav Manga', style: ButtonStyle.Success }
      ]);

      const msg = await interaction.editReply(ui.interactionPrivate({
        title: `${u.username}'s Profile`,
        url: u.url,
        thumbnail: u.images.jpg.image_url,
        color: 0x2e51a2,
        fields: [
          { name: 'Anime', value: `Total: ${s.anime.total_entries}\nScore: ${s.anime.mean_score}`, inline: true },
          { name: 'Manga', value: `Total: ${s.manga.total_entries}\nScore: ${s.manga.mean_score}`, inline: true }
        ]
      }, { components: [row] }));

      const col = msg.createMessageComponentCollector({ time: 60000 });
      col.on('collect', async i => {
        const favs = await getMalUserFavorites(user);
        const list = favs?.[i.customId] || [];
        if (!list.length) return i.reply(ui.interactionPublic({ content: 'No favorites found.', componentsV2: false }));

        const menu = new StringSelectMenuBuilder().setCustomId('sel').setPlaceholder(`Select ${i.customId}`)
          .addOptions(list.slice(0, 25).map(f => ({ label: f.title.slice(0, 100), value: String(f.mal_id) })));

        const reply = await i.update({ components: [new ActionRowBuilder().addComponents(menu)], fetchReply: true });
        const sel = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
        if (!sel) return;

        const item = i.customId === 'anime'
          ? await getAnimeDetailsByMalId(sel.values[0])
          : await getMangaDetailsByMalId(sel.values[0]);
        if (!item) return sel.reply(ui.interactionPublic({ content: 'Failed to fetch details.', componentsV2: false }));

        sel.reply(ui.interactionPrivate({
          title: item.title,
          url: item.url,
          image: item.images.jpg.image_url,
          color: 0x2e51a2,
          fields: [
            { name: 'Score', value: `${item.score || 'N/A'}`, inline: true },
            { name: i.customId === 'anime' ? 'Episodes' : 'Volumes', value: `${item.episodes || item.volumes || 'N/A'}`, inline: true }
          ]
        }, { ephemeral: true }));
      });
    } catch (e) {
      console.error(e);
      const err = 'User not found or API error.';
      interaction.deferred
        ? await interaction.editReply(err)
        : await interaction.reply(ui.interactionPublic({ content: err, componentsV2: false }));
    }
  }
};
