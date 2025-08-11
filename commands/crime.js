const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('یک کار خلاف انجام دهید (ریسک بالا، پاداش بالا).'),
    async execute(interaction) {
        const user = interaction.user;
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(user.id, guildId);
        if (!userData) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید!', ephemeral: true });
        }
        
        const cooldown = 4 * 60 * 60 * 1000; // ۴ ساعت به میلی‌ثانیه
        const lastCrime = userData.last_crime ? new Date(userData.last_crime).getTime() : 0;
        const now = Date.now();

        if (now - lastCrime < cooldown) {
            const timeLeft = new Date(lastCrime + cooldown);
            const timestamp = Math.floor(timeLeft.getTime() / 1000);
            return interaction.reply({ content: `شما به تازگی جرمی مرتکب شده‌اید. زمان بعدی: <t:${timestamp}:R>`, ephemeral: true });
        }

        const fineAmount = 200;
        if (userData.balance < fineAmount) {
            return interaction.reply({ content: `شما برای انجام جرم حداقل به ${fineAmount} ${emeraldEmoji} نیاز دارید تا در صورت شکست جریمه را بپردازید.`, ephemeral: true });
        }

        const successChance = 0.35; // 35% شانس موفقیت
        const random = Math.random();
        
        db.prepare('UPDATE users SET last_crime = ? WHERE user_id = ?').run(new Date().toISOString(), user.id);

        if (random < successChance) {
            const earnings = Math.floor(Math.random() * 201) + 100; // درآمد بین ۱۰۰ تا ۳۰۰
            const newBalance = userData.balance + earnings;
            db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, user.id);
            await interaction.reply(`💰 **موفق شدی!** شما از یک بانک سرقت کردی و **${earnings}** ${emeraldEmoji} به جیب زدی!`);
        } else {
            const newBalance = userData.balance - fineAmount;
            db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, user.id);
            await interaction.reply(`👮 **شکست خوردی!** پلیس شما را دستگیر کرد و **${fineAmount}** ${emeraldEmoji} جریمه شدی!`);
        }
    },
};