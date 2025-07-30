const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('یک کاربر را از سرور اخراج می‌کند.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('کاربری که می‌خواهید اخراج کنید')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('دلیل اخراج کاربر')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'دلیل خاصی ارائه نشده است.';

        // ۱. چک کردن دسترسی اجرا کننده دستور
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'شما دسترسی لازم برای اخراج کردن کاربران را ندارید!', ephemeral: true });
        }

        // ۲. چک کردن دسترسی بات
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'من دسترسی لازم برای اخراج کردن کاربران را ندارم! لطفاً دسترسی "Kick Members" را به من بدهید.', ephemeral: true });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        // ۳. چک کردن اینکه آیا کاربر قابل اخراج است یا نه
        if (!targetMember.kickable) {
            return interaction.reply({ content: 'من نمی‌توانم این کاربر را اخراج کنم. ممکن است رول او بالاتر از رول من باشد یا دسترسی‌های خاصی داشته باشد.', ephemeral: true });
        }

        // ۴. ارسال پیام به کاربر اخراج شده (اختیاری)
        try {
            await targetUser.send(`شما از سرور **${interaction.guild.name}** به دلیل زیر اخراج شدید: \n*${reason}*`);
        } catch (error) {
            console.log(`نتوانستم به ${targetUser.tag} پیام خصوصی ارسال کنم.`);
        }

        // ۵. اخراج کردن کاربر
        try {
            await targetMember.kick(reason);
            const kickEmbed = new EmbedBuilder()
                .setColor('Yellow')
                .setTitle('کاربر اخراج شد')
                .addFields(
                    { name: 'کاربر', value: targetUser.tag, inline: true },
                    { name: 'توسط', value: interaction.user.tag, inline: true },
                    { name: 'دلیل', value: reason }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [kickEmbed] });
        } catch (error) {
            console.error('خطا در هنگام اخراج کاربر:', error);
            await interaction.reply({ content: 'خطایی در هنگام اخراج کاربر رخ داد.', ephemeral: true });
        }
    },
};