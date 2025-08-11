const Database = require('better-sqlite3');

// یک فایل دیتابیس به نام economy.db می‌سازد یا به آن متصل می‌شود
const db = new Database('economy.db');

// این تنظیم عملکرد دیتابیس را در عملیات نوشتن بهبود می‌بخشد
db.pragma('journal_mode = WAL');

// آبجکت دیتابیس را برای استفاده در فایل‌های دیگر اکسپورت می‌کند
module.exports = db;