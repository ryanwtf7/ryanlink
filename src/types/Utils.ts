import type { MiniMap } from '../utils/Utils'

import type { AudioFilters } from './Filters'
import type { LyricsLine, LyricsResult, NodeStats } from './Node'
import type { PlayConfiguration } from './Player'
import type { AudioTrack, PluginInfo, Track, UnresolvedTrack } from './Track'

export type Opaque<T, K> = T & { __opaque__: K }

export type IntegerNumber = Opaque<number, 'Int'>

export type FloatNumber = Opaque<number, 'Float'>

export type SourceSearchPlatformBase =
  | 'spsearch'
  | 'sprec'
  | 'amsearch'
  | 'dzsearch'
  | 'dzisrc'
  | 'dzrec'
  | 'ymsearch'
  | 'ymrec'
  | 'vksearch'
  | 'vkrec'
  | 'tdsearch'
  | 'tdrec'
  | 'qbsearch'
  | 'qbisrc'
  | 'qbrec'
  | 'pdsearch'
  | 'pdisrc'
  | 'jssearch'
  | 'jsrec'
  | 'pdrec'
  | 'ftts'

export type DuncteSearchPlatform = 'speak' | 'phsearch' | 'pornhub' | 'porn' | 'tts'

export type ExtendedSearchPlatform =
  | 'admsearch'
  | 'admrec'
  | 'shsearch'
  | 'igsearch'
  | 'blsearch'
  | 'lfsearch'
  | 'amzsearch'
  | 'amzrec'
  | 'gnsearch'
  | 'gnrec'

  | 'mcsearch'
  | 'ncsearch'
  | 'ebox'
  | 'slsearch'
  | 'ausearch'
  | 'azsearch'
  | 'agsearch'
  | 'bksearch'
  | 'lmsearch'
  | 'pipertts'
  | 'gtts'

export type AudioClientSearchPlatform = 'bcsearch'
export type AudioClientSearchPlatformResolve = 'bandcamp' | 'bc'

export type RyanlinkSearchPlatform =
  | 'ytsearch'
  | 'ytmsearch'
  | 'scsearch'
  | 'bcsearch'
  | SourceSearchPlatformBase
  | DuncteSearchPlatform
  | ExtendedSearchPlatform
  | AudioClientSearchPlatform

export type ClientCustomSearchPlatformUtils = 'local' | 'http' | 'https' | 'link' | 'uri'

export type ClientSearchPlatform =
  | ClientCustomSearchPlatformUtils
  | 'youtube'
  | 'yt'
  | 'youtube music'
  | 'youtubemusic'
  | 'ytm'
  | 'musicyoutube'
  | 'music youtube'
  | 'soundcloud'
  | 'sc'
  | 'am'
  | 'apple music'
  | 'applemusic'
  | 'apple'
  | 'musicapple'
  | 'music apple'
  | 'sp'
  | 'spsuggestion'
  | 'spotify'
  | 'spotify.com'
  | 'spotifycom'
  | 'dz'
  | 'deezer'
  | 'yandex'
  | 'yandex music'
  | 'yandexmusic'
  | 'vk'
  | 'vk music'
  | 'vkmusic'
  | 'tidal'
  | 'tidal music'
  | 'qobuz'
  | 'pandora'
  | 'pd'
  | 'pandora music'
  | 'pandoramusic'
  | 'flowerytts'
  | 'flowery'
  | 'flowery.tts'
  | AudioClientSearchPlatformResolve
  | AudioClientSearchPlatform
  | 'js'
  | 'jiosaavn'
  | 'td'
  | 'tidal'
  | 'tdrec'
  | 'audiomack'
  | 'adm'
  | 'admsearch'
  | 'shazam'
  | 'sh'
  | 'shsearch'
  | 'instagram'
  | 'ig'
  | 'igsearch'
  | 'bilibili'
  | 'bl'
  | 'blsearch'
  | 'lastfm'
  | 'last.fm'
  | 'lf'
  | 'lfsearch'
  | 'amazon music'
  | 'amazonmusic'
  | 'amz'
  | 'amzsearch'
  | 'gaana'
  | 'gn'
  | 'gnsearch'
  | 'td'
  | 'tidal'
  | 'tdrec'

  | 'mcsearch'
  | 'mixcloud'
  | 'ncsearch'
  | 'nicovideo'
  | 'ebox'
  | 'jukebox'
  | 'slsearch'
  | 'songlink'
  | 'odesli'
  | 'ausearch'
  | 'audius'
  | 'azsearch'
  | 'agsearch'
  | 'anghami'
  | 'bksearch'
  | 'bluesky'
  | 'lmsearch'
  | 'letras'
  | 'pipertts'
  | 'gtts'
  | 'szsearch'
  | 'gaanasearch'

export type SearchPlatform = RyanlinkSearchPlatform | ClientSearchPlatform

export type SourcesRegex =
  | 'YoutubeRegex'
  | 'YoutubeMusicRegex'
  | 'SoundCloudRegex'
  | 'SoundCloudMobileRegex'
  | 'DeezerTrackRegex'
  | 'DeezerArtistRegex'
  | 'DeezerEpisodeRegex'
  | 'DeezerMixesRegex'
  | 'DeezerPageLinkRegex'
  | 'DeezerPlaylistRegex'
  | 'DeezerAlbumRegex'
  | 'AllDeezerRegex'
  | 'AllDeezerRegexWithoutPageLink'
  | 'SpotifySongRegex'
  | 'SpotifyPlaylistRegex'
  | 'SpotifyArtistRegex'
  | 'SpotifyEpisodeRegex'
  | 'SpotifyShowRegex'
  | 'SpotifyAlbumRegex'
  | 'AllSpotifyRegex'
  | 'mp3Url'
  | 'm3uUrl'
  | 'm3u8Url'
  | 'mp4Url'
  | 'm4aUrl'
  | 'wavUrl'
  | 'aacpUrl'
  | 'tiktok'
  | 'mixcloud'
  | 'musicYandex'
  | 'radiohost'
  | 'bandcamp'
  | 'jiosaavn'
  | 'appleMusic'
  | 'tidal'
  | 'PandoraTrackRegex'
  | 'PandoraAlbumRegex'
  | 'PandoraArtistRegex'
  | 'PandoraPlaylistRegex'
  | 'AllPandoraRegex'
  | 'TwitchTv'
  | 'vimeo'

export interface PlaylistInfo {
  name: string

  title: string

  author?: string

  thumbnail?: string

  uri?: string

  selectedTrack: Track | null

  duration: number
}

export interface SearchResult {
  loadType: LoadTypes
  exception: Exception | null
  pluginInfo: PluginInfo
  playlist: PlaylistInfo | null
  tracks: Track[]
}

export interface UnresolvedSearchResult {
  loadType: LoadTypes
  exception: Exception | null
  pluginInfo: PluginInfo
  playlist: PlaylistInfo | null
  tracks: UnresolvedTrack[]
}

export interface MiniMapConstructor {
  new (): MiniMap<unknown, unknown>
  new <K, V>(entries?: ReadonlyArray<readonly [K, V]> | null): MiniMap<K, V>
  new <K, V>(iterable: Iterable<readonly [K, V]>): MiniMap<K, V>
  readonly prototype: MiniMap<unknown, unknown>
  readonly [Symbol.species]: MiniMapConstructor
}

export type PlayerEvents =
  | TrackStartEvent
  | TrackEndEvent
  | TrackStuckEvent
  | TrackExceptionEvent
  | WebSocketClosedEvent
  | SponsorBlockSegmentEvents
  | LyricsEvent

export type Severity = 'COMMON' | 'SUSPICIOUS' | 'FAULT'

export interface Exception {
  severity: Severity

  error?: Error

  message: string

  cause: string

  causeStackTrace: string
}

export interface PlayerEvent {
  op: 'event'
  type: PlayerEventType
  guildId: string
}
export interface TrackStartEvent extends PlayerEvent {
  type: 'TrackStartEvent'
  track: AudioTrack
  playingQuality?: number | null
}

export interface TrackEndEvent extends PlayerEvent {
  type: 'TrackEndEvent'
  track: AudioTrack
  reason: TrackEndReason
}

export interface TrackExceptionEvent extends PlayerEvent {
  type: 'TrackExceptionEvent'
  exception?: Exception
  track: AudioTrack
  error: string
}

export interface TrackStuckEvent extends PlayerEvent {
  type: 'TrackStuckEvent'
  thresholdMs: number
  track: AudioTrack
}

export interface WebSocketClosedEvent extends PlayerEvent {
  type: 'WebSocketClosedEvent'
  code: number
  byRemote: boolean
  reason: string
}

export type SponsorBlockSegmentEvents =
  | SponsorBlockSegmentSkipped
  | SponsorBlockSegmentsLoaded
  | SponsorBlockChapterStarted
  | SponsorBlockChaptersLoaded

export type SponsorBlockSegmentEventType = 'SegmentSkipped' | 'SegmentsLoaded' | 'ChaptersLoaded' | 'ChapterStarted'

export interface SponsorBlockSegmentsLoaded extends PlayerEvent {
  type: 'SegmentsLoaded'

  segments: {
    category: string

    start: number

    end: number
  }[]
}
export interface SponsorBlockSegmentSkipped extends PlayerEvent {
  type: 'SegmentSkipped'

  segment: {
    category: string

    start: number

    end: number
  }
}

export interface SponsorBlockChapterStarted extends PlayerEvent {
  type: 'ChapterStarted'

  chapter: {
    name: string

    start: number

    end: number

    duration: number
  }
}

export interface SponsorBlockChaptersLoaded extends PlayerEvent {
  type: 'ChaptersLoaded'

  chapters: {
    name: string

    start: number

    end: number

    duration: number
  }[]
}

export type LyricsEvent = LyricsFoundEvent | LyricsNotFoundEvent | LyricsLineEvent

export type LyricsEventType = 'LyricsFoundEvent' | 'LyricsNotFoundEvent' | 'LyricsLineEvent'

export interface LyricsFoundEvent extends PlayerEvent {
  type: 'LyricsFoundEvent'

  guildId: string

  lyrics: LyricsResult
}

export interface LyricsNotFoundEvent extends PlayerEvent {
  type: 'LyricsNotFoundEvent'

  guildId: string
}

export interface LyricsLineEvent extends PlayerEvent {
  type: 'LyricsLineEvent'

  guildId: string

  lineIndex: number

  line: LyricsLine

  skipped: boolean
}

export type LoadTypes = 'track' | 'playlist' | 'search' | 'error' | 'empty'

export type State = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'DISCONNECTING' | 'DESTROYING'

export type PlayerEventType =
  | 'TrackStartEvent'
  | 'TrackEndEvent'
  | 'TrackExceptionEvent'
  | 'TrackStuckEvent'
  | 'WebSocketClosedEvent'
  | SponsorBlockSegmentEventType
  | LyricsEventType

export type TrackEndReason = 'finished' | 'loadFailed' | 'stopped' | 'replaced' | 'cleanup'

export interface InvalidRestRequest {
  timestamp: number

  status: number

  error: string

  message?: string

  trace?: unknown

  path: string
}
export interface VoiceConnectionState {
  token: string | null

  endpoint: string | null

  sessionId: string | null

  channelId: string | null

  connected?: boolean

  ping?: number
}

export interface VoiceConnectionOptions {
  token: string

  endpoint: string

  sessionId: string

  channelId: string
}

export interface FailingAddress {
  failingAddress: string

  failingTimestamp: number

  failingTime: string
}

export type RoutePlannerTypes = 'RotatingIpRoutePlanner' | 'NanoIpRoutePlanner' | 'RotatingNanoIpRoutePlanner' | 'BalancingIpRoutePlanner'

export interface RoutePlanner {
  class?: RoutePlannerTypes
  details?: {
    ipBlock: {
      type: 'Inet4Address' | 'Inet6Address'

      size: string
    }

    failingAddresses: FailingAddress[]

    rotateIndex?: string

    ipIndex?: string

    currentAddress?: string

    currentAddressIndex?: string

    blockIndex?: string
  }
}

export interface Session {
  resuming: boolean

  timeout: number
}

export interface GuildShardPayload {
  op: number

  d: {
    guild_id: string

    channel_id: string | null

    self_mute: boolean

    self_deaf: boolean
  }
}

export interface PlayerUpdateInfo {
  guildId: string

  playerOptions: PlayConfiguration

  noReplace?: boolean
}
export interface AudioPlayerState {
  guildId: string

  track?: AudioTrack

  volume: number

  paused: boolean

  voice: VoiceConnectionState

  filters: Partial<AudioFilters>

  state: {
    time: number

    position: number

    connected: boolean

    ping: number
  }
}

export interface ChannelDeletePacket {
  t: 'CHANNEL_DELETE'

  d: {
    guild_id: string

    id: string
  }
}
export interface VoiceState {
  op: 'voiceUpdate'

  guildId: string

  event: VoiceServer

  sessionId?: string

  guild_id: string

  user_id: string

  session_id: string

  channel_id: string

  mute: boolean

  deaf: boolean

  self_deaf: boolean

  self_mute: boolean

  self_video: boolean

  self_stream: boolean

  request_to_speak_timestamp: boolean

  suppress: boolean
}

export type Base64 = string

export interface VoiceServer {
  token: string

  guild_id: string

  endpoint: string

  channel_id?: string
}

export interface VoicePacket {
  t?: 'VOICE_SERVER_UPDATE' | 'VOICE_STATE_UPDATE'

  d: VoiceState | VoiceServer
}

export interface NodeMessage extends NodeStats {
  type: PlayerEventType

  op: 'stats' | 'playerUpdate' | 'event'

  guildId: string
}

export type AudioSearchType = 'track' | 'album' | 'artist' | 'playlist' | 'text' | 'tracks' | 'albums' | 'artists' | 'playlists' | 'texts'

export interface AudioSearchFilteredResponse {
  info: PlaylistInfo

  pluginInfo: PluginInfo

  tracks: Track[]
}

export interface AudioSearchResponse {
  tracks: Track[]

  albums: AudioSearchFilteredResponse[]

  artists: AudioSearchFilteredResponse[]

  playlists: AudioSearchFilteredResponse[]

  texts: {
    text: string
    pluginInfo: PluginInfo
  }[]

  pluginInfo: PluginInfo
}

export type SearchQuery =
  | {
      query: string

      extraQueryUrlParams?: URLSearchParams

      source?: SearchPlatform
    }
  | string

export type AudioSearchQuery = {
  query: string

  source: SourceSearchPlatformBase

  types?: AudioSearchType[]
}

export type Awaitable<T> = Promise<T> | T
