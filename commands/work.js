const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('کار کنید و مقداری امرالد به دست آورید (هر ۲ ساعت).'),
    async execute(interaction) {
        const user = interaction.user;
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(user.id, guildId);
        if (!userData) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید!', ephemeral: true });
        }

        const cooldown = 2 * 60 * 60 * 1000; // ۲ ساعت به میلی‌ثانیه
        const lastWork = userData.last_work ? new Date(userData.last_work).getTime() : 0;
        const now = Date.now();

        if (now - lastWork < cooldown) {
            const timeLeft = new Date(lastWork + cooldown);
            const timestamp = Math.floor(timeLeft.getTime() / 1000);
            return interaction.reply({ content: `شما به تازگی کار کرده‌اید. زمان بعدی: <t:${timestamp}:R>`, ephemeral: true });
        }

        const earnings = Math.floor(Math.random() * 31) + 20; // درآمد بین ۲۰ تا ۵۰
        const newBalance = userData.balance + earnings;

        db.prepare('UPDATE users SET balance = ?, last_work = ? WHERE user_id = ?').run(newBalance, new Date().toISOString(), user.id);

        await interaction.reply(`شما سخت کار کردید و **${earnings}** ${emeraldEmoji} به دست آوردید!`);
    },
};