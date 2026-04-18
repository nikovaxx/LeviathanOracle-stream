const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { getDailyScheduleByDay, getScheduleByType } = require('../../utils/API-services');
const { ui } = require('../../functions/ui');
const db = require('../../schemas/db');
const tracer = require('../../utils/tracer');

const WEEK_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('View upcoming anime episodes')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addSubcommand((sub) => sub
      .setName('week')
      .setDescription('View this week schedule by day and airing type')
      .addStringOption(o => o
        .setName('day')
        .setDescription('Day for This Week filter')
        .setAutocomplete(true)
        .setRequired(true))
      .addStringOption(o => o
        .setName('airing_type')
        .setDescription('Airing type for This Week filter')
        .setRequired(true)
        .addChoices(
          { name: 'Sub', value: 'sub' },
          { name: 'Dub', value: 'dub' },
          { name: 'Raw', value: 'raw' }
        )))
    .addSubcommand((sub) => sub
      .setName('watchlist')
      .setDescription('View upcoming sub schedule for your watchlist anime')),

  async execute(interaction) {
    const mode = interaction.options.getSubcommand();
    const t = tracer.start(`upcoming:${mode}`, { userId: interaction.user.id });

    try {
      const msg = await interaction.deferReply(ui.interactionPublic({ fetchReply: true }));
      let data = [];
      let header = '';

      if (mode === 'week') {
        const dayInput = interaction.options.getString('day', true);
        const airingType = interaction.options.getString('airing_type', true);
        const day = resolveWeekDay(dayInput);

        if (!day || !airingType) {
          return interaction.editReply(ui.interactionPrivate({
            title: 'Missing Options',
            desc: 'For **This Week**, provide both `day` and `airing_type` (Sub, Dub, or Raw).',
          }));
        }

        data = await getDailyScheduleByDay(day, airingType) || [];
        header = `Schedule: **${day}** (${airingType.toUpperCase()})`;
      } else if (mode === 'watchlist') {
        data = await fetchWatchlistData(interaction.user.id);
        header = `Upcoming episodes for your watchlist:`;
      }

      if (!data.length) {
        return interaction.editReply(ui.interactionPrivate({
          title: 'No Results',
          desc: 'No upcoming episodes found.',
          color: '#fff200'
        }, { components: [] }));
      }

      await createPaginator(interaction, msg, data, header);
  t.end(`${mode} rendered`, { count: data.length });

    } catch (e) {
      t.error('Command Error', e);
      const content = 'Error fetching schedule.';
      interaction.deferred
        ? interaction.editReply(ui.interactionPrivate({ title: 'Error', desc: content, color: '#FF0000' }))
        : interaction.reply(ui.interactionPublic({ content, componentsV2: false }));
    }
  },

  async autocomplete(interaction) {
    const mode = interaction.options.getSubcommand();
    if (mode !== 'week') return interaction.respond([]);

    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'day') return interaction.respond([]);

    const query = String(focused.value || '').toLowerCase();
    const matches = WEEK_DAYS
      .filter(day => day.toLowerCase().includes(query))
      .slice(0, 25)
      .map(day => ({ name: day, value: day.toLowerCase() }));

    return interaction.respond(matches);
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWatchlistData(userId) {
  const { rows } = await db.query('SELECT anime_title, anime_id FROM watchlists WHERE user_id = $1', [userId]);
  if (!rows.length) return [];

  const subSchedule = await getScheduleByType('sub').catch(() => []);
  if (!subSchedule.length) return [];

  const now = Date.now();
  const watchlistIds = new Set(
    rows
      .map((entry) => Number.parseInt(entry.anime_id, 10))
      .filter(Number.isFinite)
  );
  const watchlistTitles = rows
    .map((entry) => normalizeTitle(entry.anime_title))
    .filter(Boolean);

  const results = subSchedule.map((entry) => {
    const episodeDateMs = new Date(entry.episodeDate).getTime();
    if (!Number.isFinite(episodeDateMs) || episodeDateMs <= now) return null;

    const scheduleId = Number.parseInt(
      entry.anime_id ?? entry.anilist_id ?? entry.anilistId ?? entry.id,
      10
    );

    const titles = [entry.english, entry.route, entry.title, entry.title_english, entry.title_romaji]
      .map(normalizeTitle)
      .filter(Boolean);

    const hasIdMatch = Number.isFinite(scheduleId) && watchlistIds.has(scheduleId);
    const hasTitleMatch = titles.some((title) =>
      watchlistTitles.some((wanted) => title === wanted || title.includes(wanted) || wanted.includes(title))
    );
    if (!hasIdMatch && !hasTitleMatch) return null;

    const fallbackTitle = rows.find((row) => {
      const rowId = Number.parseInt(row.anime_id, 10);
      if (Number.isFinite(scheduleId) && Number.isFinite(rowId) && rowId === scheduleId) return true;
      const rowTitle = normalizeTitle(row.anime_title);
      return rowTitle && titles.some((value) => value === rowTitle || value.includes(rowTitle) || rowTitle.includes(value));
    })?.anime_title;

    return {
      anime_id: scheduleId,
      title: entry.route || entry.title || entry.english || fallbackTitle || 'Unknown',
      english: entry.english || null,
      episodeDate: new Date(episodeDateMs).toISOString(),
      episodeNumber: entry.episodeNumber ?? entry.episode ?? null,
      _fallbackTitle: fallbackTitle || null,
    };
  });

  return results.filter(Boolean).sort((a, b) => new Date(a.episodeDate) - new Date(b.episodeDate));
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveWeekDay(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return WEEK_DAYS.find(day => day.toLowerCase() === normalized) || null;
}

async function createPaginator(interaction, msg, data, headerText) {
  let page = 1;
  const total = Math.ceil(data.length / 10);

  const getPage = (p, includePagination = true) => ui.interactionPrivate({
      title: 'Upcoming Anime',
      desc: headerText,
      color: '#00AE86',
      fields: data.slice((p - 1) * 10, p * 10).map(a => ({
        name: a.english || a.route || a.title || a._fallbackTitle || 'Unknown',
        value: a.episodeDate 
          ? `**Ep ${a.episodeNumber ?? '?'}** — <t:${Math.floor(new Date(a.episodeDate).getTime() / 1000)}:f> (<t:${Math.floor(new Date(a.episodeDate).getTime() / 1000)}:R>)`
          : 'Date TBA',
      })),
      footer: `Page ${p}/${total} • ${data.length} total`,
    }, {
      components: total > 1 && includePagination ? [ui.pagination(p, total)] : []
    });

  await interaction.editReply(getPage(page));

  if (total <= 1) return;

  const col = msg.createMessageComponentCollector({ time: 120_000 });
  col.on('collect', i => {
    page += i.customId === 'prev' ? -1 : 1;
    i.update(getPage(page));
  });
  col.on('end', () => interaction.editReply(getPage(page, false)).catch(() => {}));
}
