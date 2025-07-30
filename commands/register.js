const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('اطلاعات خود را در سیستم ثبت احوال سرور ثبت کنید.')
        .addStringOption(option => option.setName('name').setDescription('نام کامل شما').setRequired(true))
        .addIntegerOption(option => option.setName('age').setDescription('سن شما به عدد').setRequired(true))
        .addStringOption(option => option.setName('birth_date').setDescription('تاریخ تولد شما (مثال: 1380/05/14)').setRequired(true)),
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const name = interaction.options.getString('name');
        const age = interaction.options.getInteger('age');
        const birthDate = interaction.options.getString('birth_date');

        const existingUser = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
        if (existingUser) {
            return interaction.reply({ content: 'شما قبلاً ثبت نام کرده‌اید! برای مشاهده اطلاعات از دستور `/profile` استفاده کنید.', ephemeral: true });
        }

        const initialBalance = 100;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const info = db.prepare(
            'INSERT INTO users (user_id, guild_id, name, age, birth_date, balance) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(userId, guildId, name, age, birthDate, initialBalance);
        
        const newRegistrationId = info.lastInsertRowid;

        // --- تغییر اصلی اینجاست ---
        // شماره ثبت را به یک رشته ۳ رقمی با صفرهای پیشرو تبدیل می‌کنیم
        const registrationCode = newRegistrationId.toString().padStart(3, '0');

        await interaction.reply({
            content: `✅ **${name}** عزیز، اطلاعات شما با موفقیت در سیستم ثبت احوال ثبت شد.\n**کد ثبت شما: ${registrationCode}**\n\nشما ${initialBalance} ${emeraldEmoji} به عنوان هدیه دریافت کردید!`,
            ephemeral: true
        });
    },
};