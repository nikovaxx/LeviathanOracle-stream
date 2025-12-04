import pkg from 'pg';
import Redis from 'ioredis';
import chalk from 'chalk';
import { errorHandler } from '../utils/errorHandler.js';

const { Pool } = pkg;

// Error tracking flags
let postgresErrorLogged = false;
let redisErrorLogged = false;

// Connection status flags
let postgresConnected = false;
let redisConnected = false;

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis Client
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  redisErrorLogged = false;
  redisConnected = true;
});

redis.on('error', (err) => {
  redisConnected = false;
  if (!redisErrorLogged) {
    errorHandler(err, 'Redis Connection Error');
    redisErrorLogged = true;
  }
});

pool.on('connect', () => {
  postgresErrorLogged = false;
  postgresConnected = true;
});

pool.on('error', (err) => {
  postgresConnected = false;
  if (!postgresErrorLogged) {
    errorHandler(err, 'PostgreSQL Pool Error');
    postgresErrorLogged = true;
  }
});

// Wait for both database connections
export async function waitForDatabaseConnections() {
  const maxWaitTime = 10000; // 10 seconds max
  const checkInterval = 100; // Check every 100ms
  let elapsed = 0;

  // Try to connect to PostgreSQL
  try {
    const client = await pool.connect();
    client.release();
    postgresConnected = true;
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green('✓ PostgreSQL') + chalk.white(' Connected!')
    );
  } catch (err) {
    errorHandler(err, 'PostgreSQL Initial Connection');
    throw new Error('Failed to connect to PostgreSQL');
  }

  // Wait for Redis connection
  while (!redisConnected && elapsed < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
  }

  if (redisConnected) {
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green('✓ Redis') + chalk.white(' Connected!')
    );
  } else {
    throw new Error('Redis connection timeout');
  }
}

// Initialize database tables
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        discord_id VARCHAR(20) PRIMARY KEY,
        mal_username VARCHAR(255),
        anilist_username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
        anime_id INTEGER NOT NULL,
        anime_title VARCHAR(500) NOT NULL,
        next_airing_at BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, anime_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
      CREATE INDEX IF NOT EXISTS idx_watchlists_next_airing ON watchlists(next_airing_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        user_id VARCHAR(20) PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
        notification_type VARCHAR(10) DEFAULT 'dm' CHECK(notification_type IN ('dm', 'server')),
        notification_channel_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.green('INFO') + chalk.white('] ') +
      chalk.green('Database Tables') + chalk.white(' Initialized!')
    );
  } catch (err) {
    errorHandler(err, 'Database Initialization Error');
    throw err;
  } finally {
    client.release();
  }
}

// ==================== USER OPERATIONS ====================

export async function createUser(discordId) {
  try {
    await pool.query(
      'INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO NOTHING',
      [discordId]
    );
    return true;
  } catch (err) {
    errorHandler(err, 'Create User Error');
    return false;
  }
}

export async function linkProfile(discordId, platform, username) {
  const field = platform === 'mal' ? 'mal_username' : 'anilist_username';
  try {
    // Check if username already linked to another user
    const checkResult = await pool.query(
      `SELECT discord_id FROM users WHERE ${field} = $1`,
      [username]
    );
    
    if (checkResult.rows.length > 0 && checkResult.rows[0].discord_id !== discordId) {
      return { success: false, error: 'username_taken', existingUser: checkResult.rows[0].discord_id };
    }

    // Ensure user exists
    await createUser(discordId);

    // Update profile
    await pool.query(
      `UPDATE users SET ${field} = $1 WHERE discord_id = $2`,
      [username, discordId]
    );

    return { success: true };
  } catch (err) {
    errorHandler(err, 'Link Profile Error');
    return { success: false, error: 'database_error' };
  }
}

export async function getLinkedProfile(discordId) {
  try {
    const result = await pool.query(
      'SELECT mal_username, anilist_username FROM users WHERE discord_id = $1',
      [discordId]
    );
    return result.rows[0] || null;
  } catch (err) {
    errorHandler(err, 'Get Linked Profile Error');
    return null;
  }
}

// ==================== WATCHLIST OPERATIONS ====================

export async function addToWatchlist(userId, animeId, animeTitle, nextAiringAt) {
  try {
    // Ensure user exists
    await createUser(userId);

    const result = await pool.query(
      `INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, anime_id) DO NOTHING
       RETURNING id`,
      [userId, animeId, animeTitle, nextAiringAt]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'already_exists' };
    }

    return { success: true, watchlistId: result.rows[0].id };
  } catch (err) {
    errorHandler(err, 'Add to Watchlist Error');
    return { success: false, error: 'database_error' };
  }
}

export async function removeFromWatchlist(userId, animeId) {
  try {
    const result = await pool.query(
      'DELETE FROM watchlists WHERE user_id = $1 AND anime_id = $2 RETURNING anime_title',
      [userId, animeId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'not_found' };
    }

    return { success: true, animeTitle: result.rows[0].anime_title };
  } catch (err) {
    errorHandler(err, 'Remove from Watchlist Error');
    return { success: false, error: 'database_error' };
  }
}

export async function getUserWatchlist(userId) {
  try {
    const result = await pool.query(
      'SELECT anime_id, anime_title, next_airing_at FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } catch (err) {
    errorHandler(err, 'Get User Watchlist Error');
    return [];
  }
}

export async function updateNextAiring(watchlistId, nextAiringAt) {
  try {
    await pool.query(
      'UPDATE watchlists SET next_airing_at = $1 WHERE id = $2',
      [nextAiringAt, watchlistId]
    );
    return true;
  } catch (err) {
    errorHandler(err, 'Update Next Airing Error');
    return false;
  }
}

export async function getUpcomingNotifications(timeWindow = 3600000) {
  try {
    const now = Date.now();
    const future = now + timeWindow;
    
    const result = await pool.query(
      `SELECT w.id, w.user_id, w.anime_id, w.anime_title, w.next_airing_at
       FROM watchlists w
       WHERE w.next_airing_at IS NOT NULL 
       AND w.next_airing_at > $1 
       AND w.next_airing_at <= $2
       ORDER BY w.next_airing_at ASC`,
      [now, future]
    );
    
    return result.rows;
  } catch (err) {
    errorHandler(err, 'Get Upcoming Notifications Error');
    return [];
  }
}

export async function getAllScheduledNotifications() {
  try {
    const now = Date.now();
    const result = await pool.query(
      `SELECT w.id, w.user_id, w.anime_id, w.anime_title, w.next_airing_at
       FROM watchlists w
       WHERE w.next_airing_at IS NOT NULL AND w.next_airing_at > $1
       ORDER BY w.next_airing_at ASC`,
      [now]
    );
    return result.rows;
  } catch (err) {
    errorHandler(err, 'Get All Scheduled Notifications Error');
    return [];
  }
}

// ==================== REDIS CACHE OPERATIONS ====================

export async function cacheAnimeData(animeId, data, ttl = 3600) {
  try {
    await redis.setex(`anime:${animeId}`, ttl, JSON.stringify(data));
    return true;
  } catch (err) {
    errorHandler(err, 'Cache Anime Data Error');
    return false;
  }
}

export async function getCachedAnimeData(animeId) {
  try {
    const cached = await redis.get(`anime:${animeId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    errorHandler(err, 'Get Cached Anime Data Error');
    return null;
  }
}

export async function cacheSearchResults(query, results, ttl = 1800) {
  try {
    const key = `search:${query.toLowerCase().replace(/\s+/g, '_')}`;
    await redis.setex(key, ttl, JSON.stringify(results));
    return true;
  } catch (err) {
    errorHandler(err, 'Cache Search Results Error');
    return false;
  }
}

export async function getCachedSearchResults(query) {
  try {
    const key = `search:${query.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    errorHandler(err, 'Get Cached Search Results Error');
    return null;
  }
}

// Rate limiting helper
export async function checkRateLimit(userId, action, limit = 10, window = 60) {
  try {
    const key = `ratelimit:${action}:${userId}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    return current <= limit;
  } catch (err) {
    errorHandler(err, 'Check Rate Limit Error');
    return true; // Allow on error
  }
}

// Cleanup function
export async function cleanup() {
  try {
    await redis.quit();
    await pool.end();
    console.log(
      chalk.gray(` ${String(new Date()).split(" ", 5).join(" ")} `) +
      chalk.white('[') + chalk.yellow('INFO') + chalk.white('] ') +
      chalk.yellow('Database Connections') + chalk.white(' Closed!')
    );
  } catch (err) {
    errorHandler(err, 'Database Cleanup Error');
  }
}

export { pool, redis };
