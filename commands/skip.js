const { SlashCommandBuilder } = require('discord.js');
const { queues } = require('./play.js'); // ما از همان صف پخش استفاده می‌کنیم

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('آهنگ فعلی را رد می‌کند.'),
    async execute(interaction) {
        const serverQueue = queues.get(interaction.guild.id);
        if (!serverQueue) {
            return interaction.reply({ content: 'هیچ آهنگی در حال پخش نیست!', ephemeral: true });
        }
        serverQueue.player.stop(); // این کار باعث می‌شود رویداد Idle فعال شده و آهنگ بعدی پخش شود
        await interaction.reply('آهنگ رد شد!');
    },
};