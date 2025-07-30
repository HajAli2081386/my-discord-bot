const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('یک کاربر را برای مدت زمان مشخصی از چت کردن محروم می‌کند (Timeout).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('کاربری که می‌خواهید میوت کنید')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('مدت زمان میوت (مثال: 10m, 1h, 2d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('دلیل میوت کردن کاربر')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'دلیل خاصی ارائه نشده است.';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'شما دسترسی لازم برای میوت کردن کاربران را ندارید!', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'من دسترسی لازم برای میوت کردن کاربران را ندارم! لطفاً دسترسی "Timeout Members" را به من بدهید.', ephemeral: true });
        }

        const durationMs = ms(durationStr);
        if (!durationMs || durationMs > 2419200000) { // حداکثر زمان تایم‌اوت ۲۸ روز است
            return interaction.reply({ content: 'مدت زمان وارد شده معتبر نیست! لطفاً از فرمت `10m`, `1h`, `2d` و... استفاده کنید و مدت زمان نباید بیشتر از ۲۸ روز باشد.', ephemeral: true });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        if (!targetMember.moderatable) {
            return interaction.reply({ content: 'من نمی‌توانم این کاربر را میوت کنم. ممکن است رول او بالاتر از رول من باشد یا دسترسی‌های خاصی داشته باشد.', ephemeral: true });
        }

        try {
            await targetMember.timeout(durationMs, reason);
            const muteEmbed = new EmbedBuilder()
                .setColor('Grey')
                .setTitle('کاربر میوت شد (Timeout)')
                .addFields(
                    { name: 'کاربر', value: targetUser.tag, inline: true },
                    { name: 'توسط', value: interaction.user.tag, inline: true },
                    { name: 'مدت زمان', value: durationStr, inline: false },
                    { name: 'دلیل', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [muteEmbed] });
        } catch (error) {
            console.error('خطا در هنگام میوت کردن کاربر:', error);
            await interaction.reply({ content: 'خطایی در هنگام میوت کردن کاربر رخ داد.', ephemeral: true });
        }
    },
};