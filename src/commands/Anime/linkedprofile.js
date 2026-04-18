const { SlashCommandBuilder, ButtonStyle, InteractionContextType } = require('discord.js');
const { getMalUserProfile, getMalUserStats, getAniListUserProfile } = require('../../utils/API-services');
const db = require('../../schemas/db');
const { ui } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkedprofile')
    .setDescription('View your linked profile(s)')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction) {
    const { rows: [p] } = await db.query('SELECT * FROM user_profiles WHERE user_id = $1', [interaction.user.id]);
    if (!p) return interaction.reply(ui.interactionPublic({ content: 'No profiles linked.', componentsV2: false }));

    const fetch = {
      mal: async () => {
        const [u, s] = await Promise.all([getMalUserProfile(p.mal_username), getMalUserStats(p.mal_username)]);
        return u ? {
          title: `${u.username}'s MAL`, url: u.url, thumbnail: u.images.jpg.image_url, color: 0x2e51a2,
          fields: [
            { name: 'Anime', value: `Entries: ${s.anime.total_entries}\nScore: ${s.anime.mean_score}\nDays: ${s.anime.days_watched}`, inline: true },
            { name: 'Manga', value: `Entries: ${s.manga.total_entries}\nScore: ${s.manga.mean_score}`, inline: true }
          ]
        } : 'Failed to fetch MAL.';
      },
      ani: async () => {
        const u = await getAniListUserProfile(p.anilist_username);
        return u ? {
          title: `${u.name}'s AniList`, url: `https://anilist.co/user/${u.name}`, thumbnail: u.avatar.large, color: 0x02a9ff,
          fields: [
            { name: 'Anime', value: `Count: ${u.statistics.anime.count}\nScore: ${u.statistics.anime.meanScore}\nDays: ${(u.statistics.anime.minutesWatched / 1440).toFixed(1)}`, inline: true },
            { name: 'Manga', value: `Count: ${u.statistics.manga.count}\nChapters: ${u.statistics.manga.chaptersRead}`, inline: true }
          ]
        } : 'Failed to fetch AniList.';
      }
    };

    try {
      if (p.mal_username && p.anilist_username) {
        const row = ui.row([
          { id: 'mal', label: 'MAL', style: ButtonStyle.Primary },
          { id: 'ani', label: 'AniList', style: ButtonStyle.Primary }
        ]);

        const msg = await interaction.reply(ui.interactionPrivate({
          title: 'Linked Profiles',
          desc: 'Select which profile to view.'
        }, {
          components: [row],
          fetchReply: true,
          ephemeral: false
        }));
        const btn = await msg.awaitMessageComponent({ time: 30000 }).catch(() => null);
        if (!btn) return interaction.editReply(ui.interactionPrivate({
          title: 'Timed Out',
          desc: 'No profile was selected in time.'
        }, { components: [] }));

        const res = await fetch[btn.customId]();
        return btn.update(typeof res === 'string' ? { content: res, components: [] } : ui.interactionPrivate(res, { components: [] }));
      }

      await interaction.deferReply(ui.interactionPublic());
      const res = await fetch[p.mal_username ? 'mal' : 'ani']();
      interaction.editReply(typeof res === 'string' ? res : ui.interactionPrivate(res));
    } catch (e) {
      console.error(e);
      interaction.deferred || interaction.replied ? interaction.editReply('Error.') : interaction.reply('Error.');
    }
  }
};
