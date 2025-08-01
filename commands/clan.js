const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('مدیریت و مشاهده کلن‌ها.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('یک کلن جدید بسازید.')
                .addStringOption(option => option.setName('name').setDescription('نام کامل کلن').setRequired(true))
                .addStringOption(option => option.setName('tag').setDescription('تگ کوتاه کلن (۳ تا ۵ حرف)').setRequired(true))
        )
        // نام ساب‌کامند به invite تغییر کرد
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('برای عضویت در یک کلن درخواست ارسال کنید.')
                .addStringOption(option => option.setName('name').setDescription('نام کلنی که می‌خواهید به آن بپیوندید').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('کلن فعلی خود را ترک کنید.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('اطلاعات یک کلن را مشاهده کنید.')
                .addStringOption(option => option.setName('name').setDescription('نام کلن (اگر خالی بگذارید، کلن خودتان نمایش داده می‌شود)'))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;
        const guildId = interaction.guild.id;

        const userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(user.id, guildId);
        if (!userData) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید! لطفاً ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
        }

        if (subcommand === 'create') {
            // ... (کد create بدون تغییر)
        } else if (subcommand === 'invite') {
            // --- بخش اصلاح شده ---
            await interaction.deferReply({ ephemeral: true }); // اضافه کردن این خط برای جلوگیری از تایم‌اوت

            if (userData.clan_id) {
                return interaction.editReply({ content: 'شما در حال حاضر عضو یک کلن هستید!' });
            }

            const clanName = interaction.options.getString('name');
            const targetClan = db.prepare('SELECT * FROM clans WHERE name = ?').get(clanName);
            if (!targetClan) {
                return interaction.editReply({ content: 'کلنی با این نام پیدا نشد!' });
            }

            const existingRequest = db.prepare('SELECT * FROM clan_requests WHERE user_id = ? AND status = ?').get(user.id, 'pending');
            if (existingRequest) {
                return interaction.editReply({ content: 'شما از قبل یک درخواست عضویت در حال انتظار دارید!' });
            }

            try {
                const owner = await interaction.client.users.fetch(targetClan.owner_id);
                const info = db.prepare('INSERT INTO clan_requests (user_id, clan_id, created_at) VALUES (?, ?, ?)').run(user.id, targetClan.clan_id, Date.now());

                const embed = new EmbedBuilder()
                    .setTitle('درخواست عضویت جدید')
                    .setDescription(`کاربر **${user.tag}** می‌خواهد به کلن شما **[${targetClan.tag}] ${targetClan.name}** بپیوندد.`)
                    .setColor('Blue')
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`clan_accept_${info.lastInsertRowid}`).setLabel('قبول ✅').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`clan_deny_${info.lastInsertRowid}`).setLabel('رد ❌').setStyle(ButtonStyle.Danger)
                );

                await owner.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: `درخواست عضویت شما برای کلن **${targetClan.name}** با موفقیت برای لیدر ارسال شد.` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'خطایی در ارسال درخواست به لیدر کلن رخ داد. ممکن است پیام‌های خصوصی او بسته باشد.' });
            }

        } else if (subcommand === 'leave') {
            // ... (کد leave بدون تغییر)
        } else if (subcommand === 'info') {
            // ... (کد info بدون تغییر)
        }
    },
};
// فراموش نکنید که کدهای ساب‌کامندهای دیگر (create, leave, info) را از نسخه قبلی خودتان اینجا کپی کنید.