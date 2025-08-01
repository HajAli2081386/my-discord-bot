require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const clientId = process.env.CLIENT_ID; // آیدی بات رو باید در فایل .env بذاری
const token = process.env.BOT_TOKEN;

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`در حال ثبت ${commands.length} دستور...`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ ${data.length} دستور با موفقیت ثبت شد.`);
    } catch (error) {
        console.error(error);
    }
})();