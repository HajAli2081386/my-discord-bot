const { SlashCommandBuilder } = require('discord.js');
const db = require('../database.js');

// لیست آیتم‌ها رو دوباره اینجا میاریم تا به قیمت‌ها دسترسی داشته باشیم
const shopItems = [
    { name: '💠┇God', roleId: '1399810286566903818', price: 5000, description: 'بهترین رول برای خرید' },
    { name: '🔱┇MVP', roleId: '1399811481008345159', price: 4000, description: 'دسترسی به مجموعه ای از بهترین امکانات' },
    { name: '⚜️┇VIP', roleId: '1399811605717454879', price: 2500, description: 'دسترسی به امکانات پرمیوم و قیمت قابل قبول' },
    { name: '🔰┇Master', roleId: '1399811775993614367', price: 1000, description: 'دسترسی به امکانات قابل قبول و قیمتی ارزان' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buyrole')
        .setDescription('یک رول از فروشگاه خریداری کنید.')
        .addStringOption(option =>
            option.setName('item_name')
                .setDescription('نام رولی که قصد خرید آن را دارید')
                .setRequired(true)
                // این قسمت برای پیشنهاد دادن نام رول‌ها به کاربر است
                .addChoices(
                    ...shopItems.map(item => ({ name: item.name, value: item.name }))
                )),
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const itemName = interaction.options.getString('item_name');

        const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
        if (!user) {
            return interaction.reply({ content: 'شما هنوز ثبت نام نکرده‌اید!', ephemeral: true });
        }

        const itemToBuy = shopItems.find(item => item.name.toLowerCase() === itemName.toLowerCase());
        if (!itemToBuy) {
            return interaction.reply({ content: 'این آیتم در فروشگاه موجود نیست!', ephemeral: true });
        }

        if (user.balance < itemToBuy.price) {
            return interaction.reply({ content: `موجودی شما برای خرید این رول کافی نیست! شما به ${itemToBuy.price} <:Emerald:1399819317935083581> نیاز دارید.`, ephemeral: true });
        }

        try {
            const member = await interaction.guild.members.fetch(userId);
            if (member.roles.cache.has(itemToBuy.roleId)) {
                return interaction.reply({ content: 'شما در حال حاضر این رول را دارید!', ephemeral: true });
            }

            // کم کردن پول از کاربر
            const newBalance = user.balance - itemToBuy.price;
            db.prepare('UPDATE users SET balance = ? WHERE user_id = ? AND guild_id = ?').run(newBalance, userId, guildId);

            // اضافه کردن رول به کاربر
            await member.roles.add(itemToBuy.roleId);

            await interaction.reply({ content: `🎉 تبریک! شما با موفقیت رول **${itemToBuy.name}** را خریداری کردید.`, ephemeral: true });
        } catch (error) {
            console.error('خطا در اضافه کردن رول:', error);
            await interaction.reply({ content: 'خطایی در هنگام اضافه کردن رول به شما رخ داد. لطفاً مطمئن شوید که بات دسترسی لازم برای مدیریت رول‌ها را دارد و جایگاه رول بات بالاتر از رول‌های فروشگاه است.', ephemeral: true });
        }
    },
};