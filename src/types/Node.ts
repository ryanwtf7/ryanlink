import type { RyanlinkNode } from '../node/Node'
import type { PluginInfo } from './Track'
import type { DestroyReasonsType } from './Player'

export type ModifyRequest = (options: RequestInit & { path: string; extraQueryUrlParams?: URLSearchParams }) => void

export type SponsorBlockSegment = 'sponsor' | 'selfpromo' | 'interaction' | 'intro' | 'outro' | 'preview' | 'music_offtopic' | 'filler' | 'poi_highlight'

export interface SponsorBlockOptions {
  enabled?: boolean
  categories?: SponsorBlockSegment[]
  categoryBehaviors?: Record<string, string>
  autoSkip?: boolean
  fastForward?: boolean
  minDuration?: number
  minViews?: number
  maxRetries?: number
  requestTimeout?: number
  segmentSkipping?: boolean
  skipAccuracy?: number
  strict?: boolean
  userAgent?: string
  voteThreshold?: number
  allowVoting?: boolean
  cacheExpiry?: number
  cacheSize?: number
}

export interface LavaXMOptions {
  amigaMixer?: boolean
  ampFactor?: number
  defaultPan?: number
  fixSampleLoop?: boolean
  fx9Bug?: boolean
  interpolation?: number
  vblank?: boolean
}

export interface DuncteBotOptions {
  sources?: {
    clypit?: boolean
    getyarn?: boolean
    mixcloud?: boolean
    ocremix?: boolean
    pixeldrain?: boolean
    pornhub?: boolean
    reddit?: boolean
    soundgasm?: boolean
    tiktok?: boolean
    tts?: boolean
  }
  ttsLanguage?: string
}

export interface LavaDSPXOptions {
  enabled?: boolean
  normalization?: {
    enabled?: boolean
    maxAmplification?: number
  }
  'echo-cancellation'?: {
    enabled?: boolean
    strength?: number
  }
  highpass?: {
    enabled?: boolean
    cutoffFrequency?: number
    order?: number
  }
  lowpass?: {
    enabled?: boolean
    cutoffFrequency?: number
    order?: number
  }
}

export interface LavaLyricsOptions {
  sources?: string[]
}

export interface LavaSearchOptions {
  [key: string]: unknown
}

export interface NodeConfiguration {
  nodeType?: NodeTypes

  host: string

  port: number

  authorization: string

  secure?: boolean

  sessionId?: string

  id?: string

  regions?: string[]

  retryAmount?: number

  retryDelay?: number

  retryTimespan?: number

  requestSignalTimeoutMS?: number

  closeOnError?: boolean

  heartBeatInterval?: number

  enablePingOnStatsCheck?: boolean

  autoChecks?: {
    pluginValidations?: boolean

    sourcesValidations?: boolean
  }

  lavalyrics?: LavaLyricsOptions

  lavasearch?: LavaSearchOptions

  sponsorblock?: SponsorBlockOptions

  xm?: LavaXMOptions

  dunctebot?: DuncteBotOptions

  lavadspx?: LavaDSPXOptions

  resuming?: {
    enabled: boolean
    timeout: number
  }
}

export interface MemoryStats {
  free: number

  used: number

  allocated: number

  reservable: number
}

export interface CPUStats {
  cores: number

  systemLoad: number

  audioLoad: number
}

export interface FrameStats {
  sent?: number

  nulled?: number

  deficit?: number
}

export interface BaseNodeStats {
  players: number

  playingPlayers: number

  uptime: number

  memory: MemoryStats

  cpu: CPUStats

  frameStats: FrameStats
}

export interface NodeLinkConnectionMetrics {
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

export interface NodeStats extends BaseNodeStats {
  frameStats: FrameStats

  detailedStats?: {
    api: {
      requests: Record<string, number>
      errors: unknown
    }

    sources: Record<string, number>
    playback: {
      events: Record<string, number>
    }

    [key: string]: unknown
  }
}

export interface NodeInfo {
  version: VersionObject

  buildTime: number

  git: GitObject

  jvm: string

  playerEngine: string

  sourceManagers: string[]

  filters: string[]

  plugins: PluginObject[]

  isNodelink?: boolean
}

export interface VersionObject {
  semver: string

  major: number

  minor: number

  patch: number

  preRelease?: string

  build?: string
}

export interface GitObject {
  branch: string

  commit: string

  commitTime: string
}

export interface PluginObject {
  name: string

  version: string
}

export interface LyricsResult {
  sourceName: string

  provider: string

  text?: string | null

  lines: LyricsLine[]

  plugin: PluginInfo
}

export interface LyricsLine {
  line: string

  timestamp: number

  duration?: number | null

  plugin: PluginInfo
}
export type RyanlinkNodeIdentifier = string

export interface NodeManagerEvents {
  nodeCreate: (node: RyanlinkNode) => void

  nodeDestroy: (node: RyanlinkNode, destroyReason?: DestroyReasonsType) => void

  nodeConnect: (node: RyanlinkNode) => void

  nodeReconnect: (node: RyanlinkNode) => void

  nodeDisconnect: (node: RyanlinkNode, reason: { code?: number; reason?: string }) => void

  nodeError: (node: RyanlinkNode, error: Error, payload?: unknown) => void

  nodeReady: (node: RyanlinkNode, payload: { resumed: boolean; sessionId: string }) => void

  nodeRaw: (node: RyanlinkNode, payload: unknown) => void
}

export enum ReconnectionState {
  IDLE = 'IDLE',
  RECONNECTING = 'RECONNECTING',
  PENDING = 'PENDING',
  DESTROYING = 'DESTROYING',
}

export type NodeTypes = 'LavaLink' | 'NodeLink' | 'Core'
