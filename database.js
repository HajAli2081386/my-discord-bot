const Database = require('better-sqlite3');
const db = new Database('economy.db', { verbose: console.log });

function setupDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            guild_id TEXT NOT NULL,
            name TEXT,
            age INTEGER,
            birth_date TEXT,
            balance INTEGER DEFAULT 0,
            last_daily TEXT,
            last_steal TEXT 
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS giveaways (
            message_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            end_time INTEGER NOT NULL,
            prize TEXT NOT NULL,
            winner_count INTEGER NOT NULL,
            entrants TEXT
        )
    `);

    console.log('✅ جداول با موفقیت چک و آماده شدند.');
}

setupDatabase();
module.exports = db;