const { SlashCommandBuilder } = require('discord.js');
const { queues } = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('پخش موزیک را متوقف و بات را از کانال خارج می‌کند.'),
    async execute(interaction) {
        const serverQueue = queues.get(interaction.guild.id);
        if (!serverQueue) {
            return interaction.reply({ content: 'هیچ آهنگی در حال پخش نیست!', ephemeral: true });
        }
        serverQueue.songs = [];
        serverQueue.connection.destroy();
        queues.delete(interaction.guild.id);
        await interaction.reply('پخش موزیک متوقف شد و از کانال خارج شدم.');
    },
};