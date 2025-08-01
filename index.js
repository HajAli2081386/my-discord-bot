// ===================================================
//                 فراخوانی ماژول‌ها
// ===================================================
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./database.js');
const keepAlive = require('./server.js');
const play = require('play-dl');
const Canvas = require('@napi-rs/canvas');

// ===================================================
//        احراز هویت برای سیستم موزیک (play-dl)
// ===================================================
async function authPlayDL() {
    try {
        if (process.env.YT_COOKIE) {
            await play.setToken({
                youtube: {
                    cookie: process.env.YT_COOKIE
                }
            });
            console.log('✅ با موفقیت به یوتیوب با کوکی متصل شد.');
        } else {
            console.warn('⚠️ کوکی یوتیوب (YT_COOKIE) پیدا نشد. ممکن است در پخش موزیک مشکل ایجاد شود.');
        }
    } catch (e) {
        console.error('❌ خطا در هنگام تنظیم کوکی یوتیوب:', e.message);
    }
}
authPlayDL();

// ===================================================
//                تنظیمات اصلی بات
// ===================================================
const token = process.env.BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// ===================================================
//                   بارگذاری دستورات
// ===================================================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] دستور در ${filePath} ناقص است.`);
    }
}

// ===================================================
//                  رویداد ClientReady
// ===================================================
client.once(Events.ClientReady, readyClient => {
    console.log(`✅ بات به عنوان ${readyClient.user.tag} آنلاین شد!`);

    // حلقه مدیریت قرعه‌کشی‌ها
    setInterval(() => {
        const endedGiveaways = db.prepare('SELECT * FROM giveaways WHERE end_time <= ?').all(Date.now());

        endedGiveaways.forEach(async giveaway => {
            // ... (منطق کامل قرعه‌کشی)
        });
    }, 15000);
});

// ===================================================
//             رویداد مدیریت تعاملات (Interactions)
// ===================================================
client.on(Events.InteractionCreate, async interaction => {
    // ... (منطق کامل مدیریت دکمه‌ها و اسلش کامندها)
});

// ===================================================
//             تابع و رویداد خوش‌آمدگویی
// ===================================================

// --- بخش اصلاح شده برای ظاهر بهتر عکس ---
async function createWelcomeImage(member) {
    const canvas = Canvas.createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // ۱. کشیدن عکس پس‌زمینه
    const background = await Canvas.loadImage('./background.png');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // ۲. نوشتن نام کاربر
    ctx.font = '35px "Vazirmatn"'; // اندازه فونت کمی تغییر کرد
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    // مختصات متن نام برای قرار گرفتن در بالای عکس
    ctx.fillText(member.user.displayName, canvas.width / 2, 225);

    // ۳. نوشتن متن خوش‌آمدگویی
    ctx.font = '28px "Vazirmatn"';
    // مختصات متن خوش‌آمدگویی برای قرار گرفتن بالای نام
    ctx.fillText(`به سرور ما خوش آمدی`, canvas.width / 2, 185);

    // ۴. کشیدن عکس پروفایل کاربر (به صورت دایره و در مرکز)
    ctx.beginPath();
    // مختصات دایره برای قرار گرفتن در مرکز
    ctx.arc(350, 95, 70, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip(); // ایجاد ماسک دایره‌ای

    const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'png' }));
    // مختصات عکس پروفایل برای پر کردن دایره
    ctx.drawImage(avatar, 280, 25, 140, 140);

    return await canvas.encode('png');
}

client.on(Events.GuildMemberAdd, async member => {
    const welcomeChannelId = '1217486913800376380'; // آیدی کانال را اینجا قرار دهید
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) return;

    try {
        Canvas.GlobalFonts.registerFromPath('./font.ttf', 'Vazirmatn');
        const imageBuffer = await createWelcomeImage(member);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-image.png' });
        
        const welcomeMessage = `سلام ${member}، به سرور ما خوش اومدی! 🎉`;
        welcomeChannel.send({ content: welcomeMessage, files: [attachment] });
    } catch (error) {
        console.error("خطا در ساخت عکس خوش آمدگویی:", error);
    }
});

// ===================================================
//                 ورود بات و اجرا
// ===================================================
client.login(token);
keepAlive();