const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('یک کاربر را برای همیشه از سرور محروم می‌کند.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('کاربری که می‌خواهید بن کنید')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('دلیل بن کردن کاربر')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'دلیل خاصی ارائه نشده است.';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'شما دسترسی لازم برای بن کردن کاربران را ندارید!', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'من دسترسی لازم برای بن کردن کاربران را ندارم! لطفاً دسترسی "Ban Members" را به من بدهید.', ephemeral: true });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        if (!targetMember.bannable) {
            return interaction.reply({ content: 'من نمی‌توانم این کاربر را بن کنم. ممکن است رول او بالاتر از رول من باشد یا دسترسی‌های خاصی داشته باشد.', ephemeral: true });
        }

        try {
            await targetUser.send(`شما از سرور **${interaction.guild.name}** به دلیل زیر بن شدید: \n*${reason}*`);
        } catch (error) {
            console.log(`نتوانستم به ${targetUser.tag} پیام خصوصی ارسال کنم.`);
        }

        try {
            await interaction.guild.members.ban(targetUser, { reason });
            const banEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('کاربر بن شد')
                .addFields(
                    { name: 'کاربر', value: targetUser.tag, inline: true },
                    { name: 'توسط', value: interaction.user.tag, inline: true },
                    { name: 'دلیل', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [banEmbed] });
        } catch (error) {
            console.error('خطا در هنگام بن کردن کاربر:', error);
            await interaction.reply({ content: 'خطایی در هنگام بن کردن کاربر رخ داد.', ephemeral: true });
        }
    },
};