const { SlashCommandBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { fetchAniListUser } = require('../../utils/querry');
const db = require('../../schemas/db');
const { embed, ui } = require('../../functions/ui');

module.exports = {
  data: new SlashCommandBuilder().setName('linkedprofile').setDescription('View your linked profile(s)'),

  async execute(interaction) {
    try {
      const { rows } = await db.query('SELECT * FROM user_profiles WHERE user_id = $1', [interaction.user.id]);
      if (!rows.length) return interaction.reply({ content: 'No profiles linked.', ephemeral: true });

    const { mal_username: mal, anilist_username: ani } = rows[0];

    const fetchers = {
      mal: async () => {
        const { data: u } = await axios.get(`https://api.jikan.moe/v4/users/${mal}`);
        const { data: s } = await axios.get(`https://api.jikan.moe/v4/users/${mal}/statistics`);
        return embed({
          title: `${u.data.username}'s MAL`, url: u.data.url, thumbnail: u.data.images.jpg.image_url, color: 0x2e51a2,
          fields: [
            { name: 'Anime', value: `Entries: ${s.data.anime.total_entries}\nScore: ${s.data.anime.mean_score}\nDays: ${s.data.anime.days_watched}`, inline: true },
            { name: 'Manga', value: `Entries: ${s.data.manga.total_entries}\nScore: ${s.data.manga.mean_score}`, inline: true }
          ]
        });
      },
      ani: async () => {
        const u = await fetchAniListUser(ani);
        return u ? embed({
          title: `${u.name}'s AniList`, url: `https://anilist.co/user/${u.name}`, thumbnail: u.avatar.large, color: 0x02a9ff,
          fields: [
            { name: 'Anime', value: `Count: ${u.statistics.anime.count}\nScore: ${u.statistics.anime.meanScore}\nDays: ${(u.statistics.anime.minutesWatched / 1440).toFixed(1)}`, inline: true },
            { name: 'Manga', value: `Count: ${u.statistics.manga.count}\nChapters: ${u.statistics.manga.chaptersRead}`, inline: true }
          ]
        }) : 'Failed to fetch AniList.';
      }
    };

    if (mal && ani) {
      const row = ui.row([
        { id: 'mal', label: 'MyAnimeList', style: ButtonStyle.Primary },
        { id: 'ani', label: 'AniList', style: ButtonStyle.Primary }
      ]);
      const msg = await interaction.reply({ content: 'Choose a profile:', components: [row], ephemeral: true, fetchReply: true });
      const i = await msg.awaitMessageComponent({ time: 30000 }).catch(() => null);
      if (!i) return interaction.editReply({ content: 'Timed out.', components: [] });
      
      const result = await fetchers[i.customId]();
      return i.update({ content: typeof result === 'string' ? result : null, embeds: typeof result === 'object' ? [result] : [], components: [] });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await fetchers[mal ? 'mal' : 'ani']();
    interaction.editReply({ embeds: typeof result === 'object' ? [result] : [], content: typeof result === 'string' ? result : null });
    } catch (error) {
      console.error('Error in linkedprofile command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  }
};
