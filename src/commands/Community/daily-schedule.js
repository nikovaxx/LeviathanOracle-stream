const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../schemas/db');
const { ui } = require('../../functions/ui');
const { getDailyScheduleByDay } = require('../../utils/API-services');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily-schedule')
    .setDescription('Configure automatic daily anime schedule posting')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('enable')
      .setDescription('Enable automatic daily schedule posting')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to post the schedule in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false))
      .addStringOption(o => o
        .setName('time')
        .setDescription('UTC time, supports 24h (17:30) or 12h (5:30 PM)')
        .setRequired(false)))
    .addSubcommand(s => s.setName('disable').setDescription('Disable automatic daily schedule posting'))
    .addSubcommand(s => s.setName('status').setDescription('View current daily schedule settings'))
    .addSubcommand(s => s.setName('preview').setDescription("Preview today's schedule")),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) return interaction.reply(ui.interactionPublic({ content: 'Servers only.', componentsV2: false }));

    await interaction.deferReply(ui.interactionPublic());

    const sub = options.getSubcommand();

    try {
      let response;

      switch (sub) {
        case 'enable':
          const cfg = await getSettings(guild.id);
          const channel = options.getChannel('channel');
          const timeInput = options.getString('time');
          const parsedTime = parseScheduleTimeInput(timeInput);

          if (!parsedTime.valid) {
            return interaction.editReply(ui.interactionPrivate({
              title: 'Invalid Time Format',
              desc: 'Use `HH:mm` (24-hour) or `h[:mm] AM/PM` (12-hour). Examples: `05:00`, `17:30`, `5 PM`, `5:30 PM`.',
              color: 0xFF4444,
            }));
          }

          const existingChannelId = hasConfiguredChannel(cfg?.cid) ? cfg.cid : null;
          const channelId = channel?.id || existingChannelId;
          if (!channelId) {
            return interaction.editReply(ui.interactionPrivate({
              title: 'Channel Required',
              desc: 'Set a channel with `/daily-schedule enable channel:#channel` before enabling without channel.',
              color: 0xFF4444,
            }));
          }

          await updateSettings(guild.id, {
            daily_schedule_channel_id: channelId,
            daily_schedule_enabled: true,
            daily_schedule_time: parsedTime.value,
          });

          response = {
            title: '✅ Daily Schedule Enabled',
            desc: `Posting in <#${channelId}> daily at **${parsedTime.value} UTC** (${format12HourTime(parsedTime.value)}).`,
            color: 0x00FF00,
          };
          break;

        case 'disable':
          await updateSettings(guild.id, { daily_schedule_enabled: false });
          response = { title: '🔕 Daily Schedule Disabled', color: 0xFF4444 };
          break;

        case 'status':
          const statusCfg = await getSettings(guild.id);
          const active = isEnabledValue(statusCfg?.enabled);
          const hasChannel = hasConfiguredChannel(statusCfg?.cid);

          // Guard legacy/invalid state: enabled without a valid channel.
          if (active && !hasChannel) {
            await updateSettings(guild.id, { daily_schedule_enabled: false });
            response = {
              title: '⚠️ Invalid State Repaired',
              desc: 'Daily schedule was enabled without a valid channel. It has been automatically disabled. Set a channel and enable again.',
              color: 0xFFAA00,
            };
            break;
          }

          const scheduleTime = statusCfg?.scheduleTime || '05:00';
          const channelText = hasChannel ? `<#${statusCfg.cid}>` : '`Not set`';
          response = {
            title: 'Daily Schedule Status',
            desc: active
              ? `**Enabled** in ${channelText} at **${scheduleTime} UTC** (${format12HourTime(scheduleTime)}).`
              : `Currently **disabled**. Configured time: **${scheduleTime} UTC** (${format12HourTime(scheduleTime)}).`,
            color: active ? 0x0099ff : 0x808080,
          };
          break;

        case 'preview':
          const previewCard = await buildDailyEmbed();
          return interaction.editReply(previewCard
            ? ui.interactionPrivate(previewCard)
            : ui.interactionPrivate({ title: 'No Schedule', desc: 'Nothing airing today.', color: 0x808080 }));
      }

          await interaction.editReply(ui.interactionPrivate(response));
    } catch (err) {
      console.error('daily-schedule command failed:', err);
      await interaction.editReply({ content: 'An error occurred while updating settings.' });
    }
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function updateSettings(guildId, { daily_schedule_channel_id: cid, daily_schedule_enabled: enabled, daily_schedule_time: scheduleTime = null }) {
  const enabledValue = enabled ? 'true' : 'false';
  const query = `
    INSERT INTO guild_settings (guild_id, daily_schedule_channel_id, daily_schedule_enabled, daily_schedule_time, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (guild_id) DO UPDATE SET 
      daily_schedule_channel_id = COALESCE($2, guild_settings.daily_schedule_channel_id),
      daily_schedule_enabled = $3,
      daily_schedule_time = COALESCE($4, guild_settings.daily_schedule_time),
      updated_at = CURRENT_TIMESTAMP`;
  return db.query(query, [guildId, cid, enabledValue, scheduleTime]);
}

function isEnabledValue(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function hasConfiguredChannel(cid) {
  return typeof cid === 'string' && /^\d+$/.test(cid);
}

async function getSettings(guildId) {
  const { rows } = await db.query(
    `SELECT
       daily_schedule_channel_id AS cid,
       daily_schedule_enabled AS enabled,
       COALESCE(NULLIF(TRIM(daily_schedule_time), ''), '05:00') AS "scheduleTime"
     FROM guild_settings
     WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0];
}

function parseScheduleTimeInput(input) {
  if (!input || !String(input).trim()) {
    return { valid: true, value: '05:00' };
  }

  const raw = String(input).trim();
  const twelveHour = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*([aApP][mM])$/);
  if (twelveHour) {
    let hour = Number.parseInt(twelveHour[1], 10);
    const minute = Number.parseInt(twelveHour[2] || '00', 10);
    const suffix = twelveHour[3].toLowerCase();

    if (hour < 1 || hour > 12) return { valid: false };
    if (suffix === 'pm' && hour !== 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;

    return { valid: true, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  const twentyFourHour = raw.match(/^([01]?\d|2[0-3])(?::([0-5]\d))$/);
  if (twentyFourHour) {
    const hour = Number.parseInt(twentyFourHour[1], 10);
    const minute = Number.parseInt(twentyFourHour[2], 10);
    return { valid: true, value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  return { valid: false };
}

function format12HourTime(hhmm) {
  const [rawHour, rawMinute] = String(hhmm || '05:00').split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute || '00', 10);

  const normalizedHour = Number.isFinite(hour) ? hour : 5;
  const normalizedMinute = Number.isFinite(minute) ? minute : 0;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const hour12 = ((normalizedHour + 11) % 12) + 1;

  return `${hour12}:${String(normalizedMinute).padStart(2, '0')} ${suffix}`;
}

async function buildDailyEmbed() {
  try {
    const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todayData = await getDailyScheduleByDay(todayName, 'all') || [];
    todayData.sort((a, b) => new Date(a.episodeDate) - new Date(b.episodeDate));

    if (!todayData.length) return null;

    return {
      title: `📅 ${todayName}'s Anime Schedule`,
      desc: `**${todayData.length}** shows airing today`,
      fields: todayData.slice(0, 25).map(a => ({
        name: a.english || a.title || 'Unknown Title',
        value: `Ep ${a.episodeNumber ?? '?'} — <t:${Math.floor(new Date(a.episodeDate).getTime() / 1000)}:t>`,
      })),
      color: '#0099ff',
      footer: todayData.length > 25 ? `+${todayData.length - 25} more...` : null,
    };
  } catch (err) {
    console.log('buildDailyEmbed', 'Failed to fetch schedule', err);
    return null;
  }
}

module.exports.buildDailyEmbed = buildDailyEmbed;
