const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize,
  MediaGalleryBuilder, MediaGalleryItemBuilder, ThumbnailBuilder,
  MessageFlags
} = require('discord.js');

const FLAG_DEFAULTS = {
  public: { ephemeral: false },
  private: { ephemeral: true }
};

const COLOR_NAMES = {
  red: 0xff0000,
  green: 0x00ff00,
  blue: 0x0000ff,
  yellow: 0xffff00,
  orange: 0xffa500,
  purple: 0x800080,
  pink: 0xffc0cb,
  cyan: 0x00ffff,
  teal: 0x008080,
  white: 0xffffff,
  black: 0x000000,
  gray: 0x808080,
  grey: 0x808080,
};

const resolveAccentColor = (color) => {
  if (Array.isArray(color)) return color;
  if (typeof color === 'number' && Number.isFinite(color)) return color;
  if (typeof color !== 'string') return null;

  const input = color.trim();
  if (!input) return null;

  const named = COLOR_NAMES[input.toLowerCase()];
  if (named !== undefined) return named;

  if (/^0x[\da-f]{1,6}$/i.test(input)) {
    return Number.parseInt(input, 16);
  }

  if (/^#[\da-f]{3}$/i.test(input)) {
    const hex = input.slice(1);
    return Number.parseInt(`${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`, 16);
  }

  if (/^#[\da-f]{6}$/i.test(input)) {
    return Number.parseInt(input.slice(1), 16);
  }

  if (/^[\da-f]{6}$/i.test(input)) {
    return Number.parseInt(input, 16);
  }

  if (/^\d+$/.test(input)) {
    return Number.parseInt(input, 10);
  }

  return null;
};

const buildFlags = ({ flags = 0, ephemeral, componentsV2 = true } = {}) => {
  let out = flags;

  out = ephemeral ? (out | MessageFlags.Ephemeral) : (out & ~MessageFlags.Ephemeral);
  out = componentsV2 ? (out | MessageFlags.IsComponentsV2) : (out & ~MessageFlags.IsComponentsV2);

  return out;
};

const resolveFlags = (extra = {}, defaults) => {
  const {
    flags = 0,
    ephemeral,
    componentsV2,
    ...rest
  } = extra;

  return {
    rest,
    flags: buildFlags({
      flags,
      ephemeral: ephemeral ?? defaults.ephemeral,
      componentsV2,
    }),
  };
};

const interactionPublic = (extra = {}) => {
  const { rest, flags } = resolveFlags(extra, FLAG_DEFAULTS.public);

  return {
    ...rest,
    flags,
  };
};

const v2 = (options = {}) => {
  const c = new ContainerBuilder();
  const accentColor = resolveAccentColor(options.color);
  if (accentColor != null) c.setAccentColor(accentColor);
  if (options.spoiler) c.setSpoiler(true);
  if (options.title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}`));
  if (options.title && (options.desc || options.description)) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  }

  if (options.desc || options.description) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(options.desc || options.description));
  }

  const mediaUrl = options.image || options.thumbnail;

  if (mediaUrl) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(mediaUrl)
      )
    );
  }

  if (options.fields?.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    options.fields.forEach((f) => {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`));
    });
  }

  if (options.footer) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const footerText = typeof options.footer === 'string' ? options.footer : options.footer.text;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerText}`));
  }
  
  return c;
};

const interactionPrivate = (options = {}, extra = {}) => {
  const {
    components,
    ...flagExtra
  } = extra;

  const { rest, flags } = resolveFlags(flagExtra, FLAG_DEFAULTS.private);

  const out = { ...rest };
  const extraComponents = Array.isArray(components)
    ? components
    : components
      ? [components]
      : [];
  out.components = [v2(options), ...extraComponents];
  out.flags = flags;
  return out;
};

module.exports = {
  row: (buttons) => new ActionRowBuilder().addComponents(
    buttons.map(b => new ButtonBuilder()
      .setCustomId(b.id)
      .setLabel(b.label)
      .setStyle(b.style || ButtonStyle.Primary)
      .setDisabled(b.disabled || false))
  ),

  pagination: (current, total) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(current === 1),
    new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(current === total)
  ),

  container: (options = {}) => {
    const c = new ContainerBuilder();
    const accentColor = resolveAccentColor(options.color);
    if (accentColor != null) c.setAccentColor(accentColor);
    if (options.spoiler) c.setSpoiler(true);
    return c;
  },

  section: (texts, accessory) => {
    const s = new SectionBuilder();
    const items = Array.isArray(texts) ? texts : [texts];
    s.addTextDisplayComponents(items.map(t =>
      typeof t === 'string' ? new TextDisplayBuilder().setContent(t) : t
    ));
    if (accessory?.url) s.setThumbnailAccessory(new ThumbnailBuilder().setURL(accessory.url));
    else if (accessory?.customId) s.setButtonAccessory(
      new ButtonBuilder().setCustomId(accessory.customId).setLabel(accessory.label || '').setStyle(accessory.style || ButtonStyle.Primary)
    );
    return s;
  },

  text: (content) => new TextDisplayBuilder().setContent(content),

  separator: (options = {}) => {
    const s = new SeparatorBuilder();
    if (options.divider !== undefined) s.setDivider(options.divider);
    if (options.spacing) s.setSpacing(options.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
    return s;
  },

  thumbnail: (url, options = {}) => {
    const t = new ThumbnailBuilder().setURL(url);
    if (options.description) t.setDescription(options.description);
    if (options.spoiler) t.setSpoiler(true);
    return t;
  },

  gallery: (items) => new MediaGalleryBuilder().addItems(
    items.map(i => {
      const item = new MediaGalleryItemBuilder().setURL(i.url);
      if (i.description) item.setDescription(i.description);
      if (i.spoiler) item.setSpoiler(true);
      return item;
    })
  ),

  v2,
  interactionPrivate,
  interactionPublic
};
