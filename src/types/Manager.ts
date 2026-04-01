import type { DebugEvents } from '../config/Constants'
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
  SponsorBlockChaptersLoaded,
  SponsorBlockChapterStarted,
  SponsorBlockSegmentSkipped,
  SponsorBlockSegmentsLoaded,
  TrackExceptionEvent,
  TrackEndEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,
  TrackStartEvent,
  LyricsFoundEvent,
  LyricsNotFoundEvent,
  LyricsLineEvent,
} from './Utils'

export interface ManagerEvents<CustomPlayerT extends Player = Player> {
  trackStart: (player: CustomPlayerT, track: Track | null, payload: TrackStartEvent) => void

  trackEnd: (player: CustomPlayerT, track: Track | null, payload: TrackEndEvent) => void

  trackStuck: (player: CustomPlayerT, track: Track | null, payload: TrackStuckEvent) => void

  trackError: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: TrackExceptionEvent) => void

  queueEnd: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: TrackEndEvent | TrackStuckEvent | TrackExceptionEvent) => void

  playerCreate: (player: CustomPlayerT) => void

  playerMove: (player: CustomPlayerT, oldVoiceChannelId: string, newVoiceChannelId: string) => void

  playerDisconnect: (player: CustomPlayerT, voiceChannelId: string) => void

  playerReconnect: (player: CustomPlayerT, voiceChannelId: string) => void

  playerSocketClosed: (player: CustomPlayerT, payload: WebSocketClosedEvent) => void

  playerDestroy: (player: CustomPlayerT, destroyReason?: DestroyReasonsType) => void

  playerUpdate: (oldPlayerJson: PlayerJson, newPlayer: CustomPlayerT) => void

  playerClientUpdate: (oldPlayerJson: PlayerJson, newPlayer: CustomPlayerT) => void

  playerMuteChange: (player: CustomPlayerT, selfMuted: boolean, serverMuted: boolean) => void

  playerDeafChange: (player: CustomPlayerT, selfDeafed: boolean, serverDeafed: boolean) => void

  playerSuppressChange: (player: CustomPlayerT, suppress: boolean) => void

  playerQueueEmptyStart: (player: CustomPlayerT, timeoutMs: number) => void

  playerQueueEmptyEnd: (player: CustomPlayerT) => void

  playerQueueEmptyCancel: (player: CustomPlayerT) => void

  playerVoiceJoin: (player: CustomPlayerT, userId: string) => void

  playerVoiceLeave: (player: CustomPlayerT, userId: string) => void

  SegmentsLoaded: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: SponsorBlockSegmentsLoaded) => void

  SegmentSkipped: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: SponsorBlockSegmentSkipped) => void

  ChapterStarted: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: SponsorBlockChapterStarted) => void

  ChaptersLoaded: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: SponsorBlockChaptersLoaded) => void

  debug: (
    eventKey: DebugEvents,
    eventData: {
      message: string
      state: 'log' | 'warn' | 'error'
      error?: Error | string
      functionLayer: string
    }
  ) => void

  LyricsLine: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: LyricsLineEvent) => void

  LyricsFound: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: LyricsFoundEvent) => void

  LyricsNotFound: (player: CustomPlayerT, track: Track | UnresolvedTrack | null, payload: LyricsNotFoundEvent) => void

  playerResumed: (player: CustomPlayerT, track: Track | UnresolvedTrack | null) => void

  playerPaused: (player: CustomPlayerT, track: Track | UnresolvedTrack | null) => void

  queueErrorReport: (player: CustomPlayerT, track: Track | UnresolvedTrack, error: any) => void
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

  client?: BotClientOptions

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
