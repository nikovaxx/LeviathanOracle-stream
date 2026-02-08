const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { embed } = require('../../functions/ui');
const { findNextSubEpisodeByTitles } = require('../../utils/anime-schedule');
const { bestMatch } = require('../../utils/fuzzy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from MyAnimeList/Jikan')
    .addStringOption(o => o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('anime');

    try {
      if (!/^\d+$/.test(query)) {
        const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: query, limit: 10 } });
        if (!list?.length) return interaction.editReply('No results found.');

        const ranked = bestMatch(query, list, a => [a.title, a.title_english, a.title_japanese]);
        const fields = (ranked.length ? ranked : list).slice(0, 10).map((a, i) => ({ name: `${i + 1}. ${a.title}`, value: `ID: \`${a.mal_id}\` | [MAL](${a.url})` }));
        return interaction.editReply({ embeds: [embed({ title: `Search: ${query.slice(0, 50)}`, fields, color: '#00AE86' })] });
      }

      const { data: { data: a } } = await axios.get(`https://api.jikan.moe/v4/anime/${query}/full`);
      const match = a.status?.toLowerCase().includes('airing') ? await findNextSubEpisodeByTitles([a.title, a.title_english, a.title_japanese]) : null;
      const time = match ? Math.floor(new Date(match.episodeDate).getTime() / 1000) : null;
      const next = time ? `\n**Next:** Ep ${match.episodeNumber ?? 'TBA'} - <t:${time}:f> (<t:${time}:R>)` : '';

      interaction.editReply({
        embeds: [embed({
          title: a.title || a.title_english,
          desc: `**Score:** ${a.score || 'N/A'} | **Episodes:** ${a.episodes || 'N/A'}\n**Status:** ${a.status}${next}\n\n**Synopsis:** ${a.synopsis?.slice(0, 450) || 'N/A'}...`,
          image: a.images?.jpg?.large_image_url, color: '#00AE86'
        })]
      });
    } catch (e) {
      console.error(e);
      const err = { content: 'Error fetching anime.', flags: MessageFlags.Ephemeral };
      interaction.deferred ? await interaction.editReply(err) : await interaction.reply(err);
    }
  },

  async autocomplete(interaction) {
    const val = interaction.options.getFocused();
    if (!val) return interaction.respond([]);
    try {
      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: val, limit: 25 }, timeout: 2000 });
      interaction.respond(list.map(a => ({ name: `${a.title_english || a.title}${a.year ? ` (${a.year})` : ''}`.slice(0, 100), value: String(a.mal_id) })));
    } catch { interaction.respond([]); }
  }
};
