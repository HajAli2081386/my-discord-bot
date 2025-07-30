const Database = require('better-sqlite3');
const db = new Database('economy.db', { verbose: console.log });

function setupDatabase() {
    // جدول کاربران با "کد ثبت" خودکار برای سیستم ثبت احوال
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            guild_id TEXT NOT NULL,
            name TEXT,
            age INTEGER,
            birth_date TEXT,
            balance INTEGER DEFAULT 0,
            last_daily TEXT
        )
    `);

    // جدول قرعه‌کشی‌ها برای سیستم Giveaway
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

// این تابع در همان ابتدا اجرا می‌شود تا ساختار دیتابیس را بسازد
setupDatabase();

// ما آبجکت دیتابیس را اکسپورت می‌کنیم تا بقیه فایل‌ها بتوانند از آن استفاده کنند
module.exports = db;