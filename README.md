# LeviathanOracle V2

A Discord bot built to manage anime watchlists, link user profiles from MyAnimeList and AniList, search for anime/manga details, and fetch English-translated anime from Nyaa. The idea for this bot was given by my friend [baku](https://github.com/maiorikizu) and brought to life by me [Pilot_kun](https://github.com/PilotKun) and [Niko](https://github.com/nikovaxx).

New file structure and code rewrite by [Niko](https://github.com/nikovaxx).

## New in V2

### Core Changes

- Rewritten command system with a clean structure (`commands/`, `messages/`, `events/`, `functions/`, `schemas/`, `utils/`).
- Unified database layer with SQLite3 as the default local database and optional PostgreSQL & MongoDB support.
- Optional Redis caching layer for better API performance.
- Shared UI helper system for embeds/components/modals.
- Improved reliability: consistent error handling across commands.

### Features

- Anime watchlist (add/remove/show) with scheduling support.
- Link and view profiles (MyAnimeList + AniList).
- Search anime/manga details (Jikan/MAL) and browse upcoming episodes.
- Nyaa RSS search for English-translated releases.
- Notification system upgrades: user preferences + role-based notifications.
- Built-in `/report` system.

## Prerequisites

- Node.js v18 or higher
- SQLite3 (default local DB, created automatically on first run)
- PostgreSQL (optional)
- Redis (optional)
- Discord bot token
- AnimeSchedule API token

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PilotKun/LeviathanOracle.git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Create a json file `config.json`
   - SQLite3 is used by default. If you want PostgreSQL and/or Redis, enable them in your config.
   - Copy `example-config.json` to `config.json`
   - Fill in your credentials
```json
{
  "bot": {
    "token": "DISCORD_TOKEN_HERE",  REQUIRED
    "id": "DISCORD_BOT_ID_HERE",  REQUIRED
    "admins": [   REQUIRED, at least ONE
      "DISCORD_ADMIN_ID_1_HERE",
      "DISCORD_ADMIN_ID_2_HERE"
    ],
    "ownerId": [
      "OWNER_DISCORD_ID_HERE",  REQUIRED
      "CO-OWNER_DISCORD_ID_HERE"
    ],
    "developerCommandsServerIds": [
      "DISCORD_DEVELOPER_COMMANDS_SERVER_ID_HERE"
    ],
    "reportChannelId": "REPORT_CHANNEL_ID_HERE"
  },
  "database": {
    "mongodbUrl": "MONGODB_URL_HERE",  LEAVE IT BLANK in the actual config file to avoid errors
    "postgressql": {
      "enabled": false,
      "config": {
        "host": "host",
        "port": 5432,
        "password": "password",
        "database": "database_name",
        "user": "username"
      }
    },
    "redis": {
      "enabled": false,
      "config": {
        "host": "host",
        "port": 6379,
        "password": "password"
      }
    }
  },
  "apitokens": {
    "animeschedule": "ANIMESCHEDULE_API_TOKEN_HERE",  REQUIRED
    "anilist": "ANILIST_API_TOKEN_HERE"  REQUIRED
  },
  "logging": {
    "guildJoinLogsId": "SERVER_JOIN_LOGS_CHANNEL_ID_HERE",
    "guildLeaveLogsId": "SERVER_LEAVE_LOGS_CHANNEL_ID_HERE",
    "commandLogsChannelId": "COMMAND_LOGS_CHANNEL_ID_HERE",
    "errorLogs": "ERROR_LOGS_WEBHOOK_URL_HERE"
  },
  "prefix": {
    "value": "!"
  }
}
```

4. **Setup database**
   - SQLite3 is the default database. Tables are created automatically on first run.
   - Ensure PostgreSQL and Redis are running and enabled in config if you are using them. Otherwise ignore this step.

5. **Start the bot**
   ```bash
   npm start
   ```
   OR
   ```bash
   node .\src\index.js
   ```
   - Commands are automatically registered on startup

## Commands

### Slash Commands

| Command | Description |
|--------|-------------|
| `/watchlist add <title>` | Add anime to your watchlist (autocomplete supported) |
| `/watchlist remove <title>` | Remove anime from your watchlist |
| `/watchlist show` | View your watchlist |
| `/linkprofile mal <username>` | Link your MyAnimeList account |
| `/linkprofile anilist <username>` | Link your AniList account |
| `/linkedprofile` | View your linked profile(s) |
| `/search-anime <anime>` | Search anime details (Jikan / MyAnimeList) |
| `/search-manga <manga>` | Search manga details (Jikan / MyAnimeList) |
| `/search-profile-mal <username>` | View a MyAnimeList profile |
| `/search-profile-anilist <username>` | View an AniList profile |
| `/upcoming` | Browse upcoming episodes (interactive day/type selection) |
| `/nyaa <query>` | Search Nyaa for English-translated anime releases |
| `/ping` | Check bot latency |
| `/preference notification <dm\|server>` | Set how you receive notifications |
| `/preference watchlist <private\|public>` | Set watchlist visibility |
| `/preference view` | View your current preferences |
| `/rolenotification add <role> <anime>` | Subscribe a role to an anime (Manage Roles required) |
| `/rolenotification remove <role> <anime>` | Unsubscribe a role from an anime |
| `/rolenotification list [role]` | List role-based notifications (optionally filter by role) |
| `/report` | Submit a bug report via modal to the configured report channel |

### Prefix Commands

The default prefix is configurable in `config.json`.
Aliases can also be used for ease ouf use.

| Command | Description |
|--------|-------------|
| `!watchlist <add\|remove\|show> [title/ID]` | Manage watchlist (alias: `!wl`) |
| `!upcoming <day> [type]` | View upcoming episodes (alias: `!schedule`) |
| `!nyaa <query>` | Search Nyaa releases (alias: `!torrent`) |
| `!linkprofile <mal\|anilist> <username>` | Link MAL/AniList account (alias: `!link`) |
| `!linkedprofile` | View linked accounts (aliases: `!linked`, `!myprofiles`) |
| `!ping` | Check latency (alias: `!p`) |
| `!preference <notification\|watchlist\|view> [value]` | Manage preferences (aliases: `!pref`, `!settings`) |
| `!rolenotification <add\|remove\|list> <@role> [anime]` | Manage role notifications (aliases: `!rolenoti`, `!rn`) |

## Development

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## License

MIT License - See LICENSE file for details
