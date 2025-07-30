const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('نمایش شناسنامه و اطلاعات ثبت شده کاربر.')
        .addUserOption(option => option.setName('user').setDescription('کاربری که می‌خواهید پروفایل او را ببینید')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const userRecord = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

        if (!userRecord) {
            return interaction.reply({ content: `کاربر ${targetUser.username} هنوز در سیستم ثبت احوال ثبت نام نکرده است.`, ephemeral: true });
        }

        const registrationCode = userRecord.registration_id.toString().padStart(3, '0');

        const profileEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📇 شناسنامه ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📜 کد ثبت', value: `**\`#${registrationCode}\`**`, inline: false },
                { name: '👤 نام کامل', value: userRecord.name, inline: true },
                { name: '🎂 سن', value: `${userRecord.age} سال`, inline: true },
                { name: '📅 تاریخ تولد', value: userRecord.birth_date, inline: true },
                { name: '💰 موجودی', value: `${userRecord.balance} ${emeraldEmoji}`, inline: false }
            )
            // خط setFooter از اینجا حذف شده است
            .setTimestamp();

        await interaction.reply({ embeds: [profileEmbed] });
    },
};