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
//               اجرای مایگریشن‌های دیتابیس
// ===================================================
console.log('Checking database migrations...');
try {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE)`);
    const appliedMigrations = db.prepare('SELECT name FROM migrations').all().map(row => row.name);
    const migrationFiles = fs.readdirSync('./migrations').sort();
    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.includes(file));
    if (pendingMigrations.length === 0) {
        console.log('✅ Database is up to date.');
    } else {
        console.log(`Found new migrations: ${pendingMigrations.join(', ')}`);
        for (const file of pendingMigrations) {
            const filePath = path.join('./migrations', file);
            const sql = fs.readFileSync(filePath, 'utf8');
            const runMigration = db.transaction(() => {
                db.exec(sql);
                db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
            });
            runMigration();
            console.log(`✅ Successfully applied migration: ${file}`);
        }
    }
} catch (err) {
    console.error('❌ Failed to apply database migrations:', err);
    process.exit(1);
}

// ===================================================
//        احراز هویت برای سیستم موزیک (play-dl)
// ===================================================
async function authPlayDL() {
    try {
        if (process.env.YT_COOKIE) {
            await play.setToken({ youtube: { cookie: process.env.YT_COOKIE } });
            console.log('✅ Successfully authenticated with YouTube using cookies.');
        } else {
            console.warn('⚠️ YouTube Cookie (YT_COOKIE) not found. Music playback might fail.');
        }
    } catch (e) {
        console.error('❌ Error setting YouTube cookie:', e.message);
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

const xpCooldowns = new Set();

// نقشه رول‌ها بر اساس سطح با آیدی‌های شما
const levelRoles = new Map([
    [5, '1405041828104765605'],
    [10, '1405041875542605854'],
    [15, '1405041914075545671'],
    [20, '1405041953489289316']
]);

// ===================================================
//             مدیریت خطاهای سراسری
// ===================================================
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    const settings = db.prepare('SELECT log_channel_id FROM guild_settings LIMIT 1').get();
    if (!settings || !settings.log_channel_id) return;
    const errorChannel = await client.channels.fetch(settings.log_channel_id).catch(() => null);
    if (errorChannel) {
        const embed = new EmbedBuilder().setTitle('❌ Unhandled Rejection').setDescription(`\`\`\`${reason.stack || reason}\`\`\``).setColor('Red').setTimestamp();
        try { await errorChannel.send({ embeds: [embed] }); } catch (e) { console.error("Error sending error log:", e); }
    }
});
process.on('uncaughtException', async (err, origin) => {
    console.error('Uncaught Exception:', err, 'origin:', origin);
    const settings = db.prepare('SELECT log_channel_id FROM guild_settings LIMIT 1').get();
    if (!settings || !settings.log_channel_id) return;
    const errorChannel = await client.channels.fetch(settings.log_channel_id).catch(() => null);
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
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// ===================================================
//                  رویداد ClientReady
// ===================================================
client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Logged in as ${readyClient.user.tag}!`);

    setInterval(() => {
        const endedGiveaways = db.prepare('SELECT * FROM giveaways WHERE end_time <= ?').all(Date.now());
        endedGiveaways.forEach(async giveaway => {
            const channel = await client.channels.fetch(giveaway.channel_id).catch(console.error);
            if (!channel) { db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id); return; }
            const message = await channel.messages.fetch(giveaway.message_id).catch(console.error);
            if (!message) { db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id); return; }
            const entrants = JSON.parse(giveaway.entrants);
            if (entrants.length === 0) {
                await channel.send(`The giveaway for **${giveaway.prize}** has ended with no participants!`);
                message.edit({ components: [] });
            } else {
                const winners = [];
                const shuffledEntrants = entrants.sort(() => 0.5 - Math.random());
                for (let i = 0; i < giveaway.winner_count && i < shuffledEntrants.length; i++) {
                    winners.push(`<@${shuffledEntrants[i]}>`);
                }
                const winnerAnnouncement = new EmbedBuilder().setTitle(`🎉 Giveaway Ended! 🎉`).setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winners.join(', ')}`).setColor('Green').setTimestamp();
                await channel.send({ content: `Congratulations to the winners! ${winners.join(', ')}`, embeds: [winnerAnnouncement] });
                const endedEmbed = EmbedBuilder.from(message.embeds[0]).setDescription(`Giveaway has ended!\n**Winners:** ${winners.join(', ')}`).setTimestamp();
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
            if (!giveaway) return interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
            let entrants = JSON.parse(giveaway.entrants);
            if (entrants.includes(interaction.user.id)) return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
            entrants.push(interaction.user.id);
            db.prepare('UPDATE giveaways SET entrants = ? WHERE message_id = ?').run(JSON.stringify(entrants), interaction.message.id);
            return interaction.reply({ content: 'You have successfully entered the giveaway!', ephemeral: true });
        }
        if (interaction.customId.startsWith('clan_')) {
            const [action, requestId] = interaction.customId.split('_').slice(1);
            const request = db.prepare('SELECT * FROM clan_requests WHERE request_id = ? AND status = ?').get(requestId, 'pending');
            if (!request) return interaction.update({ content: 'This request is no longer valid or has already been actioned.', components: [] });
            const clan = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(request.clan_id);
            if (clan.owner_id !== interaction.user.id) return interaction.reply({ content: 'You do not have permission to manage this request!', ephemeral: true });
            const transaction = db.transaction(() => {
                if (action === 'accept') {
                    db.prepare('UPDATE users SET clan_id = ? WHERE user_id = ?').run(request.clan_id, request.user_id);
                    db.prepare('UPDATE clan_requests SET status = ? WHERE request_id = ?').run('accepted', requestId);
                    interaction.guild.members.fetch(request.user_id).then(member => {
                        if (member && clan.role_id) {
                            member.roles.add(clan.role_id);
                        }
                    }).catch(console.error);
                    interaction.update({ content: `✅ Join request accepted.`, components: [] });
                    client.users.fetch(request.user_id).then(user => user.send(`Your request to join the clan **${clan.name}** has been approved!`)).catch(console.error);
                } else if (action === 'deny') {
                    db.prepare('UPDATE clan_requests SET status = ? WHERE request_id = ?').run('denied', requestId);
                    interaction.update({ content: `❌ Join request denied.`, components: [] });
                    client.users.fetch(request.user_id).then(user => user.send(`Unfortunately, your request to join the clan **${clan.name}** was denied.`)).catch(console.error);
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
            await interaction.followUp({ content: 'An error occurred while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'An error occurred while executing this command!', ephemeral: true });
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
        console.error("Error creating or sending welcome image:", error);
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
        
        let levelUpMessage = `🎉 تبریک ${message.author}، شما به **سطح ${newLevel}** رسیدید!`;

        if (levelRoles.has(newLevel)) {
            const roleId = levelRoles.get(newLevel);
            try {
                await message.member.roles.add(roleId);
                levelUpMessage += `\nشما به نقش <@&${roleId}> ارتقا یافتید!`;
            } catch (error) {
                console.error(`خطا در اضافه کردن رول جایزه برای سطح ${newLevel}:`, error);
            }
        }
        
        const levelUpChannelId = '1200126756691116113';
        const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        if (levelUpChannel) {
            levelUpChannel.send(levelUpMessage);
        } else {
            message.channel.send(levelUpMessage);
            console.warn(`کانال تبریک سطح با آیدی ${levelUpChannelId} پیدا نشد.`);
        }

        if (userData.clan_id) {
            const clanXpToAdd = 5;
            const clanData = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(userData.clan_id);
            if (clanData) {
                const newClanXp = clanData.xp + clanXpToAdd;
                const xpNeededForClanLevelUp = clanData.level * 500;
                if (newClanXp >= xpNeededForClanLevelUp) {
                    const newClanLevel = clanData.level + 1;
                    const remainingClanXp = newClanXp - xpNeededForClanLevelUp;
                    db.prepare('UPDATE clans SET level = ?, xp = ? WHERE clan_id = ?').run(newClanLevel, remainingClanXp, userData.clan_id);
                    if (levelUpChannel) {
                        levelUpChannel.send(`⚔️ کلن **${clanData.name}** به **سطح ${newClanLevel}** رسید!`);
                    } else {
                        message.channel.send(`⚔️ کلن **${clanData.name}** به **سطح ${newClanLevel}** رسید!`);
                    }
                } else {
                    db.prepare('UPDATE clans SET xp = ? WHERE clan_id = ?').run(newClanXp, userData.clan_id);
                }
            }
        }
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