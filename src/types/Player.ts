import type { DestroyReasons, DisconnectReasons } from '../config/Constants'
import type { RyanlinkNode } from '../node/Node'
import type { FadingConfig } from './NodeLink'

import type { EQBand, FilterData, AudioFilters } from './Filters'
import type { StoredQueue } from './Queue'
import type { Track, UnresolvedTrack } from './Track'
import type { Base64, VoiceConnectionOptions } from './Utils'

export type DestroyReasonsType = keyof typeof DestroyReasons | string

export type DisconnectReasonsType = keyof typeof DisconnectReasons | string

export interface PlayerJson {
  guildId: string

  options: PlayerOptions

  voiceChannelId: string

  textChannelId?: string

  position: number

  lastPosition: number

  lastPositionChange: number | null

  volume: number

  internalVolume: number

  repeatMode: RepeatMode

  paused: boolean

  playing: boolean

  createdTimeStamp?: number

  filters: FilterData

  ping: {
    ws: number

    node: number
  }

  equalizer: EQBand[]

  nodeId?: string

  nodeSessionId?: string

  queue?: StoredQueue

  autoplay?: boolean

  recentHistory: string[]
}

export type RepeatMode = 'queue' | 'track' | 'off'
export interface PlayerOptions {
  guildId: string

  voiceChannelId: string

  textChannelId?: string

  volume?: number

  vcRegion?: string

  selfDeaf?: boolean

  selfMute?: boolean

  node?: RyanlinkNode | string

  instaFixFilter?: boolean

  autoPauseOnMute?: boolean

  smartLeave?: boolean

  autoPause?: boolean

  applyVolumeAsFilter?: boolean

  autoplay?: boolean

  recentHistory?: string[]

  customData?: anyObject

  onTrackStart?: (player: any, track: Track) => void

  onQueueEnd?: (player: any) => void

  onNodeFailover?: (player: any, from: any, to: any) => void

  trackResolveRetryLimit?: number
}

export type anyObject = { [key: string | number]: string | number | null | anyObject }

export interface BasePlayOptions {
  position?: number

  startTime?: number

  endTime?: number

  paused?: boolean

  volume?: number

  filters?: Partial<AudioFilters>

  voice?: VoiceConnectionOptions
}
export interface PlayConfiguration extends BasePlayOptions {
  track?: {
    encoded?: Base64 | null

    identifier?: string

    userData?: anyObject

    requester?: unknown

    audioTrackId?: string
  }

  nextTrack?: {
    encoded?: Base64 | null

    userData?: anyObject
  }

  fading?: FadingConfig
}
export interface PlayOptions extends PlayConfiguration {
  noReplace?: boolean

  clientTrack?: (Track | UnresolvedTrack) & { audioTrackId?: string }
}
