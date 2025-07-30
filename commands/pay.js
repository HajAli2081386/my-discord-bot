const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('مقداری از امرالد خود را به کاربر دیگری پرداخت کنید.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('کاربری که می‌خواهید به او پرداخت کنید')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('مقداری که می‌خواهید پرداخت کنید')
                .setRequired(true)
                .setMinValue(1)), // حداقل مقدار قابل پرداخت ۱ است
    async execute(interaction) {
        const sender = interaction.user;
        const recipient = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        // ۱. جلوگیری از پرداخت به خود یا به بات
        if (recipient.id === sender.id) {
            return interaction.reply({ content: 'شما نمی‌توانید به خودتان پرداخت کنید!', ephemeral: true });
        }
        if (recipient.bot) {
            return interaction.reply({ content: 'شما نمی‌توانید به بات‌ها پرداخت کنید!', ephemeral: true });
        }

        // ۲. باز کردن یک تراکنش (Transaction) برای اطمینان از صحت عملیات
        const transaction = db.transaction(() => {
            // اطلاعات فرستنده را از دیتابیس می‌خوانیم
            const senderData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(sender.id, guildId);
            if (!senderData || senderData.balance < amount) {
                return interaction.reply({ content: `موجودی شما برای این تراکنش کافی نیست! موجودی فعلی شما: ${senderData ? senderData.balance : 0} ${emeraldEmoji}`, ephemeral: true });
            }

            // اطلاعات گیرنده را از دیتابیس می‌خوانیم
            const recipientData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(recipient.id, guildId);
            if (!recipientData) {
                return interaction.reply({ content: `کاربر ${recipient.username} هنوز در سیستم ثبت نام نکرده است و نمی‌تواند پولی دریافت کند.`, ephemeral: true });
            }

            // ۳. انجام محاسبات و آپدیت دیتابیس
            const newSenderBalance = senderData.balance - amount;
            const newRecipientBalance = recipientData.balance + amount;

            db.prepare('UPDATE users SET balance = ? WHERE user_id = ? AND guild_id = ?').run(newSenderBalance, sender.id, guildId);
            db.prepare('UPDATE users SET balance = ? WHERE user_id = ? AND guild_id = ?').run(newRecipientBalance, recipient.id, guildId);

            // ۴. ارسال پیام موفقیت‌آمیز
            interaction.reply(`✅ تراکنش موفق! شما **${amount}** ${emeraldEmoji} به کاربر ${recipient} پرداخت کردید.`);
        });

        try {
            transaction();
        } catch (error) {
            // اگر در حین تراکنش خطایی رخ دهد (که در اینجا به خاطر پاسخ دادن به interaction است)،
            // ما آن را نادیده می‌گیریم چون پیام خطا به کاربر ارسال شده است.
            if (error.message.includes('Cannot reply to an interaction that has already been replied to')) {
                // این خطا طبیعی است و به معنی این است که پیام خطا به کاربر ارسال شده.
            } else {
                console.error('خطا در تراکنش پرداخت:', error);
                interaction.followUp({ content: 'یک خطای غیرمنتظره در هنگام پردازش تراکنش رخ داد. لطفاً دوباره تلاش کنید.', ephemeral: true });
            }
        }
    },
};