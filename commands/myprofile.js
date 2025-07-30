const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myprofile')
        .setDescription('نمایش شناسنامه و اطلاعات شخصی شما.'),
    async execute(interaction) {
        const user = interaction.user;
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const userRecord = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(user.id, guildId);

        if (!userRecord) {
            return interaction.reply({ content: 'شما هنوز در سیستم ثبت احوال ثبت نام نکرده‌اید. لطفاً ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
        }

        const registrationCode = userRecord.registration_id.toString().padStart(3, '0');

        const profileEmbed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`📇 شناسنامه ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📜 کد ثبت', value: `**\`#${registrationCode}\`**`, inline: false },
                { name: '👤 نام کامل', value: userRecord.name, inline: true },
                { name: '🎂 سن', value: `${userRecord.age} سال`, inline: true },
                { name: '📅 تاریخ تولد', value: userRecord.birth_date, inline: true },
                { name: '💰 موجودی', value: `${userRecord.balance} ${emeraldEmoji}`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [profileEmbed], ephemeral: true });
    },
};