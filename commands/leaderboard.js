const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('نمایش ۱۰ کاربر ثروتمند سرور.'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const top10 = db.prepare('SELECT user_id, balance FROM users WHERE guild_id = ? ORDER BY balance DESC LIMIT 10').all(interaction.guild.id);

            if (top10.length === 0) {
                return interaction.editReply('هنوز هیچ کاربری در جدول رده‌بندی وجود ندارد!');
            }

            const leaderboardDescription = await Promise.all(top10.map(async (user, index) => {
                const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);
                const username = member ? member.user.displayName : `کاربر نامشخص (${user.user_id})`;
                return `${index + 1}. **${username}** - ${user.balance} امرالد`;
            }));

            const embed = new EmbedBuilder()
                .setTitle('🏆 جدول رده‌بندی ثروتمندان')
                .setDescription(leaderboardDescription.join('\n'))
                .setColor('Gold')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("خطا در اجرای دستور لیدربرد:", error);
            await interaction.editReply('خطایی در دریافت جدول رده‌بندی رخ داد.');
        }
    },
};