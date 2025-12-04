# LeviathanOracle V2

A Discord bot for managing anime watchlists with real-time notifications, profile linking, and comprehensive anime/manga search features.

## 🚀 New in V2

### Core Changes
- **PostgreSQL** for structured data storage (5 GB)
- **Redis** for caching and performance optimization (2 GB)
- **node-cron** for precise notification scheduling
- Advanced rate limiting and API optimization
- Modular architecture with clean code structure

### Features
- 📺 **Watchlist Management** - Add/remove anime with autocomplete
- 🔔 **Smart Notifications** - Cron-based episode release notifications
- 🔗 **Profile Linking** - Link MAL and AniList accounts
- 🔍 **Search** - Anime, manga, and user profiles with caching
- 📅 **Schedule** - View upcoming episodes by day
- 🌐 **Nyaa Integration** - English-translated anime torrents

## 📋 Prerequisites

- Node.js v18 or higher
- PostgreSQL database
- Redis server
- Discord bot token
- AnimeSchedule API token (optional)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd "LeviathanOracle (V2)"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env`
   - Fill in your credentials:
     ```env
     DISCORD_BOT_TOKEN=your_bot_token
     CLIENT_ID=your_client_id
     
     POSTGRES_HOST=localhost
     POSTGRES_PORT=5432
     POSTGRES_USER=postgres
     POSTGRES_PASSWORD=your_password
     POSTGRES_DATABASE=leviathan_oracle
     
     REDIS_HOST=localhost
     REDIS_PORT=6379
     REDIS_PASSWORD=
     
     ANIMESCHEDULE_TOKEN=your_token
     ```

4. **Setup database**
   - Ensure PostgreSQL and Redis are running
   - Database tables are created automatically on first run

5. **Start the bot**
   ```bash
   npm start
   ```
   - Commands are automatically registered on startup

## 📂 Project Structure

```
LeviathanOracle (V2)/
├── index.js                 # Main bot entry point (includes command registration)
├── package.json             # Dependencies
├── .env                     # Configuration (create from .env.example)
├── commands/               # Slash commands
│   ├── watchlist.js        # Watchlist management
│   ├── linkprofile.js      # Profile linking
│   ├── linked-profile.js   # View linked profiles
│   ├── search-anime.js     # Anime search
│   ├── search-manga.js     # Manga search
│   ├── search-profile-anilist.js
│   ├── search-profile-mal.js
│   ├── upcoming.js         # Episode schedule
│   ├── nyaa.js            # Nyaa torrents
│   └── ping.js            # Latency check
├── database/
│   └── dbmanager.js       # PostgreSQL & Redis operations
└── utils/
    ├── anilist.js         # AniList API with caching
    ├── anime-schedule.js  # AnimeSchedule API
    ├── nyaaRSS.js        # Nyaa RSS parser
    ├── querry.js         # Additional queries
    ├── errorHandler.js   # Global error handling
    ├── errorHandler.js   # Global error handling
    ├── embeds/
    │   ├── commandembeds.js      # Command response embeds
    │   └── notificationembed.js  # Notification embeds
    └── schedulers/ationScheduler.js  # Cron-based notifications
```

## 🎯 Commands

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

## ⚙️ How It Works

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

## 🔧 Development

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📝 Notes

- All errors are centralized through `errorHandler.js`
- No local SQL database - PostgreSQL only
- Redis is used for all caching operations
- Cron jobs automatically rehydrate on restart
- Commands use autocomplete for better UX

## 🚧 Upcoming Features (Planned)

- Server/DM notification preferences
- Role-based notifications
- Real-time countdown webhooks
- Public/private watchlists
- MAL/AniList import/export

## 📄 License

MIT License - See LICENSE file for details
