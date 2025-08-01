const Database = require('better-sqlite3');
const db = new Database('economy.db', { verbose: console.log });

function setupDatabase() {
    // جدول کاربران
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
            last_steal TEXT,
            clan_id INTEGER, 
            FOREIGN KEY (clan_id) REFERENCES clans(clan_id)
        )
    `);

    // جدول کلن‌ها
    db.exec(`
        CREATE TABLE IF NOT EXISTS clans (
            clan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            tag TEXT NOT NULL UNIQUE,
            owner_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    `);

    // جدول درخواست‌های عضویت کلن
    db.exec(`
        CREATE TABLE IF NOT EXISTS clan_requests (
            request_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            clan_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL
        )
    `);

    // --- بخش اصلاح شده ---
    // جدول قرعه‌کشی‌ها با تمام ستون‌های لازم
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