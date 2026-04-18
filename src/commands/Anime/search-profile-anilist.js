const { SlashCommandBuilder, ButtonStyle, StringSelectMenuBuilder, ActionRowBuilder, InteractionContextType } = require('discord.js');
const { getAniListUserProfile } = require('../../utils/API-services');
const { ui } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-anilist')
    .setDescription('Fetch AniList user profile')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addStringOption(o => o.setName('username').setDescription('AniList username').setRequired(true)),

  async execute(interaction) {
    try {
      const u = await getAniListUserProfile(interaction.options.getString('username'));
      if (!u) return interaction.reply(ui.interactionPublic({ content: 'User not found.', componentsV2: false }));

      const { anime: a, manga: m } = u.statistics;
      const row = ui.row([
        { id: 'fav_anime', label: 'Fav Anime', style: ButtonStyle.Primary },
        { id: 'fav_manga', label: 'Fav Manga', style: ButtonStyle.Success }
      ]);

      const msg = await interaction.reply(ui.interactionPrivate({
        title: `${u.name}'s Profile`,
        url: `https://anilist.co/user/${u.name}`,
        thumbnail: u.avatar.large,
        color: 0x2e51a2,
        fields: [
          { name: 'Anime', value: `Count: ${a.count}\nScore: ${a.meanScore}\nDays: ${(a.minutesWatched / 1440).toFixed(1)}`, inline: true },
          { name: 'Manga', value: `Count: ${m.count}\nChapters: ${m.chaptersRead}`, inline: true }
        ]
      }, { components: [row], fetchReply: true, ephemeral: true }));

      const col = msg.createMessageComponentCollector({ time: 60000 });
      col.on('collect', async i => {
        const type = i.customId.split('_')[1], list = u.favourites?.[type]?.nodes || [];
        if (!list.length) return i.reply(ui.interactionPublic({ content: 'No favorites.', componentsV2: false }));

        const menu = new StringSelectMenuBuilder().setCustomId('sel').setPlaceholder(`Select ${type}`)
          .addOptions(list.slice(0, 25).map(x => ({ label: (x.title.english || x.title.romaji).slice(0, 100), value: String(x.id) })));

        const reply = await i.update({ components: [new ActionRowBuilder().addComponents(menu)], fetchReply: true });
        const sel = await reply.awaitMessageComponent({ time: 30000 }).catch(() => null);
        if (!sel) return;

        const item = list.find(x => String(x.id) === sel.values[0]);
        sel.reply(ui.interactionPrivate({
          title: item.title.english || item.title.romaji,
          url: `https://anilist.co/${type}/${item.id}`,
          image: item.coverImage.large,
          color: 0x2e51a2,
          fields: [{ name: 'Score', value: `${item.averageScore || 'N/A'}%`, inline: true }]
        }, { ephemeral: true }));
      });
    } catch (e) {
      console.error(e);
      const err = 'Error fetching profile.';
      interaction.replied || interaction.deferred
        ? await interaction.editReply(err)
        : await interaction.reply(ui.interactionPublic({ content: err, componentsV2: false }));
    }
  }
};
