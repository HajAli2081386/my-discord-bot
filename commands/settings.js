const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('تنظیمات بات در این سرور.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome-channel')
                .setDescription('کانال خوش‌آمدگویی را تنظیم می‌کند.')
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('کانالی که می‌خواهید پیام خوش‌آمدگویی در آن ارسال شود.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'welcome-channel') {
            const channel = interaction.options.getChannel('channel');
            const guildId = interaction.guild.id;

            // ذخیره تنظیمات در دیتابیس
            db.prepare(
                'INSERT INTO guild_settings (guild_id, welcome_channel_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET welcome_channel_id = excluded.welcome_channel_id'
            ).run(guildId, channel.id);

            await interaction.reply({ content: `کانال خوش‌آمدگویی با موفقیت به ${channel} تغییر یافت.`, ephemeral: true });
        }
    },
};