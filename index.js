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
            console.warn('⚠️ کوکی یوتیوب (YT_COOKIE) پیدا نشد.');
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

// متغیر برای مدیریت کول‌داون XP
const xpCooldowns = new Set();

// ===================================================
//             مدیریت خطاهای سراسری
// ===================================================
const errorChannelId = process.env.ERROR_LOG_CHANNEL_ID; 

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (!errorChannelId) return;
    const errorChannel = await client.channels.fetch(errorChannelId).catch(() => null);
    if (errorChannel) {
        const embed = new EmbedBuilder().setTitle('❌ Unhandled Rejection').setDescription(`\`\`\`${reason.stack || reason}\`\`\``).setColor('Red').setTimestamp();
        try { await errorChannel.send({ embeds: [embed] }); } catch (e) { console.error("Error sending error log:", e); }
    }
});

process.on('uncaughtException', async (err, origin) => {
    console.error('Uncaught Exception:', err, 'origin:', origin);
    if (!errorChannelId) return;
    const errorChannel = await client.channels.fetch(errorChannelId).catch(() => null);
    if (errorChannel) {
        const embed = new EmbedBuilder().setTitle('💥 Uncaught Exception').setDescription(`\`\`\`${err.stack || err}\`\`\``).setColor('Red').setTimestamp();
        try { await errorChannel.send({ embeds: [embed] }); } catch (e) { console.error("Error sending error log:", e); }
    }
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
            const channel = await client.channels.fetch(giveaway.channel_id).catch(console.error);
            if (!channel) { db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id); return; }
            const message = await channel.messages.fetch(giveaway.message_id).catch(console.error);
            if (!message) { db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id); return; }
            const entrants = JSON.parse(giveaway.entrants);
            if (entrants.length === 0) {
                await channel.send(`قرعه‌کشی برای **${giveaway.prize}** به پایان رسید اما هیچ شرکت‌کننده‌ای وجود نداشت!`);
                message.edit({ components: [] });
            } else {
                const winners = [];
                const shuffledEntrants = entrants.sort(() => 0.5 - Math.random());
                for (let i = 0; i < giveaway.winner_count && i < shuffledEntrants.length; i++) {
                    winners.push(`<@${shuffledEntrants[i]}>`);
                }
                const winnerAnnouncement = new EmbedBuilder().setTitle(`🎉 قرعه کشی به پایان رسید! 🎉`).setDescription(`**جایزه:** ${giveaway.prize}\n**برندگان:** ${winners.join(', ')}`).setColor('Green').setTimestamp();
                await channel.send({ content: `تبریک به برندگان! ${winners.join(', ')}`, embeds: [winnerAnnouncement] });
                const endedEmbed = EmbedBuilder.from(message.embeds[0]).setDescription(`قرعه کشی تمام شد!\n**برندگان:** ${winners.join(', ')}`).setTimestamp();
                message.edit({ embeds: [endedEmbed], components: [] });
            }
            db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id);
        });
    }, 15000);
});

// ===================================================
//             رویداد مدیریت تعاملات (Interactions)
// ===================================================
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'enter_giveaway') {
            const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(interaction.message.id);
            if (!giveaway) return interaction.reply({ content: 'این قرعه‌کشی دیگر فعال نیست.', ephemeral: true });
            let entrants = JSON.parse(giveaway.entrants);
            if (entrants.includes(interaction.user.id)) return interaction.reply({ content: 'شما قبلاً در این قرعه‌کشی شرکت کرده‌اید!', ephemeral: true });
            entrants.push(interaction.user.id);
            db.prepare('UPDATE giveaways SET entrants = ? WHERE message_id = ?').run(JSON.stringify(entrants), interaction.message.id);
            return interaction.reply({ content: 'شما با موفقیت در قرعه‌کشی شرکت کردید!', ephemeral: true });
        }
        if (interaction.customId.startsWith('clan_')) {
            const [action, requestId] = interaction.customId.split('_').slice(1);
            const request = db.prepare('SELECT * FROM clan_requests WHERE request_id = ? AND status = ?').get(requestId, 'pending');
            if (!request) return interaction.update({ content: 'این درخواست دیگر معتبر نیست.', components: [] });
            const clan = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(request.clan_id);
            if (clan.owner_id !== interaction.user.id) return interaction.reply({ content: 'شما اجازه مدیریت این درخواست را ندارید!', ephemeral: true });
            const transaction = db.transaction(() => {
                if (action === 'accept') {
                    db.prepare('UPDATE users SET clan_id = ? WHERE user_id = ?').run(request.clan_id, request.user_id);
                    db.prepare('UPDATE clan_requests SET status = ? WHERE request_id = ?').run('accepted', requestId);
                    interaction.update({ content: `✅ درخواست عضویت قبول شد.`, components: [] });
                    client.users.fetch(request.user_id).then(user => user.send(`درخواست عضویت شما در کلن **${clan.name}** تایید شد!`)).catch(console.error);
                } else if (action === 'deny') {
                    db.prepare('UPDATE clan_requests SET status = ? WHERE request_id = ?').run('denied', requestId);
                    interaction.update({ content: `❌ درخواست عضویت رد شد.`, components: [] });
                    client.users.fetch(request.user_id).then(user => user.send(`متاسفانه درخواست عضویت شما در کلن **${clan.name}** رد شد.`)).catch(console.error);
                }
            });
            transaction();
            return;
        }
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'خطایی در اجرای این دستور رخ داد!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'خطایی در اجرای این دستور رخ داد!', ephemeral: true });
        }
    }
});

// ===================================================
//             تابع و رویداد خوش‌آمدگویی
// ===================================================
Canvas.GlobalFonts.registerFromPath('./font.ttf', 'Vazirmatn');

async function createWelcomeImage(member) {
    const canvas = Canvas.createCanvas(735, 490);
    const ctx = canvas.getContext('2d');
    const background = await Canvas.loadImage('./background.png');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '50px "Vazirmatn"';
    ctx.fillText(`خوش آمدی`, canvas.width / 2, 350);
    ctx.font = '60px "Vazirmatn"';
    ctx.fillText(member.user.displayName, canvas.width / 2, 420);
    ctx.beginPath();
    ctx.arc(367.5, 175, 125, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'png' }));
    ctx.drawImage(avatar, 242.5, 50, 250, 250);
    return await canvas.encode('png');
}

client.on(Events.GuildMemberAdd, async member => {
    const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(member.guild.id);
    if (!settings || !settings.welcome_channel_id) return;
    const welcomeChannel = member.guild.channels.cache.get(settings.welcome_channel_id);
    if (!welcomeChannel) return;

    try {
        const imageBuffer = await createWelcomeImage(member);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-image.png' });
        const welcomeMessage = `سلام ${member}، به سرور ما خوش اومدی! 🎉`;
        welcomeChannel.send({ content: welcomeMessage, files: [attachment] });
    } catch (error) {
        console.error("خطا در ساخت یا ارسال عکس خوش آمدگویی:", error);
    }
});

// ===================================================
//              رویداد کسب XP (سیستم Leveling)
// ===================================================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(message.author.id, message.guild.id);
    if (!userData) return;

    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    if (xpCooldowns.has(cooldownKey)) return;

    const xpToAdd = Math.floor(Math.random() * 11) + 15;
    const newXp = userData.xp + xpToAdd;
    const xpNeededForNextLevel = userData.level * 150;

    if (newXp >= xpNeededForNextLevel) {
        const newLevel = userData.level + 1;
        const remainingXp = newXp - xpNeededForNextLevel;
        db.prepare('UPDATE users SET level = ?, xp = ? WHERE user_id = ? AND guild_id = ?').run(newLevel, remainingXp, message.author.id, message.guild.id);
        message.channel.send(`🎉 تبریک ${message.author}، شما به **سطح ${newLevel}** رسیدید!`);
    } else {
        db.prepare('UPDATE users SET xp = ? WHERE user_id = ? AND guild_id = ?').run(newXp, message.author.id, message.guild.id);
    }
    
    xpCooldowns.add(cooldownKey);
    setTimeout(() => {
        xpCooldowns.delete(cooldownKey);
    }, 60000);
});

// ===================================================
//                 ورود بات و اجرا
// ===================================================
client.login(token);
keepAlive();