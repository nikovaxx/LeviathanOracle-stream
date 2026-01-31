const { Pool } = require('pg');
const config = require('../../config.json');

let pool = null;

// Initialize PostgreSQL connection pool
if (config.database.postgressql?.enabled) {
  pool = new Pool({
    host: config.database.postgressql.config.host,
    port: config.database.postgressql.config.port,
    database: config.database.postgressql.config.database,
    user: config.database.postgressql.config.user,
    password: config.database.postgressql.config.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Create tables on initialization
  pool.query(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      anime_id INTEGER NOT NULL,
      anime_title TEXT NOT NULL,
      next_airing_at BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, anime_id)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL UNIQUE,
      mal_username VARCHAR(255),
      anilist_username VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bot_state (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_watchlists_next_airing ON watchlists(next_airing_at);
  `).catch(err => console.error('Table creation error:', err.message));
}

module.exports = {
  query: (text, params) => pool?.query(text, params),
  getClient: () => pool?.connect(),
  pool,
};
