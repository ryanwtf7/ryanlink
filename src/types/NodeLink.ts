import type { AudioFilters } from './Filters'
import type { AudioTrack } from './Track'

export type NodeLinkEventTypes =
  | 'PlayerCreatedEvent'
  | 'PlayerDestroyedEvent'
  | 'PlayerConnectedEvent'
  | 'PlayerReconnectingEvent'
  | 'VolumeChangedEvent'
  | 'FiltersChangedEvent'
  | 'SeekEvent'
  | 'PauseEvent'
  | 'ConnectionStatusEvent'
  | 'MixStartedEvent'
  | 'MixEndedEvent'
  | 'LyricsFoundEvent'
  | 'LyricsLineEvent'
  | 'LyricsNotFoundEvent'
  | 'WorkerFailedEvent'
  | 'StreamMetadataEvent'
  | 'EternalBoxInfoEvent'
  | 'EternalBoxJumpEvent'

export interface NodeLinkBaseEvent {
  op: 'event'
  type: NodeLinkEventTypes
  guildId: string
}

export interface PlayerCreatedEvent extends NodeLinkBaseEvent {
  type: 'PlayerCreatedEvent'
  player: {
    guildId: string
    track: AudioTrack | null
    paused: boolean
    volume: number
  }
}

export interface PlayerDestroyedEvent extends NodeLinkBaseEvent {
  type: 'PlayerDestroyedEvent'
}

export interface PlayerConnectedEvent extends NodeLinkBaseEvent {
  type: 'PlayerConnectedEvent'
  voice: {
    sessionId: string
    token: string
    endpoint: string
    channelId: string
  }
}

export interface PlayerReconnectingEvent extends NodeLinkBaseEvent {
  type: 'PlayerReconnectingEvent'
  voice: {
    sessionId: string
    token: string
    endpoint: string
    channelId: string
  }
}

export interface VolumeChangedEvent extends NodeLinkBaseEvent {
  type: 'VolumeChangedEvent'
  volume: number
}

export interface FiltersChangedEvent extends NodeLinkBaseEvent {
  type: 'FiltersChangedEvent'
  filters: AudioFilters
}

export interface SeekEvent extends NodeLinkBaseEvent {
  type: 'SeekEvent'
  position: number
}

export interface PauseEvent extends NodeLinkBaseEvent {
  type: 'PauseEvent'
  paused: boolean
}

export interface ConnectionStatusEvent extends NodeLinkBaseEvent {
  type: 'ConnectionStatusEvent'
  status: string
  metrics: {
    speed?: { mbps: number }
    timestamp: number
    latency?: number
    error?: string
  } | null
}

export interface MixStartedEvent extends NodeLinkBaseEvent {
  type: 'MixStartedEvent'
  mixId: string
  track: AudioTrack
  volume: number
}

export interface MixEndedEvent extends NodeLinkBaseEvent {
  type: 'MixEndedEvent'
  mixId: string
  reason: 'FINISHED' | 'REMOVED' | 'ERROR' | 'MAIN_ENDED' | string
}

export interface WorkerFailedEvent extends NodeLinkBaseEvent {
  type: 'WorkerFailedEvent'
  affectedGuilds: string[]
  message: string
}

export interface StreamMetadataEvent extends NodeLinkBaseEvent {
  type: 'StreamMetadataEvent'
  stream: {
    metadata: {
      streamTitle?: string
      streamUrl?: string
      [key: string]: unknown
    }
  }
}

export interface EternalBoxInfoEvent extends NodeLinkBaseEvent {
  type: 'EternalBoxInfoEvent'
  eternalbox: Record<string, unknown>
}

export interface EternalBoxJumpEvent extends NodeLinkBaseEvent {
  type: 'EternalBoxJumpEvent'
  fromBeat: number
  toBeat: number
  jumpType: string
}

export type NodeLinkEventPayload<T extends NodeLinkEventTypes> = T extends 'PlayerCreatedEvent'
  ? PlayerCreatedEvent
  : T extends 'PlayerDestroyedEvent'
    ? PlayerDestroyedEvent
    : T extends 'PlayerConnectedEvent'
      ? PlayerConnectedEvent
      : T extends 'PlayerReconnectingEvent'
        ? PlayerReconnectingEvent
        : T extends 'VolumeChangedEvent'
          ? VolumeChangedEvent
          : T extends 'FiltersChangedEvent'
            ? FiltersChangedEvent
            : T extends 'SeekEvent'
              ? SeekEvent
              : T extends 'PauseEvent'
                ? PauseEvent
                : T extends 'ConnectionStatusEvent'
                  ? ConnectionStatusEvent
                  : T extends 'MixStartedEvent'
                    ? MixStartedEvent
                    : T extends 'MixEndedEvent'
                      ? MixEndedEvent
                      : T extends 'WorkerFailedEvent'
                        ? WorkerFailedEvent
                        : T extends 'StreamMetadataEvent'
                          ? StreamMetadataEvent
                          : T extends 'EternalBoxInfoEvent'
                            ? EternalBoxInfoEvent
                            : T extends 'EternalBoxJumpEvent'
                              ? EternalBoxJumpEvent
                              : never

export type HealthStatusThreshold = { excellent: number; good: number; fair: number; poor: number }
export type HealthStatusThresholdOptions = {
  cpu: Partial<HealthStatusThreshold>
  memory: Partial<HealthStatusThreshold>
  ping: Partial<HealthStatusThreshold>
}
export type NodeMetricSummary = {
  cpuLoad: number
  systemLoad: number
  memoryUsage: number
  players: number
  playingPlayers: number
  uptime: number
  ping: number
  frameDeficit: number
}
export type HealthStatusObject = {
  status: HealthStatusKeys
  performance: HealthPerformanceKeys
  isOverloaded: boolean
  needsRestart: boolean
  penaltyScore: number
  estimatedRemainingCapacity: number
  recommendations: string[]
  metrics: {
    cpuLoad: number
    memoryUsage: number
    players: number
    playingPlayers: number
    uptime: number
    ping: number
    frameDeficit: number
  }
}

export type HealthPerformanceKeys = 'excellent' | 'good' | 'fair' | 'poor'
export type HealthStatusKeys = 'healthy' | 'degraded' | 'critical' | 'offline'

export type AddMixerLayerResponse = {
  id: string
  track: AudioTrack
  volume: number
}

export type ListMixerLayersResponse = {
  mixes: {
    id: string
    track: AudioTrack
    volume: number
    position: number
    startTime: number
  }[]
}

export type ConnectionMetricsResponse = {
  status: string
  metrics: {
    speed: {
      bps: number
      kbps: number
      mbps: number
    }
    downloadedBytes: number
    durationSeconds: number
    timestamp: number
  }
}

export type NodeLinkLyricsLine = {
  text: string
  time: number
  duration: number
}

export type NodeLinkLyricsLinePlain = {
  text: string
  time: null
  duration: null
}

export type NodeLinkLyricsSynced = {
  loadType: string
  data: {
    synced: true
    lang: string
    source: string
    lines: NodeLinkLyricsLine[]
  }
}

export type NodeLinkLyricsPlain = {
  loadType: string
  data: {
    synced: false
    lang: string
    source: string
    lines: NodeLinkLyricsLinePlain[]
  }
}

export type NodeLinkLyrics = NodeLinkLyricsSynced | NodeLinkLyricsPlain

export type NodeLinkNoLyrics = {
  loadType: string
  data: {}
}

export type NodeLinkChapter = {
  title: string
  startTime: number
  thumbnails: [
    {
      url: string
      width: number
      height: number
    },
  ]
  duration: number
  endTime: number
}

export type DirectStreamResponse = {
  url: string
  protocol: string
  format: string
  hlsUrl: string | null
  formats: {
    itag: number
    mimeType: string
    qualityLabel: string
    bitrate: number
  }[]
}

export type YoutubeOAuthResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

export type MeaningResponse = {
  loadType: 'meaning'
  data: {
    title: string
    description: string
    paragraphs: string[]
    url: string
    provider: string
    type: string
  }
}

export type WorkerInfo = {
  id: number
  clusterId: number
  pid: number
  status: string
  players: number
  uptime: number
  memory: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
}

export type WorkersResponse = {
  workers: WorkerInfo[]
  total: number
}

export type YoutubeConfigResponse = {
  refreshToken: string
  visitorData: string | null
  isConfigured: boolean
  isValid: boolean | null
}

export type EncodeTrackResponse = {
  encoded: string
}

export type EncodeTracksResponse = Array<{
  encoded: string | null
  error?: string
}>

export type FadingCurve = 'linear' | 'exponential' | 'logarithmic' | 's-curve'

export type FadingStepConfig = {
  duration?: number
  curve?: FadingCurve
}

export type FadingConfig = {
  enabled?: boolean
  trackStart?: FadingStepConfig
  trackEnd?: FadingStepConfig
  stop?: FadingStepConfig
  trackStop?: FadingStepConfig
  seek?: FadingStepConfig
  ducking?: FadingStepConfig & { volume?: number }
}

export type LoadLyricsResponse = NodeLinkLyrics | NodeLinkNoLyrics

export type LoadChaptersResponse = NodeLinkChapter[] | { loadType: 'empty'; data: Record<string, never> }

export type NodeLinkDetailedStats = {
  players: number
  playingPlayers: number
  uptime: number
  memory: {
    free: number
    used: number
    allocated: number
    reservable: number
  }
  cpu: {
    cores: number
    systemLoad: number
    processLoad: number
  }
  frameStats: {
    sent: number
    nulled: number
    deficit: number
    expected: number
  } | null
  detailedStats?: {
    api: {
      requests: Record<string, number>
      errors: Record<string, number>
    }
    sources: Record<string, number>
    playback: {
      events: Record<string, number>
    }
    [key: string]: unknown
  }
}

export type NodeLinkInfo = {
  version: {
    semver: string
    major: number
    minor: number
    patch: number
    preRelease?: string
    build?: string
  }
  buildTime: number
  git: {
    branch: string
    commit: string
    commitTime: number
  }
  jvm: string
  lavaplayer: string
  sourceManagers: string[]
  filters: string[]
  plugins: { name: string; version: string }[]
  enableHoloTracks?: boolean
  enableTrackStreamEndpoint?: boolean
  enableLoadStreamEndpoint?: boolean
}
