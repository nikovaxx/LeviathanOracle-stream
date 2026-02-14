const config = require('../../config.json');

const db = config.database.postgresql?.enabled
  ? require('./postgres')
  : require('./sqlite3');

if (config.database.postgresql?.enabled) {
  console.log('\x1b[36mℹ INFO\x1b[0m  │ Using PostgreSQL database.');
} else {
  console.log('\x1b[36mℹ INFO\x1b[0m  │ Using SQLite3 local database. Make sure you have enough disk space.');
}

module.exports = db;
