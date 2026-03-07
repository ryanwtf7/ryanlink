export const SnowflakeRegex = /^\d{17,20}$/;

export const VoiceRegionIdRegex = /^([-a-z]{2,20})(?=[-a-z\d]*\.discord\.media:\d+$)/;

export const UrlRegex = /^https?:\/\/.+/i;

export const YoutubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;

export const SpotifyRegex = /^https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/.+/i;

export const SoundCloudRegex = /^https?:\/\/(www\.)?soundcloud\.com\/.+/i;

export const BandcampRegex = /^https?:\/\/.+\.bandcamp\.com\/(track|album)\/.+/i;

export const TwitchRegex = /^https?:\/\/(www\.)?twitch\.tv\/.+/i;

export const AppleMusicRegex = /^https?:\/\/music\.apple\.com\/.+/i;

export const DeezerRegex = /^https?:\/\/(www\.)?deezer\.com\/(track|album|playlist)\/.+/i;

export const AudioFileRegex = /^https?:\/\/.+\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)(\?.*)?$/i;

export const TidalRegex =
    /^https?:\/\/(?:(?:listen|www)\.)?tidal\.com\/(?:browse\/)?(?:album|track|playlist|mix)\/[a-zA-Z0-9\-]+(?:\/.*)?(?:\?.*)?$/i;

export const YandexMusicRegex =
    /^(?:https?:\/\/)?music\.yandex\.(?:ru|com|kz|by)\/(?:artist|album|track|users\/[0-9A-Za-z@.\-]+\/playlists|playlists)\/[0-9A-Za-z\-\.]+(?:\/track\/[0-9]+)?(?:\/)?$/i;

export const AmazonMusicRegex =
    /^https?:\/\/music\.amazon\.[^/]+\/(?:albums|tracks|artists|playlists|user-playlists|community-playlists)\/[A-Za-z0-9]+(?:\/[^/?#]+)?(?:[/?].*)?$/i;

export const JioSaavnRegex =
    /^(?:https?:\/\/)?(?:www\.)?jiosaavn\.com\/(?:song|album|featured|artist|s\/playlist)\/[a-zA-Z0-9\-_]+(?:\/[a-zA-Z0-9\-_]+)?$/i;

export const PandoraRegex =
    /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/(?:playlist\/PL:[\d:]+|artist\/[\w\-]+(?:\/[\w\-]+)*\/(?:TR|AL|AR)[A-Za-z0-9]+)(?:[?#].*)?$/i;

export const QobuzRegex =
    /^https?:\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:(?:[a-z]{2}-[a-z]{2}\/)?(?:album|playlist|track|artist)\/(?:.+?\/)?[a-zA-Z0-9]+|playlist\/\d+)$/i;

export const AudiomackRegex =
    /^https?:\/\/audiomack\.com\/(?:(?:[^/]+\/(?:song|album|playlist)|(?:song|album|playlist))\/[^/?#]+)$/i;

export const MixcloudRegex =
    /^https?:\/\/(?:(?:www|beta|m)\.)?mixcloud\.com\/[^/]+\/(?:playlists\/[^/]+|(?!stream|uploads|favorites|listens|playlists)[^/]+|(?:uploads|favorites|listens|stream))(?:\/)?$/i;

export const AnghamiRegex = /^https?:\/\/(?:play\.)?anghami\.com\/(?:song|album|playlist|artist)\/[0-9]+$/i;

export const AudiusRegex = /^https?:\/\/(?:www\.)?audius\.co\/[^/]+\/[^/]+$/i;

export const GaanaRegex = /^https?:\/\/(?:www\.)?gaana\.com\/(?:song|album|playlist)\/[^/]+$/i;

export const InstagramRegex = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_\-]+(?:\/)?$/i;

export const ShazamRegex = /^https?:\/\/(?:www\.)?shazam\.com\/track\/[0-9]+$/i;
