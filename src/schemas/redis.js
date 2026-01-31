const Redis = require('ioredis');
const config = require('../../config.json');

let client = null;

// Initialize Redis client using ioredis
if (config.database.redis?.enabled) {
  client = new Redis({
    host: config.database.redis.config.host,
    port: config.database.redis.config.port,
    password: config.database.redis.config.password || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on('error', (err) => console.error('Redis Client Error:', err.message));
  client.on('connect', () => console.log('Redis client connected'));
  client.on('ready', () => console.log('Redis client ready'));
}

module.exports = {
  get: async (key) => client?.get(key),
  set: async (key, value, options) => {
    if (!client) return null;
    if (options?.EX) {
      return await client.set(key, value, 'EX', options.EX);
    }
    return await client.set(key, value);
  },
  del: async (key) => client?.del(key),
  exists: async (key) => client?.exists(key),
  ping: async () => client?.ping(),
  client,
};
