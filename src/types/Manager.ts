import type { AutoplayConfig } from '../audio/Player'
import type { RyanlinkManager } from '../core/Manager'
import type { Player } from '../audio/Player'

import type { NodeConfiguration } from './Node'
import type { DestroyReasonsType, PlayerJson, PlayerOptions } from './Player'
import type { ManagerQueueOptions } from './Queue'
import type { Track, UnresolvedTrack } from './Track'
import type {
  GuildShardPayload,
  SearchPlatform,
  TrackExceptionEvent,
  TrackEndEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,
  TrackStartEvent,
  LyricsFoundEvent,
  LyricsNotFoundEvent,
  LyricsLineEvent,
  SponsorBlockChaptersLoaded,
  SponsorBlockChapterStarted,
  SponsorBlockSegmentSkipped,
  SponsorBlockSegmentsLoaded,
} from './Utils'
import type { RyanlinkNode } from '../node/Node'

export interface ManagerEvents<CustomPlayerT extends Player = Player> {
  // Node Events
  nodeConnect: (node: RyanlinkNode) => void
  nodeDisconnect: (node: RyanlinkNode, reason: { code?: number; reason?: string }) => void
  nodeError: (node: RyanlinkNode, error: Error) => void
  nodeReady: (node: RyanlinkNode, payload: { resumed: boolean; sessionId: string }) => void
  nodeRaw: (node: RyanlinkNode, payload: unknown) => void

  // Player Events
  playerCreate: (player: CustomPlayerT) => void
  playerDestroy: (player: CustomPlayerT, reason?: DestroyReasonsType) => void
  playerUpdate: (player: CustomPlayerT, oldState: PlayerJson, newState: PlayerJson) => void
  playerMove: (player: CustomPlayerT, oldChannelId: string, newChannelId: string) => void
  playerDisconnect: (player: CustomPlayerT, channelId: string) => void
  playerSocketClosed: (player: CustomPlayerT, payload: WebSocketClosedEvent) => void

  // Track Events
  trackStart: (player: CustomPlayerT, track: Track, payload: TrackStartEvent) => void
  trackEnd: (player: CustomPlayerT, track: Track | null, payload: TrackEndEvent) => void
  trackStuck: (player: CustomPlayerT, track: Track, payload: TrackStuckEvent) => void
  trackError: (player: CustomPlayerT, track: Track | UnresolvedTrack, payload: TrackExceptionEvent) => void

  // Queue Events
  queueEnd: (player: CustomPlayerT) => void
  queueEmpty: (player: CustomPlayerT) => void

  // Plugin Events
  lyricsLine: (player: CustomPlayerT, track: Track, payload: LyricsLineEvent) => void
  lyricsFound: (player: CustomPlayerT, track: Track, payload: LyricsFoundEvent) => void
  lyricsNotFound: (player: CustomPlayerT, track: Track, payload: LyricsNotFoundEvent) => void

  sponsorBlockSegmentSkipped: (player: CustomPlayerT, track: Track, payload: SponsorBlockSegmentSkipped) => void
  sponsorBlockSegmentsLoaded: (player: CustomPlayerT, track: Track, payload: SponsorBlockSegmentsLoaded) => void
  sponsorBlockChapterStarted: (player: CustomPlayerT, track: Track, payload: SponsorBlockChapterStarted) => void
  sponsorBlockChaptersLoaded: (player: CustomPlayerT, track: Track, payload: SponsorBlockChaptersLoaded) => void

  // Debug
  debug: (name: string, data: { message: string; state: 'log' | 'warn' | 'error'; error?: Error | string; functionLayer: string }) => void
}

export interface BotClientOptions {
  id: string
  username?: string
  [x: string | number | symbol]: unknown
}

export interface ManagerPlayerOptions<CustomPlayerT extends Player = Player> {
  volumeDecrementer?: number
  clientBasedPositionUpdateInterval?: number
  defaultSearchPlatform?: SearchPlatform
  allowCustomSources?: boolean
  applyVolumeAsFilter?: boolean
  requesterTransformer?: (requester: unknown) => unknown
  onDisconnect?: {
    autoReconnect?: boolean
    autoReconnectOnlyWithTracks?: boolean
    destroyPlayer?: boolean
  }
  minAutoPlayMs?: number
  maxErrorsPerTime?: {
    threshold: number
    maxAmount: number
  }
  onEmptyQueue?: {
    autoPlayFunction?: (player: CustomPlayerT, lastPlayedTrack: Track) => Promise<void>
    destroyAfterMs?: number
  }
  autoplayConfig?: AutoplayConfig
  useUnresolvedData?: boolean
  enforceSponsorBlockRequestForEventEnablement?: boolean
  trackResolveRetryLimit?: number
  onTrackStart?: (player: CustomPlayerT, track: Track) => void
  onQueueEnd?: (player: CustomPlayerT) => void
  onNodeFailover?: (player: CustomPlayerT, from: any, to: any) => void
  fetchRelated?: (player: CustomPlayerT, track: Track) => Promise<Track[]>
}

export type DeepRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends object ? DeepRequired<NonNullable<T[K]>> : NonNullable<T[K]>
}

export type RequiredManagerOptions<T extends Player> = DeepRequired<RyanConfiguration<T>>

type PlayerConstructor<T extends Player = Player> = new (
  options: PlayerOptions,
  RyanlinkManager: RyanlinkManager,
  dontEmitPlayerCreateEvent?: boolean
) => T

export interface RyanConfiguration<CustomPlayerT extends Player = Player> {
  nodes: NodeConfiguration[]
  sendToShard: (guildId: string, payload: GuildShardPayload) => void
  client: BotClientOptions
  queueOptions?: ManagerQueueOptions
  playerOptions?: ManagerPlayerOptions<CustomPlayerT>
  playerClass?: PlayerConstructor<CustomPlayerT>
  autoSkip?: boolean
  resuming?: {
    enabled: boolean
    timeout: number
  }
  resume?: boolean
  autoMove?: boolean
  autoSkipOnResolveError?: boolean
  emitNewSongsOnly?: boolean
  linksWhitelist?: (RegExp | string)[]
  linksBlacklist?: (RegExp | string)[]
  linksAllowed?: boolean
  trackResolveRetryLimit?: number
  onTrackStart?: (player: CustomPlayerT, track: Track) => void
  onQueueEnd?: (player: CustomPlayerT) => void
  onNodeFailover?: (player: CustomPlayerT, from: any, to: any) => void
  advancedOptions?: {
    maxFilterFixDuration?: number
    enableDebugEvents?: boolean
    debugOptions?: {
      logCustomSearches?: boolean
      noAudio?: boolean
      playerDestroy?: {
        debugLog?: boolean
        dontThrowError?: boolean
      }
    }
  }
}
