// PermissionsBitField را به لیست ایمپورت‌ها اضافه می‌کنیم
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../database.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('مدیریت سیستم قرعه‌کشی (فقط برای استف)')
        // --- خط کلیدی جدید ---
        // این خط مشخص می‌کند که فقط اعضایی با دسترسی "مدیریت سرور" می‌توانند از این دستور استفاده کنند
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('یک قرعه‌کشی جدید را شروع می‌کند.')
                .addStringOption(option => option.setName('duration').setDescription('مدت زمان قرعه‌کشی (مثال: 10m, 1h, 2d)').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('تعداد برندگان').setRequired(true))
                .addStringOption(option => option.setName('prize').setDescription('جایزه قرعه‌کشی').setRequired(true))
                .addChannelOption(option => option.setName('channel').setDescription('کانالی که قرعه‌کشی در آن ارسال می‌شود').addChannelTypes(ChannelType.GuildText))
        ),
    async execute(interaction) {
        // دیگر نیازی به چک کردن دسترسی در اینجا نیست، چون دیسکورد به صورت خودکار این کار را انجام می‌دهد.
        if (interaction.options.getSubcommand() === 'start') {
            const durationStr = interaction.options.getString('duration');
            const winnerCount = interaction.options.getInteger('winners');
            const prize = interaction.options.getString('prize');
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            const durationMs = ms(durationStr);
            if (!durationMs) {
                return interaction.reply({ content: 'مدت زمان وارد شده معتبر نیست! لطفاً از فرمت `10m`, `1h`, `2d` و... استفاده کنید.', ephemeral: true });
            }

            const endTime = Date.now() + durationMs;
            const endTimeTimestamp = Math.floor(endTime / 1000);

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 قرعه کشی: ${prize} 🎉`)
                .setDescription(`برای شرکت در قرعه کشی روی دکمه زیر کلیک کنید!\nتعداد برندگان: **${winnerCount}**\nپایان قرعه کشی: <t:${endTimeTimestamp}:R>`)
                .setColor('Gold')
                .setTimestamp(endTime);

            const enterButton = new ButtonBuilder()
                .setCustomId('enter_giveaway')
                .setLabel('شرکت در قرعه‌کشی!')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎁');

            const row = new ActionRowBuilder().addComponents(enterButton);

            const giveawayMessage = await channel.send({ embeds: [giveawayEmbed], components: [row] });

            db.prepare(
                'INSERT INTO giveaways (message_id, channel_id, guild_id, end_time, prize, winner_count, entrants) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(giveawayMessage.id, channel.id, interaction.guild.id, endTime, prize, winnerCount, '[]');

            await interaction.reply({ content: `قرعه‌کشی با موفقیت در کانال ${channel} شروع شد!`, ephemeral: true });
        }
    },
};