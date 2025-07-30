const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('موجودی سکه‌های خود را مشاهده کنید.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // اول چک می‌کنیم کاربر ثبت نام کرده یا نه
        const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

        if (!user) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید! لطفاً ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
        }

        await interaction.reply({ content: `موجودی شما: **${user.balance}** <:Emerald:1399819317935083581>`, ephemeral: true });
    },
};