-- Up: این بخش دستورات اصلی را شامل می‌شود

CREATE TABLE IF NOT EXISTS users (
    registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,
    name TEXT,
    age INTEGER,
    birth_date TEXT,
    balance INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    last_daily TEXT,
    last_steal TEXT,
    last_work TEXT,
    last_crime TEXT,
    clan_id INTEGER
);

CREATE TABLE IF NOT EXISTS clans (
    clan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    tag TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    balance INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clan_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    clan_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    end_time INTEGER NOT NULL,
    prize TEXT NOT NULL,
    winner_count INTEGER NOT NULL,
    entrants TEXT
);

CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT,
    log_channel_id TEXT
);

-- Down: این بخش برای بازگرداندن تغییرات است که در این سیستم ساده به آن نیازی نداریم