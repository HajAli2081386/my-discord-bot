const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database.js');
const Canvas = require('@napi-rs/canvas');

// تابع برای ساخت کارت رنک
async function createRankCard(member, userRecord) {
    const canvas = Canvas.createCanvas(934, 282);
    const ctx = canvas.getContext('2d');

    // پس‌زمینه
    const background = await Canvas.loadImage('./background.png'); // از همان پس‌زمینه ولکام استفاده می‌کنیم
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // نام کاربر
    ctx.fillStyle = '#ffffff';
    ctx.font = '35px "Vazirmatn"';
    ctx.fillText(member.user.displayName, 250, 160);

    // سطح و اکس‌پی
    const xpNeeded = userRecord.level * 150;
    const rankText = `Level: ${userRecord.level} | XP: ${userRecord.xp} / ${xpNeeded}`;
    ctx.font = '25px "Vazirmatn"';
    ctx.fillText(rankText, 250, 210);

    // نوار پیشرفت (Progress Bar)
    const percentage = (userRecord.xp / xpNeeded);
    const progressBarWidth = 600;
    // پس‌زمینه نوار
    ctx.fillStyle = '#484b4e';
    ctx.fillRect(250, 230, progressBarWidth, 30);
    // نوار پیشرفت
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(250, 230, progressBarWidth * percentage, 30);

    // آواتار کاربر
    ctx.beginPath();
    ctx.arc(125, 141, 100, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    const avatar = await Canvas.loadImage(member.displayAvatarURL({ extension: 'png' }));
    ctx.drawImage(avatar, 25, 41, 200, 200);

    return await canvas.encode('png');
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('نمایش سطح و XP شما یا کاربر دیگر.')
        .addUserOption(option => option.setName('user').setDescription('کاربری که می‌خواهید رنک او را ببینید')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);
        
        const userRecord = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(targetUser.id, interaction.guild.id);
        if (!userRecord) {
            return interaction.reply({ content: `کاربر ${targetUser.username} هنوز هیچ فعالیتی نداشته است.`, ephemeral: true });
        }

        await interaction.deferReply();
        
        const imageBuffer = await createRankCard(member, userRecord);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'rank-card.png' });
        
        await interaction.editReply({ files: [attachment] });
    },
};