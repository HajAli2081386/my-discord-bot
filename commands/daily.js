const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('جایزه روزانه خود را دریافت کنید!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

        if (!user) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید! لطفاً ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
        }

        const lastDaily = user.last_daily ? new Date(user.last_daily) : null;
        const now = new Date();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (lastDaily && (now - lastDaily < twentyFourHours)) {
            const timeLeft = new Date(lastDaily.getTime() + twentyFourHours);
            const timestamp = Math.floor(timeLeft.getTime() / 1000);

            // این قسمت تغییر کرده و بخش پرانتز حذف شده است
            return interaction.reply({
                content: `شما قبلاً جایزه روزانه خود را دریافت کرده‌اید. لطفاً بعداً دوباره تلاش کنید.\n\n**زمان دریافت بعدی:**\n<t:${timestamp}:F>`,
                ephemeral: true
            });
        }

        const dailyReward = 50;
        const newBalance = user.balance + dailyReward;

        db.prepare('UPDATE users SET balance = ?, last_daily = ? WHERE user_id = ? AND guild_id = ?')
          .run(newBalance, now.toISOString(), userId, guildId);

        const emeraldEmoji = '<:Emerald:1399819317935083581>';
        await interaction.reply({ content: `🎉 شما **${dailyReward}** ${emeraldEmoji} به عنوان جایزه روزانه دریافت کردید! موجودی جدید شما: ${newBalance} ${emeraldEmoji}.`, ephemeral: true });
    },
};