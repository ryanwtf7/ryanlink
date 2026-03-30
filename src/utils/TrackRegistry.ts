import type { Track, TrackInfo, PluginInfo, TrackRequester } from '../types/Track'
import type { anyObject } from '../types/Player'
import type { Base64 } from '../types/Utils'

export class TrackRegistry {
  private static registry = new Map<string, { encoded?: Base64; info: TrackInfo; pluginInfo: Partial<PluginInfo> }>()

  public static get(identifier: string) {
    return this.registry.get(identifier)
  }

  public static register(track: Track) {
    const id = track.info.identifier || track.encoded || `track-${Math.random()}`
    if (!this.registry.has(id)) {
      this.registry.set(id, {
        encoded: track.encoded,
        info: track.info,
        pluginInfo: track.pluginInfo,
      })
    }
    return id
  }

  public static clear() {
    this.registry.clear()
  }
}

export class TrackEntry implements Track {
  private readonly trackId: string
  public readonly requester?: TrackRequester
  public readonly userData?: anyObject

  constructor(track: Track) {
    this.trackId = TrackRegistry.register(track)
    this.requester = track.requester
    this.userData = track.userData
  }

  get encoded(): Base64 | undefined {
    return TrackRegistry.get(this.trackId)?.encoded
  }

  get info(): TrackInfo {
    return TrackRegistry.get(this.trackId)!.info
  }

  get pluginInfo(): Partial<PluginInfo> {
    return TrackRegistry.get(this.trackId)!.pluginInfo
  }

  public toJSON(): Track {
    return {
      encoded: this.encoded,
      info: this.info,
      pluginInfo: this.pluginInfo,
      requester: this.requester,
      userData: this.userData,
    }
  }
}
