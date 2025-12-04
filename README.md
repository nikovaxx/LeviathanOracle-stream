# LeviathanOracle V2

A Discord bot built to manage anime watchlists, link user profiles from MyAnimeList and AniList, search for anime/manga details, and fetch English-translated anime from Nyaa.
The idea for this bot was given by my friend [baku](https://github.com/maiorikizu) and brought to life by [Pilot_kun](https://github.com/PilotKun)(me) and [Nikovax](https://github.com/DisguiseGuy).

Complete code rewrite by [Nikovax](https://github.com/DisguiseGuy) & Original author/owner, [Pilot_kun](https://github.com/PilotKun)

## 🚀 New in V2

### Core Changes
- **PostgreSQL** for structured data storage (5 GB)
- **Redis** for caching and performance optimization (2 GB)
- **node-cron** for precise notification scheduling
- Advanced rate limiting and API optimization
- Global error handler to handle all errors. (Requires webhoook)
- Modular architecture with clean code structure

**NOTE**: Code is in a very early state and maybe bugged and incomplete in some places. V2 is still not being hosted/deployed yet.

## Features

- **Profile Linking & Retrieval**  
  - Link your MyAnimeList or AniList account using the [`/linkprofile`](src/commands/linkprofile.js) command.  
  - View your linked profiles with [`/linkedprofile`](src/commands/linked-profile.js).  
  - Fetch AniList profiles using [`/search-profile-anilist`](src/commands/search-profile-anilist.js) and MyAnimeList profiles using [`/search-profile-mal`](src/commands/search-profile-mal.js). 

- **Anime/Manga Search**  
  - Search for anime details with [`/search-anime`](src/commands/search-anime.js).  
  - Search for manga details with [`/search-manga`](src/commands/search-manga.js).
  - Search for upcoming anime episodes with [`/upcoming`](src/commands/upcoming.js).

- **Watchlist Management**  
  - Add anime to your watchlist using [`/watchlist add`](src/commands/watchlist.js).  
  - Remove anime from your watchlist using [`/watchlist remove`](src/commands/watchlist.js).  
  - Display your current watchlist with [`/watchlist show`](src/commands/watchlist.js).  
  - Automatic checking for upcoming episodes based on users' watchlists and notifying them in DM's.

- **Nyaa Anime Fetching**  
  - Search for English-translated anime torrents from Nyaa using [`/nyaa`](src/commands/nyaa.js).
  - Utility functions for RSS feed parsing and filtering are implemented in [`src/utils/nyaaRSS.js`](src/utils/nyaaRSS.js).

## Resources & Dependencies

- **Discord.js**: For interacting with Discord APIs and handling interactions.
- **Axios**: HTTP client for fetching data from AniList, MyAnimeList (via Jikan API), and Nyaa RSS feeds.
- **ioredis**: Database used for caching.
- **pg**: Database used for storing user profile links and watchlists
- **rss-parser**: For parsing the Nyaa RSS feed (src/utils/nyaaRSS.js).
- **dotenv**: For managing Tokens, passwords and Secrets.
- **node-crone**: For notification jobs.
- **chalk**: For the new implementation of a global error handler in the bot. Also used for logging.

## References & Acknowledgements

- [Discord.js Documentation](https://discord.js.org/#/docs)
- [AniList GraphQL API for Anime search](https://anilist.gitbook.io/anilist-apiv2-docs/)
- [Jikan API for Manga search](https://jikan.moe/)
- [Mangadex API for Manga search](https://api.mangadex.org/docs/)
- [AnimeSchedule API for notification system](https://animeschedule.net/api/v3/documentation)
- [Nyaa Torrent RSS](https://nyaa.si)



