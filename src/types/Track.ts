import type { Player } from '../audio/Player'

import type { anyObject } from './Player'
import type { Base64 } from './Utils'

export type CoreSourceNames = 'youtube' | 'youtubemusic' | 'soundcloud' | 'bandcamp' | 'twitch'

export type AudioSourceNames =
  | 'deezer'
  | 'spotify'
  | 'applemusic'
  | 'yandexmusic'
  | 'jiosaavn'
  | 'flowery-tts'
  | 'vkmusic'
  | 'tidal'
  | 'qobuz'
  | 'pandora'
  | CoreSourceNames

export interface AudioTrackInfo {
  identifier: string

  title: string

  author: string

  length: number

  artworkUrl: string | null

  uri: string

  sourceName: AudioSourceNames

  isSeekable: boolean

  isStream: boolean

  isrc: string | null
}

export interface TrackInfo {
  identifier: string

  title: string

  author: string

  duration: number

  artworkUrl: string | null

  uri: string

  sourceName: AudioSourceNames

  isSeekable: boolean

  isStream: boolean

  isrc: string | null
}

export interface PluginInfo {
  type?: 'album' | 'playlist' | 'artist' | 'recommendations' | 'holo' | string

  albumName?: string

  albumUrl?: string

  albumArtUrl?: string

  artistUrl?: string

  artistArtworkUrl?: string

  previewUrl?: string

  isPreview?: boolean

  totalTracks?: number

  identifier?: string

  artworkUrl?: string

  author?: string

  url?: string

  uri?: string

  authors?: { name: string; url?: string }[]

  artistName?: string

  audioTracks?: {
    id: string
    name: string
    isDefault: boolean
    isAutoDubbed: boolean
  }[]

  holo?: {
    channel?: {
      name: string
      id: string
      subscribers?: string
      verified?: boolean
      url?: string
      externalLinks?: { title: string; url: string }[]
    }
    views?: string
    publishDate?: string
    keywords?: string[]
    thumbnails?: { url: string; width: number; height: number }[]
    qualityOptions?: {
      itag: number
      mimeType: string
      qualityLabel: string
      bitrate: number
    }[]
  }

  clientData?: {
    previousTrack?: boolean
    [key: string]: any
  }

  [key: string]: any
}

export interface AudioTrack {
  encoded?: Base64

  info: AudioTrackInfo

  pluginInfo: Partial<PluginInfo>

  userData?: anyObject
}

export interface TrackRequester {}

export interface Track {
  encoded?: Base64

  info: TrackInfo

  pluginInfo: Partial<PluginInfo>

  requester?: TrackRequester

  userData?: anyObject
}

export interface UnresolvedTrackInfo extends Partial<TrackInfo> {
  title: string
}
export interface UnresolvedQuery extends UnresolvedTrackInfo {
  encoded?: Base64
}
export interface UnresolvedTrack {
  resolve: (player: Player) => Promise<void>

  encoded?: Base64

  info: UnresolvedTrackInfo

  pluginInfo: Partial<PluginInfo>

  userData?: anyObject

  requester?: TrackRequester
}
