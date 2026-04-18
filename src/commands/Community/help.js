const { SlashCommandBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { ui } = require('../../functions/ui');

const HELP_PAGES = {
    help_about: () => ui.v2({
        color: 0x0099ff,
        desc:
            '# LeviathanOracle\n\n' +
            'A Discord bot built to manage your anime experience. Link profiles, track watchlists, and search for your favorite series with ease.\n\n' +
            '### Core Features\n' +
            '• **Anime Watchlist** - Track what you are watching.\n' +
            '• **Profile Linking** - Sync with MyAnimeList & AniList.\n' +
            '• **Search** - Get details for any anime or manga.\n' +
            '• **Schedule** - Stay updated with upcoming episodes.\n\n' +
            '### Credits\n' +
            '• **Developers:** [Pilot_kun](https://github.com/PilotKun) & [Niko](https://github.com/nikovaxx)'
    }),

    help_commands: () => ui.v2({
        color: 0x2ecc71,
        desc:
            '## Slash Commands\n\n' +
            '### Watchlist\n' +
            '• `/watchlist add <title>` - Add to your list\n' +
            '• `/watchlist remove <title>` - Remove from list\n' +
            '• `/watchlist view` - View your watchlist\n' +
            '• `/watchlist view <@User|UserId>` - View others\' public watchlists\n' +
            '• `/watchlist export` - Export your watchlist\n' +
            '• `/watchlist import` - Import your watchlist\n\n' +
            '### Profiles\n' +
            '• `/linkprofile mal <username>` - Link MAL profile\n' +
            '• `/linkprofile anilist <username>` - Link AniList profile\n' +
            '• `/linkedprofile` - View your linked accounts\n' +
            '• `/search-profile-mal <username>` - View MAL profile\n' +
            '• `/search-profile-anilist <username>` - View AniList profile\n\n' +
            '### Anime & Manga\n' +
            '• `/search-anime <anime>` - Search anime details\n' +
            '• `/search-manga <manga>` - Search manga details\n' +
            '• `/upcoming watchlist` - Watchlist release schedule\n' +
            '• `/upcoming week <day> <airing_type>` - Weekly anime schedule\n' +
            '• `/nyaa <query>` - Search Nyaa torrents\n\n' +
            '### System\n' +
            '• `/ping` - Check bot latency\n' +
            '• `/set-levelrole <@role>` - Set required role for bot commands\n' +
            '• `/preference notification <dm|server>` - Set notification delivery\n' +
            '• `/preference watchlist <private|public>` - Set watchlist visibility\n' +
            '• `/preference view` - View your current preferences\n' +
            '• `/rolenotification add <role> <anime>` - Subscribe a role\n' +
            '• `/rolenotification remove <role> <anime>` - Unsubscribe a role\n' +
            '• `/rolenotification list [role]` - List role-based notifications\n' +
            '• `/report` - Submit a bug report'
    })
};

module.exports = {
    disabled: false,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays information about the bot and its commands.'),

    async execute(interaction) {
        const buttonRow = ui.row([
            { id: 'help_about', label: 'About', style: ButtonStyle.Primary },
            { id: 'help_commands', label: 'Slash Commands', style: ButtonStyle.Success },
        ]);

        await interaction.deferReply(ui.interactionPublic({ ephemeral: false }));

        const response = await interaction.editReply(
            ui.interactionPublic({
                components: [HELP_PAGES['help_about'](), buttonRow],
                ephemeral: false
            })
        );

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300_000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply(ui.interactionPublic({ content: 'Use the command yourself to interact!', componentsV2: false }));
            }

            await i.update(
                ui.interactionPublic({
                    components: [HELP_PAGES[i.customId](), buttonRow],
                    ephemeral: false
                })
            );
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};