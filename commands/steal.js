const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('تلاش برای دزدیدن امرالد از یک کاربر (فقط روزی یکبار)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('کاربری که قصد دزدی از او را دارید')
                .setRequired(true)),
    async execute(interaction) {
        const thief = interaction.user;
        const victim = interaction.options.getUser('target');
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        // چک کردن موارد اولیه
        if (thief.id === victim.id) {
            return interaction.reply({ content: 'شما نمی‌توانید از خودتان دزدی کنید!', ephemeral: true });
        }
        if (victim.bot) {
            return interaction.reply({ content: 'دزدی از بات‌ها ممکن نیست!', ephemeral: true });
        }

        const transaction = db.transaction(() => {
            const thiefData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(thief.id, guildId);
            const victimData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(victim.id, guildId);

            if (!thiefData) {
                return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید! ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
            }
            if (!victimData) {
                return interaction.reply({ content: `کاربر ${victim.username} هنوز ثبت نام نکرده است.`, ephemeral: true });
            }

            // چک کردن کول‌داون (cooldown) روزانه
            const lastSteal = thiefData.last_steal ? new Date(thiefData.last_steal) : null;
            const now = new Date();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (lastSteal && (now - lastSteal < twentyFourHours)) {
                const timeLeft = new Date(lastSteal.getTime() + twentyFourHours);
                const timestamp = Math.floor(timeLeft.getTime() / 1000);
                return interaction.reply({ content: `شما قبلاً تلاش خود را برای دزدی انجام داده‌اید. لطفاً بعداً دوباره تلاش کنید.\nزمان تلاش بعدی: <t:${timestamp}:R>`, ephemeral: true });
            }

            // چک کردن شرایط لازم برای دزدی
            const fineAmount = 50; // جریمه در صورت شکست
            if (thiefData.balance < fineAmount) {
                return interaction.reply({ content: `شما برای تلاش برای دزدی حداقل به ${fineAmount} ${emeraldEmoji} نیاز دارید (برای پرداخت جریمه در صورت شکست).`, ephemeral: true });
            }
            if (victimData.balance <= 0) {
                return interaction.reply({ content: `${victim.username} هیچ پولی برای دزدیدن ندارد!`, ephemeral: true });
            }

            // اجرای دزدی با شانس موفقیت
            const successChance = 0.50; // 50% شانس موفقیت
            const random = Math.random();
            
            // آپدیت زمان آخرین دزدی در هر دو حالت موفقیت و شکست
            db.prepare('UPDATE users SET last_steal = ? WHERE user_id = ?').run(now.toISOString(), thief.id);

            if (random < successChance) {
                // --- حالت موفقیت ---
                const maxStealPercent = 0.20; // حداکثر ۲۰ درصد از پول قربانی
                const stolenAmount = Math.floor(victimData.balance * Math.random() * maxStealPercent) + 1;

                const newThiefBalance = thiefData.balance + stolenAmount;
                const newVictimBalance = victimData.balance - stolenAmount;

                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newThiefBalance, thief.id);
                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newVictimBalance, victim.id);

                interaction.reply(`🚨 **موفق شدی!** شما **${stolenAmount}** ${emeraldEmoji} از ${victim.username} دزدیدی!`);

            } else {
                // --- حالت شکست ---
                const newThiefBalance = thiefData.balance - fineAmount;
                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newThiefBalance, thief.id);

                interaction.reply(`🚔 **شکست خوردی!** حین فرار دستگیر شدی و **${fineAmount}** ${emeraldEmoji} جریمه شدی!`);
            }
        });

        try {
            transaction();
        } catch (error) {
            // این خطاها معمولاً به خاطر ارسال دو پاسخ به یک interaction است که طبیعی است
            if (!error.message.includes('Cannot reply to an interaction that has already been replied to')) {
                console.error("خطا در تراکنش دزدی:", error);
            }
        }
    },
};