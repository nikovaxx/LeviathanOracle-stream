const Redis = require('ioredis');
const config = require('../../config.json');

const rdConfig = config.database.redis;

if (!rdConfig?.enabled) {
  console.log('\x1b[36mℹ INFO\x1b[0m  │ Redis is disabled, caching will not be applied.');
}

const client = rdConfig?.enabled ? new Redis({
  ...rdConfig.config,
  retryStrategy: times => Math.min(times * 50, 2000)
}) : null;

if (client) {
  client.on('error', err => console.error('Redis Error:', err.message));
  client.on('ready', () => console.log('Redis connected'));
}

module.exports = {
  get: (key) => client?.get(key),
  set: (key, val, opt) => opt?.EX ? client?.set(key, val, 'EX', opt.EX) : client?.set(key, val),
  del: (key) => client?.del(key),
  exists: (key) => client?.exists(key),
  client,
};
