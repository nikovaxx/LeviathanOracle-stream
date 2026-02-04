const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { embed } = require('../../functions/ui');
const { findNextSubEpisodeByTitles } = require('../../utils/anime-schedule');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from MyAnimeList/Jikan')
    .addStringOption(o => o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    try {
      const query = interaction.options.getString('anime');
      await interaction.deferReply();
      // 1. Search List (If the query isn't a MAL ID from autocomplete)
      if (!/^\d+$/.test(query)) {
        const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: query, limit: 10 } });
        if (!list?.length) return interaction.editReply('No results found.');

        const fields = list.map((a, i) => ({
          name: `${i + 1}. ${a.title}`,
          value: `ID: \`${a.mal_id}\` | [MyAnimeList](${a.url})`
        }));

        return interaction.editReply({
          embeds: [embed({ title: `Search results for "${query.slice(0, 50)}"`, fields, color: '#00AE86' })]
        });
      }

      // 2. Detail View (For IDs)
      const { data: { data: anime } } = await axios.get(`https://api.jikan.moe/v4/anime/${query}/full`);
      
      // We offload the heavy lifting to the util
      const match = anime.status?.toLowerCase() === 'currently airing' 
        ? await findNextSubEpisodeByTitles([anime.title, anime.title_english, anime.title_japanese])
        : null;

      const nextEpStr = match?.episodeDate
        ? `\n**Next Episode:** Ep ${match.episodeNumber ?? 'TBA'} - <t:${Math.floor(new Date(match.episodeDate).getTime() / 1000)}:f> (<t:${Math.floor(new Date(match.episodeDate).getTime() / 1000)}:R>)`
        : '';

      return interaction.editReply({
        embeds: [embed({
          title: anime.title || anime.title_english,
          desc: `**Score:** ${anime.score || 'N/A'} | **Episodes:** ${anime.episodes || 'N/A'}\n**Status:** ${anime.status}${nextEpStr}\n\n**Synopsis:** ${anime.synopsis?.slice(0, 500) || 'No description available.'}...`,
          image: anime.images?.jpg?.large_image_url,
          color: '#00AE86'
        })]
      });
    } catch (error) {
      console.error('Error in search-anime command:', error);
      const errorMessage = { content: 'An error occurred while executing this command. Please try again later.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage).catch(() => {});
      }
    }
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused();
    if (!value) return interaction.respond([]);

    try {
      const { data: { data: list } } = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: value, limit: 25 }, timeout: 2500 });
      await interaction.respond(list.map(a => ({
        name: `${a.title_english || a.title}${a.year ? ` (${a.year})` : ''}`.slice(0, 100),
        value: String(a.mal_id)
      })));
    } catch {
      await interaction.respond([]);
    }
  }
};
