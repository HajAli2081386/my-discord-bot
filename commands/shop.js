const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// لیست رول‌ها و قیمت‌هاشون رو اینجا تعریف می‌کنیم
// مهم: آیدی رول‌ها رو باید از سرور خودت کپی کنی
const shopItems = [
    { name: '💠┇God', roleId: '1399810286566903818', price: 5000, description: 'بهترین رول برای خرید' },
    { name: '🔱┇MVP', roleId: '1399811481008345159', price: 4000, description: 'دسترسی به مجموعه ای از بهترین امکانات' },
    { name: '⚜️┇VIP', roleId: '1399811605717454879', price: 2500, description: 'دسترسی به امکانات پرمیوم و قیمت قابل قبول' },
    { name: '🔰┇Master', roleId: '1399811775993614367', price: 1000, description: 'دسترسی به امکانات قابل قبول و قیمتی ارزان' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('مشاهده فروشگاه سرور برای خرید رول.'),
    async execute(interaction) {
        const shopEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🏪 فروشگاه سرور')
            .setDescription('برای خرید، از دستور `/buy-role` به همراه نام رول استفاده کنید.');

        shopItems.forEach(item => {
            shopEmbed.addFields({ name: `${item.name} - ${item.price} <:Emerald:1399819317935083581>`, value: item.description });
        });

        await interaction.reply({ embeds: [shopEmbed] });
    },
};