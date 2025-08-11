const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eco')
        .setDescription('دستورات مدیریتی برای اقتصاد سرور (فقط برای صاحب سرور).')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('به موجودی یک کاربر امرالد اضافه می‌کند.')
                .addUserOption(option => option.setName('user').setDescription('کاربر مورد نظر').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('مقدار امرالد برای اضافه کردن').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('از موجودی یک کاربر امرالد کم می‌کند.')
                .addUserOption(option => option.setName('user').setDescription('کاربر مورد نظر').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('مقدار امرالد برای کم کردن').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('موجودی یک کاربر را روی یک مقدار مشخص تنظیم می‌کند.')
                .addUserOption(option => option.setName('user').setDescription('کاربر مورد نظر').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('مقدار جدید موجودی').setRequired(true).setMinValue(0))
        ),
    async execute(interaction) {
        // ۱. چک کردن اینکه آیا اجرا کننده دستور، صاحب سرور است یا نه
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ این دستور فقط توسط صاحب سرور قابل استفاده است!', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        // چک کردن اینکه آیا کاربر هدف در دیتابیس وجود دارد یا نه
        let userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(targetUser.id, interaction.guild.id);
        if (!userData) {
            return interaction.reply({ content: `کاربر ${targetUser.username} هنوز ثبت نام نکرده است.`, ephemeral: true });
        }

        let newBalance;

        // ۲. اجرای منطق بر اساس ساب‌کامند
        switch (subcommand) {
            case 'add':
                newBalance = userData.balance + amount;
                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, targetUser.id);
                await interaction.reply(`✅ **${amount}** ${emeraldEmoji} با موفقیت به موجودی ${targetUser} اضافه شد. موجودی جدید: ${newBalance}`);
                break;

            case 'remove':
                newBalance = Math.max(0, userData.balance - amount); // جلوگیری از منفی شدن موجودی
                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, targetUser.id);
                await interaction.reply(`✅ **${amount}** ${emeraldEmoji} با موفقیت از موجودی ${targetUser} کسر شد. موجودی جدید: ${newBalance}`);
                break;
            
            case 'set':
                newBalance = amount;
                db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, targetUser.id);
                await interaction.reply(`✅ موجودی ${targetUser} با موفقیت روی **${newBalance}** ${emeraldEmoji} تنظیم شد.`);
                break;
        }
    },
};