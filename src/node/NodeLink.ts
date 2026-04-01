import type { ReadableStream } from 'node:stream/web'

import { RyanlinkNode } from './Node'
import type { NodeManager } from './NodeManager'
import type { Player } from '../audio/Player'
import type {
  NodeLink_ChorusFilter,
  NodeLink_CompressorFilter,
  NodeLink_EchoFilter,
  NodeLink_HighPassFilter,
  NodeLink_PhaserFilter,
  NodeLink_SpatialFilter,
} from '../types/Filters'
import type { NodeConfiguration } from '../types/Node'
import type {
  AddMixerLayerResponse,
  ConnectionMetricsResponse,
  DirectStreamResponse,
  EncodeTrackResponse,
  EncodeTracksResponse,
  FadingConfig,
  ListMixerLayersResponse,
  LoadChaptersResponse,
  LoadLyricsResponse,
  MeaningResponse,
  NodeLinkChapter,
  NodeLinkDetailedStats,
  NodeLinkInfo,
  NodeLinkLyrics,
  NodeLinkNoLyrics,
  WorkersResponse,
  YoutubeConfigResponse,
  YoutubeOAuthResponse,
} from '../types/NodeLink'
import type { Track, UnresolvedTrack } from '../types/Track'
import { safeStringify } from '../utils/Utils'

export class NodeLinkNode extends RyanlinkNode {
  public nodeType = 'NodeLink' as const

  constructor(options: NodeConfiguration, manager: NodeManager) {
    super(options, manager)

    if (this.options.nodeType === 'Core' && this.constructor.name === 'NodeLink') {
      return new (RyanlinkNode as any)(options, manager)
    }
    this.nodeType = 'NodeLink'
  }

  public async setNextTrackGapLess(player: Player, track?: Track | UnresolvedTrack) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const nextTrack = track || player.queue.tracks[0]
    if (!nextTrack) throw new Error('No track provided')
    await this.updatePlayer({
      guildId: player.guildId,
      playerOptions: { nextTrack: { encoded: nextTrack.encoded, userData: nextTrack.userData || {} } },
    })
    return true
  }

  public async removeNextTrackGapLess(player: Player) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.updatePlayer({
      guildId: player.guildId,
      playerOptions: { nextTrack: { encoded: null } },
    })
    return true
  }

  public async getMeaning(track?: Track | UnresolvedTrack, lang: string = 'en'): Promise<MeaningResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const encodedTrack = track?.encoded
    if (!encodedTrack) throw new Error('No track provided')
    return (await this.request(`/meaning?encodedTrack=${encodeURIComponent(encodedTrack)}&lang=${lang}`, (m) => {
      m.method = 'GET'
    })) as MeaningResponse
  }

  public async addMixerLayer(player: Player, trackToAdd: Track, volume: number): Promise<AddMixerLayerResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return (await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/mix`, (m) => {
      m.method = 'POST'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({
        track: { encoded: trackToAdd.encoded, userData: trackToAdd.userData },
        volume: volume / 100,
      })
    })) as AddMixerLayerResponse
  }

  public async listMixerLayers(player: Player): Promise<ListMixerLayersResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return (await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/mix`, (m) => {
      m.method = 'GET'
    })) as ListMixerLayersResponse
  }

  public async updateMixerLayerVolume(player: Player, mixId: string, volume: number) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/mix/${mixId}`, (m) => {
      m.method = 'PATCH'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({ volume: volume / 100 })
    })
    return true
  }

  public async removeMixerLayer(player: Player, mixId: string) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/mix/${mixId}`, (m) => {
      m.method = 'DELETE'
    })
    return true
  }

  public async loadLyrics(track: Track | UnresolvedTrack, lang: string = 'en'): Promise<LoadLyricsResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const encodedTrack = track?.encoded
    if (!encodedTrack) throw new Error('No track provided')
    return (await this.request(`/loadlyrics?encodedTrack=${encodeURIComponent(encodedTrack)}&lang=${lang}`, (m) => {
      m.method = 'GET'
    })) as LoadLyricsResponse
  }

  public async loadChapters(track: Track | UnresolvedTrack): Promise<LoadChaptersResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const encodedTrack = track?.encoded
    if (!encodedTrack) throw new Error('No track provided')
    return (await this.request(`/loadchapters?encodedTrack=${encodeURIComponent(encodedTrack)}`, (m) => {
      m.method = 'GET'
    })) as LoadChaptersResponse
  }

  public async nodeLinkLyrics(player: Player, track?: Track | UnresolvedTrack, language: string = 'en'): Promise<NodeLinkLyrics | NodeLinkNoLyrics> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const encodedTrack = track?.encoded || player.queue.current?.encoded
    if (!encodedTrack) throw new Error('No track provided')
    return (await this.request(
      `/sessions/${this.sessionId}/players/${player.guildId}/lyrics?encodedTrack=${encodeURIComponent(encodedTrack)}&lang=${language}`,
      (m) => { m.method = 'GET' }
    )) as NodeLinkLyrics | NodeLinkNoLyrics
  }

  public async subscribeLyricsNodeLink(player: Player, skipTrackSource: boolean = false): Promise<void> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.request(
      `/sessions/${this.sessionId}/players/${player.guildId}/lyrics/subscribe?skipTrackSource=${skipTrackSource}`,
      (m) => { m.method = 'POST' }
    )
  }

  public async unsubscribeLyricsNodeLink(player: Player): Promise<void> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.request(
      `/sessions/${this.sessionId}/players/${player.guildId}/lyrics/subscribe`,
      (m) => { m.method = 'DELETE' }
    )
  }

  public async getChapters(player: Player, track?: Track | UnresolvedTrack): Promise<NodeLinkChapter[]> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    const encodedTrack = track?.encoded || player.queue.current?.encoded
    if (!encodedTrack) throw new Error('No track provided')
    return (await this.request(
      `/sessions/${this.sessionId}/players/${player.guildId}/chapters?encodedTrack=${encodeURIComponent(encodedTrack)}`,
      (m) => { m.method = 'GET' }
    )) as NodeLinkChapter[]
  }

  public async getConnectionMetrics(): Promise<ConnectionMetricsResponse> {
    return (await this.request(`/connection`, (m) => { m.method = 'GET' })) as ConnectionMetricsResponse
  }

  public async getDirectStream(track: Track | UnresolvedTrack, itag?: number): Promise<DirectStreamResponse> {
    if (!track.encoded) throw new Error('No encoded track provided')
    let path = `/trackstream?encodedTrack=${encodeURIComponent(track.encoded)}`
    if (itag) path += `&itag=${itag}`
    return (await this.request(path, (m) => { m.method = 'GET' })) as DirectStreamResponse
  }

  public async loadDirectStream(
    track: Track | UnresolvedTrack,
    volume?: number,
    position?: number,
    filters?: object | string
  ): Promise<ReadableStream> {
    if (!track.encoded) throw new Error('No encoded track provided')
    let path = `/loadstream?encodedTrack=${encodeURIComponent(track.encoded)}`
    if (volume != null && volume > 0) path += `&volume=${volume}`
    if (position != null && position > 0) path += `&position=${position}`
    if (filters) path += `&filters=${typeof filters === 'object' ? encodeURIComponent(safeStringify(filters)) : encodeURIComponent(filters)}`
    const res = await this.rawRequest(path, (m) => { m.method = 'GET' })
    return res.response as unknown as ReadableStream
  }

  public async loadDirectStreamPost(
    track: Track | UnresolvedTrack,
    volume?: number,
    position?: number,
    filters?: object
  ): Promise<ReadableStream> {
    const res = await this.rawRequest(`/loadstream`, (m) => {
      m.method = 'POST'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({
        encodedTrack: track.encoded,
        ...(volume != null ? { volume } : {}),
        ...(position != null ? { position } : {}),
        ...(filters ? { filters } : {}),
      })
    })
    return res.response as unknown as ReadableStream
  }

  public async encodeTrack(trackInfo: Record<string, unknown>): Promise<EncodeTrackResponse> {
    return (await this.request(
      `/encodetrack?track=${encodeURIComponent(safeStringify(trackInfo))}`,
      (m) => { m.method = 'GET' }
    )) as EncodeTrackResponse
  }

  public async encodeTracks(tracks: Record<string, unknown>[]): Promise<EncodeTracksResponse> {
    return (await this.request(`/encodedtracks`, (m) => {
      m.method = 'POST'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify(tracks)
    })) as EncodeTracksResponse
  }

  public async getWorkers(): Promise<WorkersResponse> {
    return (await this.request(`/workers`, (m) => { m.method = 'GET' })) as WorkersResponse
  }

  public async patchWorker(code: string, options: { id?: number; clusterId?: number; pid?: number }): Promise<void> {
    await this.request(`/workers`, (m) => {
      m.method = 'PATCH'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({ code, ...options })
    })
  }

  public async setFading(player: Player, fading: FadingConfig): Promise<void> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    await this.request(`/sessions/${this.sessionId}/players/${player.guildId}`, (m) => {
      m.method = 'PATCH'
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({ fading })
    })
  }

  public async changeAudioTrackLanguage(player: Player, language_audioTrackId: string) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return await this.request(`/sessions/${this.sessionId}/players/${player.guildId}`, (r) => {
      r.method = 'PATCH'
      if (r.headers) r.headers['Content-Type'] = 'application/json'
      r.body = safeStringify({
        track: {
          encoded: player.queue.current?.encoded,
          position: player.position,
          audioTrackId: language_audioTrackId,
        },
      })
    })
  }

  public async updateYoutubeConfig(refreshToken?: string, visitorData?: string) {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return await this.request(`/youtube/config`, (r) => {
      r.method = 'PATCH'
      if (r.headers) r.headers['Content-Type'] = 'application/json'
      r.body = safeStringify({ refreshToken, visitorData })
    })
  }

  public async getYoutubeConfig(validate: boolean = false): Promise<YoutubeConfigResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return (await this.request(`/youtube/config${validate ? '?validate=true' : ''}`, (r) => {
      r.method = 'GET'
    })) as YoutubeConfigResponse
  }

  public async getYoutubeOAUTH(refreshToken: string): Promise<YoutubeOAuthResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return (await this.request(`/youtube/oauth?refreshToken=${encodeURIComponent(refreshToken)}`, (m) => {
      m.method = 'GET'
    })) as YoutubeOAuthResponse
  }

  public async updateYoutubeOAUTH(refreshToken: string): Promise<YoutubeOAuthResponse> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')
    return (await this.request(`/youtube/oauth`, (m) => {
      if (m.headers) m.headers['Content-Type'] = 'application/json'
      m.body = safeStringify({ refreshToken })
    })) as YoutubeOAuthResponse
  }

  public async getDetailedStats(): Promise<NodeLinkDetailedStats> {
    return (await this.request(`/stats`, (m) => { m.method = 'GET' })) as NodeLinkDetailedStats
  }

  public async getNodeLinkInfo(): Promise<NodeLinkInfo> {
    return (await this.request(`/info`, (m) => { m.method = 'GET' })) as NodeLinkInfo
  }

  specificFilters = {
    echo: async (player: Player, options: NodeLink_EchoFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.echo
      else player.filterManager.data.echo = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkEcho
    },

    chorus: async (player: Player, options: NodeLink_ChorusFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.chorus
      else player.filterManager.data.chorus = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkChorus
    },

    compressor: async (player: Player, options: NodeLink_CompressorFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.compressor
      else player.filterManager.data.compressor = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkCompressor
    },

    highPass: async (player: Player, options: NodeLink_HighPassFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.highPass
      else player.filterManager.data.highPass = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkHighPass
    },

    phaser: async (player: Player, options: NodeLink_PhaserFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.phaser
      else player.filterManager.data.phaser = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkPhaser
    },

    spatial: async (player: Player, options: NodeLink_SpatialFilter, disableFilter: boolean = false): Promise<boolean> => {
      if (disableFilter) delete player.filterManager.data.spatial
      else player.filterManager.data.spatial = options
      await player.filterManager.applyPlayerFilters()
      return player.filterManager.filters.nodeLinkSpatial
    },

    resetNodeLinkFilters: async (player: Player): Promise<boolean> => {
      delete player.filterManager.data.spatial
      delete player.filterManager.data.echo
      delete player.filterManager.data.chorus
      delete player.filterManager.data.compressor
      delete player.filterManager.data.highPass
      delete player.filterManager.data.phaser
      player.filterManager.checkFiltersState()
      await player.filterManager.applyPlayerFilters()
      return true
    },
  }
}

RyanlinkNode._NodeLinkClass = NodeLinkNode
