const { SlashCommandBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    entersState,
    VoiceConnectionStatus,
} = require('@discordjs/voice');
const play = require('play-dl');

// آبجکت برای نگهداری صف‌های پخش هر سرور
const queues = new Map();
// اکسپورت کردن صف‌ها برای دسترسی در فایل‌های دیگر (مثل skip.js)
module.exports.queues = queues;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('پخش یک آهنگ از یوتیوب.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('نام یا لینک آهنگ در یوتیوب')
                .setRequired(true)),
    
    async execute(interaction) {
        const startTime = Date.now();
        console.log(`[${startTime}] دستور /play شروع شد.`);

        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member.voice.channel;

        console.log(`[${Date.now() - startTime}ms] اطلاعات اولیه دریافت شد.`);

        if (!voiceChannel) {
            console.log(`[${Date.now() - startTime}ms] کاربر در کانال صوتی نیست. در حال ارسال پاسخ...`);
            return interaction.reply({ content: 'شما باید ابتدا به یک کانال صوتی متصل شوید!', ephemeral: true });
        }

        try {
            console.log(`[${Date.now() - startTime}ms] در حال تلاش برای ارسال deferReply...`);
            await interaction.deferReply();
            console.log(`[${Date.now() - startTime}ms] پاسخ با موفقیت Defer شد!`);
        } catch (e) {
            console.error(`[${Date.now() - startTime}ms] >> خطا در هنگام ارسال DEFER REPLY <<:`, e);
            return; // اگر defer ناموفق بود، ادامه نده
        }

        try {
            console.log(`[${Date.now() - startTime}ms] در حال جستجوی آهنگ...`);
            const searchResults = await play.search(query, { limit: 1 });
            if (searchResults.length === 0) {
                return interaction.editReply('آهنگی با این نام پیدا نشد!');
            }
            console.log(`[${Date.now() - startTime}ms] آهنگ پیدا شد.`);

            const video = searchResults[0];
            const song = {
                title: video.title,
                url: video.url,
                duration: video.durationRaw,
            };

            let serverQueue = queues.get(interaction.guild.id);

            if (!serverQueue) {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                const queueContruct = {
                    textChannel: interaction.channel,
                    voiceChannel: voiceChannel,
                    connection: connection,
                    songs: [song],
                    player: createAudioPlayer(),
                };
                queues.set(interaction.guild.id, queueContruct);

                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log(`[${Date.now() - startTime}ms] اتصال به کانال صوتی برقرار شد. در حال پخش آهنگ...`);
                    playSong(interaction.guild, queueContruct.songs[0]);
                });

                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (error) {
                        connection.destroy();
                        queues.delete(interaction.guild.id);
                    }
                });

                await interaction.editReply(`درحال پخش: **${song.title}**`);

            } else {
                serverQueue.songs.push(song);
                await interaction.editReply(`**${song.title}** به صف پخش اضافه شد!`);
            }
            console.log(`[${Date.now() - startTime}ms] اجرای دستور با موفقیت به پایان رسید.`);

        } catch (error) {
            console.error(`[${Date.now() - startTime}ms] خطا در حین پردازش آهنگ:`, error);
            await interaction.editReply('خطایی در هنگام جستجو یا پخش آهنگ رخ داد.');
        }
    },
};

async function playSong(guild, song) {
    const serverQueue = queues.get(guild.id);
    if (!song) {
        if (serverQueue) {
            serverQueue.connection.destroy();
            queues.delete(guild.id);
        }
        return;
    }

    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });

        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);

        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guild, serverQueue.songs[0]);
        });

    } catch (error) {
        console.error(`خطا در استریم آهنگ (${song.title}):`, error);
        serverQueue.textChannel.send(`خطایی در پخش آهنگ "${song.title}" رخ داد. در حال رد کردن...`);
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    }
}