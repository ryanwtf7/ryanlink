import type { ClientCustomSearchPlatformUtils, RyanlinkSearchPlatform, SearchPlatform, SourcesRegex } from '../types/Utils'

export const SourceMappings: Record<SearchPlatform, RyanlinkSearchPlatform | ClientCustomSearchPlatformUtils> = {
  'youtube music': 'ytmsearch',
  youtubemusic: 'ytmsearch',
  ytmsearch: 'ytmsearch',
  ytm: 'ytmsearch',
  musicyoutube: 'ytmsearch',
  'music youtube': 'ytmsearch',

  youtube: 'ytsearch',
  yt: 'ytsearch',
  ytsearch: 'ytsearch',

  soundcloud: 'scsearch',
  scsearch: 'scsearch',
  sc: 'scsearch',

  'apple music': 'amsearch',
  apple: 'amsearch',
  applemusic: 'amsearch',
  amsearch: 'amsearch',
  am: 'amsearch',
  musicapple: 'amsearch',
  'music apple': 'amsearch',

  spotify: 'spsearch',
  spsearch: 'spsearch',
  sp: 'spsearch',
  'spotify.com': 'spsearch',
  spotifycom: 'spsearch',
  sprec: 'sprec',
  spsuggestion: 'sprec',

  deezer: 'dzsearch',
  dz: 'dzsearch',
  dzsearch: 'dzsearch',
  dzisrc: 'dzisrc',
  dzrec: 'dzrec',

  'yandex music': 'ymsearch',
  yandexmusic: 'ymsearch',
  yandex: 'ymsearch',
  ymsearch: 'ymsearch',
  ymrec: 'ymrec',

  vksearch: 'vksearch',
  vkmusic: 'vksearch',
  'vk music': 'vksearch',
  vkrec: 'vkrec',
  vk: 'vksearch',

  qbsearch: 'qbsearch',
  qobuz: 'qbsearch',
  qbisrc: 'qbisrc',
  qbrec: 'qbrec',
  qb: 'qbsearch',

  pandora: 'pdsearch',
  pd: 'pdsearch',
  pdsearch: 'pdsearch',
  pdisrc: 'pdisrc',
  pdrec: 'pdrec',
  'pandora music': 'pdsearch',
  pandoramusic: 'pdsearch',

  speak: 'speak',
  tts: 'tts',
  ftts: 'ftts',
  flowery: 'ftts',
  'flowery.tts': 'ftts',
  flowerytts: 'ftts',

  bandcamp: 'bcsearch',
  bc: 'bcsearch',
  bcsearch: 'bcsearch',

  phsearch: 'phsearch',
  pornhub: 'phsearch',
  porn: 'phsearch',

  local: 'local',
  http: 'http',
  https: 'https',
  link: 'link',
  uri: 'uri',

  tidal: 'tdsearch',
  td: 'tdsearch',
  'tidal music': 'tdsearch',
  tdsearch: 'tdsearch',
  tdrec: 'tdrec',

  jiosaavn: 'jssearch',
  js: 'jssearch',
  jssearch: 'jssearch',
  jsrec: 'jsrec',

  audiomack: 'admsearch',
  adm: 'admsearch',
  admsearch: 'admsearch',
  admrec: 'admrec',

  shazam: 'shsearch',
  sh: 'shsearch',
  shsearch: 'shsearch',
  szsearch: 'shsearch',

  instagram: 'igsearch',
  ig: 'igsearch',
  igsearch: 'igsearch',

  bilibili: 'blsearch',
  bl: 'blsearch',
  blsearch: 'blsearch',

  lastfm: 'lfsearch',
  'last.fm': 'lfsearch',
  lf: 'lfsearch',
  lfsearch: 'lfsearch',

  'amazon music': 'amzsearch',
  amazonmusic: 'amzsearch',
  amz: 'amzsearch',
  amzsearch: 'amzsearch',
  amzrec: 'amzrec',

  gaana: 'gnsearch',
  gn: 'gnsearch',
  gnsearch: 'gnsearch',
  gnrec: 'gnrec',
  gaanasearch: 'gnsearch',

  mcsearch: 'mcsearch',
  mixcloud: 'mcsearch',

  ncsearch: 'ncsearch',
  nicovideo: 'ncsearch',

  ebsearch: 'ebsearch',
  ebox: 'ebsearch',
  jukebox: 'ebsearch',
  eternalbox: 'ebsearch',

  slsearch: 'slsearch',
  songlink: 'slsearch',
  odesli: 'slsearch',

  anghami: 'agsearch',
  ag: 'agsearch',
  agsearch: 'agsearch',
  agrec: 'agrec',

  audius: 'ausearch',
  ausearch: 'ausearch',

  kwai: 'kwsearch',
  kw: 'kwsearch',
  kwsearch: 'kwsearch',

  netease: 'nesearch',
  ne: 'nesearch',
  nesearch: 'nesearch',

  letrasmus: 'lmsearch',
  lm: 'lmsearch',
  lmsearch: 'lmsearch',
  letras: 'lmsearch',

  monochrome: 'monosearch',
  monosearch: 'monosearch',

  bluesky: 'bksearch',
  bksearch: 'bksearch',

  azsearch: 'azsearch',
  pipertts: 'pipertts',
  gtts: 'gtts',
}

export const BuiltinSources = {

  DuncteBot_Plugin: 'skybot-lavalink-plugin',

  GoogleCloudTTS: 'tts-plugin',

  LavaSrc: 'lavasrc-plugin',

  LavaSearch: 'lavasearch-plugin',

  LavaLyrics: 'lavalyrics-plugin',

  SponsorBlock: 'sponsorblock-plugin',

  LavaDSPX: 'LavaDSPX-Plugin',

  JavaTimedLyrics: 'java-lyrics-plugin',

  LyricsKt: 'lyrics',

  LavaXM: 'lava-xm-plugin',

  Filter_Engine: 'filter-engine',

  TimedLyrics_Engine: 'lyrics-engine',
}

export const LinkMatchers: Record<SourcesRegex, RegExp> = {
  YoutubeRegex:
    /https?:\/\/?(?:www\.)?(?:(m|www)\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts|playlist\?|watch\?v=|watch\?.+(?:&|&#38;);v=))([a-zA-Z0-9\-_]{11})?(?:(?:\?|&|&#38;)index=((?:\d){1,3}))?(?:(?:\?|&|&#38;)?list=([a-zA-Z\-_0-9]{34}))?(?:\S+)?/,
  YoutubeMusicRegex:
    /https?:\/\/?(?:www\.)?(?:(music|m|www)\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts|playlist\?|watch\?v=|watch\?.+(?:&|&#38;);v=))([a-zA-Z0-9\-_]{11})?(?:(?:\?|&|&#38;)index=((?:\d){1,3}))?(?:(?:\?|&|&#38;)?list=([a-zA-Z\-_0-9]{34}))?(?:\S+)?/,

  SoundCloudRegex: /https?:\/\/(?:on\.)?soundcloud\.com\//,
  SoundCloudMobileRegex: /https?:\/\/(soundcloud\.app\.goo\.gl)\/(\S+)/,
  bandcamp: /https?:\/\/?(?:www\.)?([\d|\w]+)\.bandcamp\.com\/(\S+)/,
  TwitchTv: /https?:\/\/?(?:www\.)?twitch\.tv\/\w+/,
  vimeo: /https?:\/\/(www\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|)(\d+)(?:|\/\?)/,

  mp3Url: /(https?|ftp|file):\/\/(www.)?(.*?)\.(mp3)$/,
  m3uUrl: /(https?|ftp|file):\/\/(www.)?(.*?)\.(m3u)$/,
  m3u8Url: /(https?|ftp|file):\/\/(www.)?(.*?)\.(m3u8)$/,
  mp4Url: /(https?|ftp|file):\/\/(www.)?(.*?)\.(mp4)$/,
  m4aUrl: /(https?|ftp|file):\/\/(www.)?(.*?)\.(m4a)$/,
  wavUrl: /(https?|ftp|file):\/\/(www.)?(.*?)\.(wav)$/,
  aacpUrl: /(https?|ftp|file):\/\/(www.)?(.*?)\.(aacp)$/,

  DeezerTrackRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?track\/(\d+)/,
  DeezerPageLinkRegex: /(https?:\/\/|)?(?:www\.)?deezer\.page\.link\/(\S+)/,
  DeezerPlaylistRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?playlist\/(\d+)/,
  DeezerAlbumRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?album\/(\d+)/,
  DeezerArtistRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?artist\/(\d+)/,
  DeezerMixesRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?mixes\/genre\/(\d+)/,
  DeezerEpisodeRegex: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?episode\/(\d+)/,

  AllDeezerRegexWithoutPageLink: /(https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|playlist|album|artist|mixes\/genre|episode)\/(\d+)/,
  AllDeezerRegex:
    /((https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|playlist|album|artist|mixes\/genre|episode)\/(\d+)|(https?:\/\/|)?(?:www\.)?deezer\.page\.link\/(\S+))/,

  SpotifySongRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?track\/(?<identifier>[a-zA-Z0-9-_]+)/,
  SpotifyPlaylistRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?playlist\/(?<identifier>[a-zA-Z0-9-_]+)/,
  SpotifyArtistRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?artist\/(?<identifier>[a-zA-Z0-9-_]+)/,
  SpotifyEpisodeRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?episode\/(?<identifier>[a-zA-Z0-9-_]+)/,
  SpotifyShowRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?show\/(?<identifier>[a-zA-Z0-9-_]+)/,
  SpotifyAlbumRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?album\/(?<identifier>[a-zA-Z0-9-_]+)/,
  AllSpotifyRegex:
    /(https?:\/\/)(www\.)?open\.spotify\.com\/((?<region>[a-zA-Z-]+)\/)?(user\/(?<user>[a-zA-Z0-9-_]+)\/)?(?<type>track|album|playlist|artist|episode|show)\/(?<identifier>[a-zA-Z0-9-_]+)/,

  appleMusic: /https?:\/\/?(?:www\.)?music\.apple\.com\/(\S+)/,
  tidal: /https?:\/\/?(?:www\.)?(?:tidal|listen)\.tidal\.com\/(?<type>track|album|playlist|artist)\/(?<identifier>[a-zA-Z0-9-_]+)/,
  jiosaavn: /(https?:\/\/)(www\.)?jiosaavn\.com\/(?<type>song|album|featured|artist)\/([a-zA-Z0-9-_/,]+)/,

  amazonmusic: /https?:\/\/(?:music|www)\.amazon\.(?:com|co\.uk|de|fr|es|it|co\.jp|ca|in|com\.br|com\.mx|com\.au)\/(\S+)/,
  gaana: /https?:\/\/gaana\.com\/(?:song|album|playlist)\/(\S+)/,
  audiomack: /https?:\/\/audiomack\.com\/(?:\w+)\/(?:song|album|playlist)\/(\S+)/,
  shazam: /https?:\/\/(?:www\.)?shazam\.com\/(?:track|discover)\/(\S+)/,
  qobuz: /https?:\/\/(?:www\.)?qobuz\.com\/(?:\w+)\/(?:album|track)\/(\S+)/,
  bilibili: /https?:\/\/(?:www\.)?bilibili\.com\/video\/(\S+)/,
  anghami: /https?:\/\/(?:www\.)?anghami\.com\/(?:song|album|playlist)\/(\S+)/,
  audius: /https?:\/\/audius\.co\/(?:\w+)\/(\S+)/,
  kwai: /https?:\/\/(?:www\.)?kwai\.com\/\S+/,
  netease: /https?:\/\/music\.163\.com\/\S+/,
  nicovideo: /https?:\/\/(?:www\.)?nicovideo\.jp\/watch\/(\S+)/,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?:reels|p|tv)\/(\S+)/,
  lastfm: /https?:\/\/(?:www\.)?last\.fm\/(?:music|user)\/(\S+)/,
  letrasmus: /https?:\/\/(?:www\.)?letras\.mus\.br\/\S+/,
  monochrome: /https?:\/\/(?:www\.)?monochrome\.net\/\S+/,
  eternalbox: /https?:\/\/(?:www\.)?eternalbox\.dev\/\S+/,
  bluesky: /https?:\/\/(?:www\.)?bsky\.app\/\S+/,
  songlink: /https?:\/\/(?:www\.)?(?:song\.link|album\.link|odesli\.co)\/\S+/,
  reddit: /https?:\/\/(?:www\.)?reddit\.com\/r\/\S+/,
  tumblr: /https?:\/\/(?:www\.)?tumblr\.com\/\S+/,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/\S+/,
  pinterest: /https?:\/\/(?:www\.)?pinterest\.com\/\S+/,
  iheartradio: /https?:\/\/(?:www\.)?iheart\.com\/\S+/,

  PandoraTrackRegex: /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/artist\/[\w-]+(?:\/[\w-]+)*\/(?<identifier>TR[A-Za-z0-9]+)(?:[?#].*)?$/,
  PandoraAlbumRegex: /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/artist\/[\w-]+(?:\/[\w-]+)*\/(?<identifier>AL[A-Za-z0-9]+)(?:[?#].*)?$/,
  PandoraArtistRegex: /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/artist\/[\w-]+\/(?<identifier>AR[A-Za-z0-9]+)(?:[?#].*)?$/,
  PandoraPlaylistRegex: /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/playlist\/(?<identifier>PL:[\d:]+)(?:[?#].*)?$/,
  AllPandoraRegex:
    /^@?(?:https?:\/\/)?(?:www\.)?pandora\.com\/(?:playlist\/(?<playlistId>PL:[\d:]+)|artist\/[\w-]+(?:\/[\w-]+)*\/(?<identifier>(?:TR|AL|AR)[A-Za-z0-9]+))(?:[?#].*)?$/,

  tiktok: /https:\/\/www\.tiktok\.com\//,
  mixcloud: /https:\/\/www\.mixcloud\.com\//,
  musicYandex: /https:\/\/music\.yandex\.ru\//,
  radiohost: /https?:\/\/[^.\s]+\.radiohost\.de\/(\S+)/,
}
