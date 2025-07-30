const keepAlive = require('./server.js');
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./database.js');

const token = process.env.BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

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

// رویداد آماده شدن بات + حلقه مدیریت قرعه‌کشی
client.once(Events.ClientReady, readyClient => {
    console.log(`✅ بات به عنوان ${readyClient.user.tag} آنلاین شد!`);

    // هر 15 ثانیه، قرعه‌کشی‌های تمام شده را چک می‌کند
    setInterval(() => {
        const endedGiveaways = db.prepare('SELECT * FROM giveaways WHERE end_time <= ?').all(Date.now());

        endedGiveaways.forEach(async giveaway => {
            const channel = await client.channels.fetch(giveaway.channel_id).catch(console.error);
            if (!channel) return;

            const message = await channel.messages.fetch(giveaway.message_id).catch(console.error);
            if (!message) return;

            const entrants = JSON.parse(giveaway.entrants);
            if (entrants.length === 0) {
                await channel.send(`قرعه‌کشی برای **${giveaway.prize}** به پایان رسید اما هیچ شرکت‌کننده‌ای وجود نداشت!`);
                message.edit({ components: [] }); // حذف دکمه
            } else {
                const winners = [];
                const shuffledEntrants = entrants.sort(() => 0.5 - Math.random());
                for (let i = 0; i < giveaway.winner_count && i < shuffledEntrants.length; i++) {
                    winners.push(`<@${shuffledEntrants[i]}>`);
                }

                const winnerAnnouncement = new EmbedBuilder()
                    .setTitle(`🎉 قرعه کشی به پایان رسید! 🎉`)
                    .setDescription(`**جایزه:** ${giveaway.prize}\n**برندگان:** ${winners.join(', ')}`)
                    .setColor('Green')
                    .setTimestamp();
                
                await channel.send({ content: `تبریک به برندگان! ${winners.join(', ')}`, embeds: [winnerAnnouncement] });
                
                const endedEmbed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(`قرعه کشی تمام شد!\nبرندگان: ${winners.join(', ')}`)
                    .setTimestamp();
                message.edit({ embeds: [endedEmbed], components: [] }); // حذف دکمه
            }

            db.prepare('DELETE FROM giveaways WHERE message_id = ?').run(giveaway.message_id);
        });
    }, 15000);
});

// رویداد اجرای دستورات و دکمه‌ها
client.on(Events.InteractionCreate, async interaction => {
    // مدیریت دکمه قرعه‌کشی
    if (interaction.isButton() && interaction.customId === 'enter_giveaway') {
        const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(interaction.message.id);
        if (!giveaway) {
            return interaction.reply({ content: 'این قرعه‌کشی دیگر فعال نیست.', ephemeral: true });
        }

        let entrants = JSON.parse(giveaway.entrants);
        if (entrants.includes(interaction.user.id)) {
            return interaction.reply({ content: 'شما قبلاً در این قرعه‌کشی شرکت کرده‌اید!', ephemeral: true });
        }

        entrants.push(interaction.user.id);
        db.prepare('UPDATE giveaways SET entrants = ? WHERE message_id = ?').run(JSON.stringify(entrants), interaction.message.id);

        return interaction.reply({ content: 'شما با موفقیت در قرعه‌کشی شرکت کردید!', ephemeral: true });
    }
    
    // مدیریت اسلش کامندها
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'خطایی در اجرای این دستور رخ داد!', ephemeral: true });
    }
});

client.login(token);
keepAlive();