const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { embed } = require('../../functions/ui');
const { bestMatch } = require('../../utils/fuzzy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Fetch manga details from MAL')
    .addStringOption(o => o.setName('manga').setDescription('Manga name').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('manga');

    try {
      if (/^\d+$/.test(query)) {
        const { data: { data: m } } = await axios.get(`https://api.jikan.moe/v4/manga/${query}/full`);
        return interaction.editReply({
          embeds: [embed({
            title: m.title || m.title_english,
            desc: `**Score:** ${m.score || 'N/A'} | **Volumes:** ${m.volumes || 'N/A'}\n**Status:** ${m.status}\n\n**Synopsis:** ${m.synopsis?.replace(/<[^>]*>/g, '').slice(0, 500) || 'N/A'}...`,
            image: m.images?.jpg?.large_image_url, color: '#00AE86'
          })]
        });
      }

      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/manga', { params: { q: query, limit: 10 } });
      if (!list?.length) return interaction.editReply('No results found.');

      const ranked = bestMatch(query, list, m => [m.title, m.title_english, m.title_japanese]);
      const fields = (ranked.length ? ranked : list).slice(0, 10).map((m, i) => ({ name: `${i + 1}. ${m.title}`, value: `ID: \`${m.mal_id}\` | [MAL](${m.url})` }));
      
      interaction.editReply({ embeds: [embed({ title: `Search: ${query.slice(0, 50)}`, fields, color: '#00AE86' })] });
    } catch (e) {
      console.error(e);
      const err = { content: 'Error fetching manga.', flags: MessageFlags.Ephemeral };
      interaction.deferred ? await interaction.editReply(err) : await interaction.reply(err);
    }
  },

  async autocomplete(interaction) {
    const val = interaction.options.getFocused();
    if (!val) return interaction.respond([]);
    try {
      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/manga', { params: { q: val, limit: 20 }, timeout: 2000 });
      interaction.respond(list.map(m => ({ 
        name: `${m.title_english || m.title}${m.published?.prop?.from?.year ? ` (${m.published.prop.from.year})` : ''}`.slice(0, 100), 
        value: String(m.mal_id) 
      })));
    } catch { interaction.respond([]); }
  }
};
