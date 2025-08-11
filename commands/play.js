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

const queues = new Map();
module.exports.queues = queues;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('پخش یک آهنگ از یوتیوب یا ساندکلود.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('نام آهنگ (برای یوتیوب) یا لینک آهنگ (یوتیوب/ساندکلود)')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'شما باید ابتدا به یک کانال صوتی متصل شوید!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // --- بخش تغییر یافته و هوشمند شده ---
            let searchResults;
            // اگر ورودی یک لینک بود، اجازه می‌دهیم play-dl خودش منبع را تشخیص دهد
            if (query.startsWith('https://')) {
                searchResults = await play.search(query, { limit: 1 });
            } else {
                // اگر متن ساده بود، به طور مشخص در یوتیوب جستجو می‌کنیم
                searchResults = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
            }

            if (searchResults.length === 0) {
                return interaction.editReply('آهنگی با این نام یا لینک پیدا نشد!');
            }

            const resource = searchResults[0];
            const song = {
                title: resource.title,
                url: resource.url,
                duration: resource.durationRaw,
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

        } catch (error) {
            console.error(error);
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