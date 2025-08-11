const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('مدیریت و مشاهده کلن‌ها.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('یک کلن جدید با هزینه ۱۰۰۰ امرالد بسازید.')
                .addStringOption(option => option.setName('name').setDescription('نام کامل کلن').setRequired(true))
                .addStringOption(option => option.setName('tag').setDescription('تگ کوتاه کلن (۳ تا ۵ حرف)').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('request')
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disband')
                .setDescription('کلن خود را برای همیشه منحل کنید (فقط برای صاحب کلن).')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('deposit')
                .setDescription('مقداری امرالد به بانک کلن واریز کنید.')
                .addIntegerOption(option => option.setName('amount').setDescription('مقدار امرالد برای واریز').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bank')
                .setDescription('موجودی بانک کلن خود را مشاهده کنید.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;
        const guildId = interaction.guild.id;
        const emeraldEmoji = '<:Emerald:1399819317935083581>';

        const userData = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(user.id, guildId);
        if (!userData) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید! لطفاً ابتدا از دستور `/register` استفاده کنید.', ephemeral: true });
        }

        if (subcommand === 'create') {
            const clanCreationCost = 1000;
            if (userData.balance < clanCreationCost) {
                return interaction.reply({ content: `برای ساخت کلن به ${clanCreationCost} ${emeraldEmoji} نیاز دارید! موجودی شما کافی نیست.`, ephemeral: true });
            }
            if (userData.clan_id) {
                return interaction.reply({ content: 'شما در حال حاضر عضو یک کلن هستید و نمی‌توانید یک کلن جدید بسازید!', ephemeral: true });
            }
            const clanName = interaction.options.getString('name');
            const clanTag = interaction.options.getString('tag');
            if (clanTag.length < 3 || clanTag.length > 5) {
                return interaction.reply({ content: 'تگ کلن باید بین ۳ تا ۵ حرف باشد!', ephemeral: true });
            }
            const existingClan = db.prepare('SELECT * FROM clans WHERE name = ? OR tag = ?').get(clanName, clanTag);
            if (existingClan) {
                return interaction.reply({ content: 'یک کلن با این نام یا تگ از قبل وجود دارد!', ephemeral: true });
            }

            await interaction.deferReply();
            try {
                const newRole = await interaction.guild.roles.create({ name: `Clan: ${clanName}`, mentionable: true });
                const member = await interaction.guild.members.fetch(user.id);
                const transaction = db.transaction(() => {
                    db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?').run(clanCreationCost, user.id);
                    const info = db.prepare('INSERT INTO clans (name, tag, owner_id, created_at, role_id) VALUES (?, ?, ?, ?, ?)').run(clanName, clanTag, user.id, new Date().toISOString(), newRole.id);
                    const newClanId = info.lastInsertRowid;
                    db.prepare('UPDATE users SET clan_id = ? WHERE user_id = ?').run(newClanId, user.id);
                });
                transaction();
                await member.roles.add(newRole);
                await interaction.editReply(`🎉 کلن **${clanName}** با تگ **[${clanTag}]** با موفقیت ساخته شد و رول ${newRole} به شما اختصاص یافت!`);
            } catch (error) {
                console.error("خطا در ساخت کلن:", error);
                await interaction.editReply({ content: 'خطایی در هنگام ساخت کلن یا رول رخ داد. لطفاً مطمئن شوید که من دسترسی "Manage Roles" را دارم.', ephemeral: true });
            }
        } else if (subcommand === 'request') {
            if (userData.clan_id) {
                return interaction.reply({ content: 'شما در حال حاضر عضو یک کلن هستید!', ephemeral: true });
            }
            const clanName = interaction.options.getString('name');
            const targetClan = db.prepare('SELECT * FROM clans WHERE name = ?').get(clanName);
            if (!targetClan) {
                return interaction.reply({ content: 'کلنی با این نام پیدا نشد!', ephemeral: true });
            }
            const existingRequest = db.prepare('SELECT * FROM clan_requests WHERE user_id = ? AND status = ?').get(user.id, 'pending');
            if (existingRequest) {
                return interaction.reply({ content: 'شما از قبل یک درخواست عضویت در حال انتظار دارید!', ephemeral: true });
            }
            try {
                const owner = await interaction.client.users.fetch(targetClan.owner_id);
                const info = db.prepare('INSERT INTO clan_requests (user_id, clan_id, created_at) VALUES (?, ?, ?)').run(user.id, targetClan.clan_id, Date.now());
                const embed = new EmbedBuilder().setTitle('درخواست عضویت جدید').setDescription(`کاربر **${user.tag}** می‌خواهد به کلن شما **[${targetClan.tag}] ${targetClan.name}** بپیوندد.`).setColor('Blue').setTimestamp();
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`clan_accept_${info.lastInsertRowid}`).setLabel('قبول ✅').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`clan_deny_${info.lastInsertRowid}`).setLabel('رد ❌').setStyle(ButtonStyle.Danger)
                );
                await owner.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: `درخواست عضویت شما برای کلن **${targetClan.name}** با موفقیت برای لیدر ارسال شد.`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'خطایی در ارسال درخواست به لیدر کلن رخ داد. ممکن است پیام‌های خصوصی او بسته باشد.', ephemeral: true });
            }
        } else if (subcommand === 'leave') {
            if (!userData.clan_id) {
                return interaction.reply({ content: 'شما عضو هیچ کلنی نیستید!', ephemeral: true });
            }
            const clanInfo = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(userData.clan_id);
            if (clanInfo.owner_id === user.id) {
                return interaction.reply({ content: 'شما صاحب کلن هستید و نمی‌توانید آن را ترک کنید! برای این کار باید از دستور `/clan disband` استفاده کنید.', ephemeral: true });
            }
            const member = await interaction.guild.members.fetch(user.id);
            if (clanInfo.role_id) {
                await member.roles.remove(clanInfo.role_id).catch(console.error);
            }
            db.prepare('UPDATE users SET clan_id = NULL WHERE user_id = ?').run(user.id);
            await interaction.reply(`شما با موفقیت کلن **${clanInfo.name}** را ترک کردید.`);

        } else if (subcommand === 'info') {
            let clanInfo;
            const clanName = interaction.options.getString('name');
            if (clanName) {
                clanInfo = db.prepare('SELECT * FROM clans WHERE name = ?').get(clanName);
            } else {
                if (!userData.clan_id) {
                    return interaction.reply({ content: 'شما عضو هیچ کلنی نیستید و نام کلنی را هم مشخص نکرده‌اید!', ephemeral: true });
                }
                clanInfo = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(userData.clan_id);
            }
            if (!clanInfo) {
                return interaction.reply({ content: 'کلنی با این مشخصات پیدا نشد!', ephemeral: true });
            }
            const members = db.prepare('SELECT * FROM users WHERE clan_id = ?').all(clanInfo.clan_id);
            const owner = await interaction.guild.members.fetch(clanInfo.owner_id);
            const memberList = members.map(m => `<@${m.user_id}>`).join('\n') || 'هنوز عضوی ندارد';
            const xpNeededForClanLevelUp = clanInfo.level * 500;
            const infoEmbed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle(`اطلاعات کلن [${clanInfo.tag}] ${clanInfo.name}`)
                .addFields(
                    { name: '👑 صاحب کلن', value: owner.user.tag, inline: true },
                    { name: '👥 تعداد اعضا', value: `${members.length} نفر`, inline: true },
                    { name: '📅 تاریخ ساخت', value: `<t:${Math.floor(new Date(clanInfo.created_at).getTime() / 1000)}:D>`, inline: true },
                    { name: '🏆 سطح کلن', value: `Level ${clanInfo.level}`, inline: true },
                    { name: '✨ اکس‌پی کلن', value: `${clanInfo.xp} / ${xpNeededForClanLevelUp}`, inline: true },
                    { name: '💰 موجودی بانک', value: `${clanInfo.balance} ${emeraldEmoji}`, inline: true },
                    { name: 'اعضای کلن', value: memberList }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [infoEmbed] });
        } else if (subcommand === 'disband') {
            if (!userData.clan_id) return interaction.reply({ content: 'شما عضو هیچ کلنی نیستید!', ephemeral: true });
            const clanInfo = db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(userData.clan_id);
            if (clanInfo.owner_id !== user.id) return interaction.reply({ content: 'فقط صاحب کلن می‌تواند آن را منحل کند!', ephemeral: true });

            await interaction.deferReply();
            if (clanInfo.role_id) {
                const role = await interaction.guild.roles.fetch(clanInfo.role_id).catch(() => null);
                if (role) await role.delete('Clan disbanded').catch(console.error);
            }
            const transaction = db.transaction(() => {
                db.prepare('UPDATE users SET clan_id = NULL WHERE clan_id = ?').run(clanInfo.clan_id);
                db.prepare('DELETE FROM clans WHERE clan_id = ?').run(clanInfo.clan_id);
            });
            transaction();
            await interaction.editReply(`کلن **${clanInfo.name}** با موفقیت منحل شد و رول مربوط به آن نیز حذف گردید.`);

        } else if (subcommand === 'deposit') {
            const amount = interaction.options.getInteger('amount');
            if (!userData.clan_id) return interaction.reply({ content: 'شما برای واریز پول باید عضو یک کلن باشید!', ephemeral: true });
            if (userData.balance < amount) return interaction.reply({ content: 'موجودی شما برای این واریز کافی نیست!', ephemeral: true });
            const transaction = db.transaction(() => {
                db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ?').run(amount, user.id);
                db.prepare('UPDATE clans SET balance = balance + ? WHERE clan_id = ?').run(amount, userData.clan_id);
            });
            transaction();
            const clanInfo = db.prepare('SELECT name FROM clans WHERE clan_id = ?').get(userData.clan_id);
            await interaction.reply(`شما با موفقیت **${amount}** ${emeraldEmoji} به بانک کلن **${clanInfo.name}** واریز کردید.`);

        } else if (subcommand === 'bank') {
            if (!userData.clan_id) return interaction.reply({ content: 'شما عضو هیچ کلنی نیستید!', ephemeral: true });
            const clanInfo = db.prepare('SELECT name, balance FROM clans WHERE clan_id = ?').get(userData.clan_id);
            await interaction.reply(`موجودی بانک کلن **${clanInfo.name}** برابر است با: **${clanInfo.balance}** ${emeraldEmoji}.`);
        }
    },
};