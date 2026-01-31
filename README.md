# LeviathanOracle V2

A Discord bot for managing anime watchlists with real-time notifications, profile linking, and comprehensive anime/manga search features.

## New in V2

### Core Changes
- **PostgreSQL** for structured data storage (5 GB)
- **Redis** for caching and performance optimization (2 GB)
- **node-cron** for precise notification scheduling
- Advanced rate limiting and API optimization
- Modular architecture with clean code structure

### Features
- **Watchlist Management** - Add/remove anime with autocomplete
- **Smart Notifications** - Cron-based episode release notifications
- **Profile Linking** - Link MAL and AniList accounts
- **Search** - Anime, manga, and user profiles with caching
- **Schedule** - View upcoming episodes by day
- **Nyaa Integration** - English-translated anime torrents

## Prerequisites

- Node.js v18 or higher
- PostgreSQL database
- Redis server
- Discord bot token
- AnimeSchedule API token

## Installation

1. **Clone the repository**
   ```bash
   cd "LeviathanOracle (V2)"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Create a json file `config.json`
   - Copy `example-config.json` to `config.json`
   - Fill in your credentials
```json
{
  "bot": {
    "token": "DISCORD_TOKEN_HERE",  [Required]
    "id": "DISCORD_BOT_ID_HERE",  [Required]
    "admins": [
      "DISCORD_ADMIN_ID_1_HERE",  [At least one required]
      "DISCORD_ADMIN_ID_2_HERE"
    ],
    "ownerId": "DISCORD_OWNER_ID_HERE",  [Required]
    "developerCommandsServerIds": [
      "DISCORD_DEVELOPER_COMMANDS_SERVER_ID_HERE"
    ]
  },
  "database": {
    "mongodbUrl": "MONGODB_URL_HERE",
    "postgressql": {
      "enabled": false,
      "config": {
        "host": "host",
        "port": 1234,
        "database": "databse name",
        "user": "username"
      }
    },
    "redis": {
      "enabled": false,
      "config": {
        "host": "host",
        "port": 1234,
        "password": "password"
      }
    }
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
   - Ensure PostgreSQL and Redis are running
   - Database tables are created automatically on first run

5. **Start the bot**
   ```bash
   npm start
   ```
   - Commands are automatically registered on startup

## Commands

| Command | Description |
|---------|-------------|
| `/watchlist add <title>` | Add anime to watchlist with autocomplete |
| `/watchlist remove <title>` | Remove anime from watchlist |
| `/watchlist show` | View your watchlist |
| `/linkprofile mal <username>` | Link MyAnimeList account |
| `/linkprofile anilist <username>` | Link AniList account |
| `/linked-profile` | View your linked profiles |
| `/search-anime <title>` | Search for anime details |
| `/search-manga <title>` | Search for manga details |
| `/search-profile-anilist <username>` | View AniList profile |
| `/search-profile-mal <username>` | View MAL profile |
| `/upcoming <day> [type]` | View upcoming episodes |
| `/nyaa` | Get English-translated anime from Nyaa |
| `/ping` | Check bot latency |

## How It Works

### Notification System
1. User adds anime to watchlist
2. Next airing time is fetched and stored in PostgreSQL
3. Cron job schedules notification using `node-cron`
4. Hourly job updates anime schedules for delays/changes
5. Notification sent via DM when episode airs

### Caching Strategy
- **Redis TTL:**
  - Anime details: 1 hour
  - Search results: 30 minutes
  - Schedule data: 5 minutes
  - User profiles: 15 minutes

### Rate Limiting
- Autocomplete: 20 requests per 10 seconds
- Search commands: 10 requests per 60 seconds
- Prevents API abuse and ensures stability

## Development

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Notes

- No local SQL database - PostgreSQL only
- Redis is used for all caching operations
- Cron jobs automatically rehydrate on restart
- Commands use autocomplete for better UX

## License

MIT License - See LICENSE file for details

