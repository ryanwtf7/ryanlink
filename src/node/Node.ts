declare const $clientName: string
declare const $clientVersion: string

import { isAbsolute } from 'node:path'

import WebSocket from 'ws'

import { DebugEvents, DestroyReasons, validSponsorBlocks, RecommendationsStrings, NodeLinkExclusiveEvents } from '../config/Constants'
import type { NodeLinkNode } from './NodeLink'
import type { NodeManager } from './NodeManager'
import type { Player } from '../audio/Player'
import type { RyanlinkManager } from '../core/Manager'
import { ReconnectionState } from '../types/Node'
import type {
  BaseNodeStats,
  NodeInfo,
  NodeConfiguration,
  LyricsResult,
  ModifyRequest,
  NodeLinkConnectionMetrics,
  NodeStats,
  NodeTypes,
  SponsorBlockSegment,
} from '../types/Node'
import type {
  NodeLinkEventPayload,
  NodeLinkEventTypes,
  HealthStatusThreshold,
  HealthStatusKeys,
  HealthPerformanceKeys,
  NodeMetricSummary,
  HealthStatusObject,
  HealthStatusThresholdOptions,
} from '../types/NodeLink'
import type { DestroyReasonsType, DisconnectReasonsType } from '../types/Player'
import type { AudioTrack, PluginInfo, Track } from '../types/Track'
import type {
  Base64,
  InvalidRestRequest,
  AudioPlayerState,
  AudioSearchQuery,
  AudioSearchResponse,
  LoadTypes,
  LyricsFoundEvent,
  LyricsLineEvent,
  LyricsNotFoundEvent,
  PlayerEvents,
  PlayerEventType,
  PlayerUpdateInfo,
  RoutePlanner,
  SearchQuery,
  SearchResult,
  Session,
  SponsorBlockChaptersLoaded,
  SponsorBlockChapterStarted,
  SponsorBlockSegmentSkipped,
  SponsorBlockSegmentsLoaded,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStartEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,
} from '../types/Utils'
import { AudioNodeSymbol, queueTrackEnd, safeStringify, NodeManagerSymbol, ManagerSymbol } from '../utils/Utils'

export class RyanlinkNode {
  private heartBeatPingTimestamp: number = 0
  private heartBeatPongTimestamp: number = 0
  private heartBeatInterval?: NodeJS.Timeout
  private pingTimeout?: NodeJS.Timeout
  private consecutiveReconnectAttempts: number = 0

  public nodeType: NodeTypes = 'Core'
  public isAlive: boolean = false
  public static _NodeLinkClass: unknown = null

  public options: NodeConfiguration

  public calls: number = 0

  public handshakePing: number = 0

  public get weightedScore(): number {
    if (!this.connected || !this.stats) return Infinity
    const cpuScore = (this.stats.cpu.systemLoad || 0) * 0.7
    const memScore = ((this.stats.memory.used || 0) / (this.stats.memory.allocated || 1)) * 0.2
    const playerScore = (this.stats.players / 100) * 0.1
    return cpuScore + memScore + playerScore
  }

  public stats: NodeStats = {
    players: 0,
    playingPlayers: 0,
    cpu: {
      cores: 0,
      audioLoad: 0,
      systemLoad: 0,
    },
    memory: {
      allocated: 0,
      free: 0,
      reservable: 0,
      used: 0,
    },
    uptime: 0,

    detailedStats: {
      api: {
        requests: {},
        errors: {},
      },
      sources: {},
      playback: {
        events: {},
      },
    },
    frameStats: {
      deficit: 0,
      nulled: 0,
      sent: 0,
    },
  }

  public sessionId?: string | null = null

  public resuming: { enabled: boolean; timeout: number | null } = { enabled: true, timeout: null }

  public info: NodeInfo | null = null

  public reconnectionState: ReconnectionState = ReconnectionState.IDLE

  private get NodeManager(): NodeManager {
    return (this as any)[NodeManagerSymbol]
  }

  private reconnectTimeout?: NodeJS.Timeout = undefined

  private reconnectAttempts: number[] = []

  private socket: WebSocket | null = null

  private version = 'v4'

  private get _LManager(): RyanlinkManager<any> {
    return (this as any)[ManagerSymbol]
  }

  public get heartBeatPing() {
    return this.heartBeatPongTimestamp - this.heartBeatPingTimestamp
  }

  public get _checkForPlugins() {
    if (this.nodeType === 'NodeLink') return false
    return !!this.options?.autoChecks?.pluginValidations
  }

  public get _checkForSources() {
    return !!this.options?.autoChecks?.sourcesValidations
  }

  private dispatchDebug(name: DebugEvents, eventData: any) {
    if (!this._LManager.options?.advancedOptions?.enableDebugEvents) return
    try {
      const sanitizedData = JSON.parse(safeStringify(eventData))
      this._LManager.emit('debug', name, sanitizedData)
    } catch {
      this._LManager.emit('debug', name, { state: eventData.state, message: 'Serialization failed during debug dispatch', functionLayer: eventData.functionLayer })
    }
  }

  public get connected(): boolean {
    return this.socket && this.socket.readyState === WebSocket.OPEN
  }

  public get connectionStatus(): string {
    if (!this.socket) throw new Error('no websocket was initialized yet')
    return ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] || 'UNKNOWN'
  }

  constructor(options: NodeConfiguration, manager: NodeManager) {
    ; (this as any)[NodeManagerSymbol] = manager
      ; (this as any)[ManagerSymbol] = manager.RyanlinkManager
    this.options = {
      secure: false,
      retryAmount: 5,
      retryDelay: 10e3,
      retryTimespan: -1,
      requestSignalTimeoutMS: 10000,
      heartBeatInterval: 30_000,
      enablePingOnStatsCheck: true,
      closeOnError: true,
      ...options,
      autoChecks: {
        sourcesValidations: options?.autoChecks?.sourcesValidations ?? true,
        pluginValidations: options?.autoChecks?.pluginValidations ?? true,
      },
    }

    if (this.options.nodeType === 'NodeLink' && this.constructor.name === 'RyanlinkNode' && RyanlinkNode._NodeLinkClass) {
      return new (RyanlinkNode._NodeLinkClass as any)(options, manager)
    }

    this.nodeType = this.options.nodeType || 'Core'

    this.validate()
    if (this.options.secure && this.options.port !== 443) throw new SyntaxError('If secure is true, then the port must be 443')
    this.options.regions = (this.options.regions || []).map((a) => a.toLowerCase())
    Object.defineProperty(this, AudioNodeSymbol, { configurable: true, value: true })
  }

  public async rawRequest(
    endpoint: string,
    modify?: ModifyRequest
  ): Promise<{
    response: Response
    options: RequestInit & { path: string; extraQueryUrlParams?: URLSearchParams }
  }> {
    const options: RequestInit & { path: string; extraQueryUrlParams?: URLSearchParams } = {
      path: `/${this.version}/${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`,
      method: 'GET',
      headers: {
        Authorization: this.options.authorization,
      },
      signal:
        this.options.requestSignalTimeoutMS && this.options.requestSignalTimeoutMS > 0
          ? AbortSignal.timeout(this.options.requestSignalTimeoutMS)
          : undefined,
    }

    modify?.(options)

    const url = new URL(`${this.restAddress}${options.path}`)
    url.searchParams.append('trace', 'true')

    if (options.extraQueryUrlParams && options.extraQueryUrlParams?.size > 0) {
      for (const [paramKey, paramValue] of options.extraQueryUrlParams.entries()) {
        url.searchParams.append(paramKey, paramValue)
      }
    }

    const urlToUse = url.toString()

    const { path: _path, extraQueryUrlParams: _extraQueryUrlParams, ...fetchOptions } = options

    const response = await fetch(urlToUse, fetchOptions)

    this.calls++

    return { response, options: options }
  }

  public async request(endpoint: string, modify: ModifyRequest | undefined, parseAsText: true): Promise<string>
  public async request(endpoint: string, modify?: ModifyRequest, parseAsText?: false): Promise<any>
  public async request(endpoint: string, modify?: ModifyRequest, parseAsText?: boolean): Promise<any | string> {
    if (!this.connected) throw new Error('The node is not connected to the Ryanlink Server!, Please call node.connect() first!')

    const { response, options } = await this.rawRequest(endpoint, modify)

    if (['DELETE', 'PUT'].includes(options.method)) return

    if (response.status === 204) return
    if (response.status === 404 && endpoint.includes('sessions/'))
      throw new Error(`The provided session was not found on the Ryanlink Server! -> Endpoint: ${endpoint}`)
    if (response.status >= 400) {
      const text = await response.text()
      throw new Error(`Ryanlink Server returned status ${response.status}: ${text}`)
    }

    return parseAsText ? await response.text() : await response.json()
  }

  public async search(query: SearchQuery, requestUser: unknown, throwOnEmpty: boolean = false): Promise<SearchResult> {
    const Query = this.NodeManager.RyanlinkManager.utils.transformQuery(query)

    this.NodeManager.RyanlinkManager.utils.validateQueryString(this, Query.query, Query.source)
    if (Query.source) this.NodeManager.RyanlinkManager.utils.validateSourceString(this, Query.source)

    if (['bcsearch', 'bandcamp'].includes(Query.source) && this._checkForSources && !this.info.sourceManagers.includes('bandcamp')) {
      throw new Error('Bandcamp Search only works on the player (audio-engine version < 2.2.0!')
    }

    const requestUrl = new URL(`${this.restAddress}/loadtracks`)

    if (/^https?:\/\//.test(Query.query)) {
      requestUrl.searchParams.append('identifier', Query.query)
    } else {
      const fttsPrefix = Query.source === 'ftts' ? '//' : ''
      const prefix = Query.source !== 'local' ? `${Query.source}:${fttsPrefix}` : ''
      requestUrl.searchParams.append('identifier', `${prefix}${Query.query}`)
    }

    const requestPathAndSearch = requestUrl.pathname + requestUrl.search

    const res = (await this.request(requestPathAndSearch, (options) => {
      if (typeof query === 'object' && typeof query.extraQueryUrlParams?.size === 'number' && query.extraQueryUrlParams?.size > 0) {
        options.extraQueryUrlParams = query.extraQueryUrlParams
      }
    })) as {
      loadType: LoadTypes
      data: any
      pluginInfo: PluginInfo
    }

    const resTracks =
      res.loadType === 'playlist'
        ? res.data?.tracks
        : res.loadType === 'track'
          ? [res.data]
          : res.loadType === 'search'
            ? Array.isArray(res.data)
              ? res.data
              : [res.data]
            : []

    if (throwOnEmpty === true && (res.loadType === 'empty' || !resTracks.length)) {
      this.dispatchDebug(DebugEvents.SearchNothingFound, {
        state: 'warn',
        message: `Search found nothing for Request: "${Query.source ? `${Query.source}:` : ''}${Query.query}"`,
        functionLayer: '(RyanlinkNode > node | player) > search()',
      })
      throw new Error('Nothing found')
    }

    return {
      loadType: res.loadType,
      exception: res.loadType === 'error' ? res.data : null,
      pluginInfo: res.pluginInfo || {},
      playlist:
        res.loadType === 'playlist'
          ? {
            name: res.data.info?.name || res.data.pluginInfo?.name || null,
            title: res.data.info?.name || res.data.pluginInfo?.name || null,
            author: res.data.info?.author || res.data.pluginInfo?.author || null,
            thumbnail:
              res.data.info?.artworkUrl ||
              res.data.pluginInfo?.artworkUrl ||
              (typeof res.data?.info?.selectedTrack !== 'number' || res.data?.info?.selectedTrack === -1
                ? null
                : resTracks[res.data?.info?.selectedTrack]
                  ? resTracks[res.data?.info?.selectedTrack]?.info?.artworkUrl ||
                  resTracks[res.data?.info?.selectedTrack]?.info?.pluginInfo?.artworkUrl
                  : null) ||
              null,
            uri:
              res.data.info?.url ||
              res.data.info?.uri ||
              res.data.info?.link ||
              res.data.pluginInfo?.url ||
              res.data.pluginInfo?.uri ||
              res.data.pluginInfo?.link ||
              null,
            selectedTrack:
              typeof res.data?.info?.selectedTrack !== 'number' || res.data?.info?.selectedTrack === -1
                ? null
                : resTracks[res.data?.info?.selectedTrack]
                  ? this.NodeManager.RyanlinkManager.utils.buildTrack(resTracks[res.data?.info?.selectedTrack], requestUser)
                  : null,
            duration: resTracks.length
              ? resTracks.reduce(
                (acc: number, cur: Track & { info: Track['info'] & { length?: number } }) =>
                  acc + (cur?.info?.duration || cur?.info?.length || 0),
                0
              )
              : 0,
          }
          : null,
      tracks: (resTracks.length ? resTracks.map((t) => this.NodeManager.RyanlinkManager.utils.buildTrack(t, requestUser)) : []) as Track[],
    }
  }

  async audioSearch(query: AudioSearchQuery, requestUser: unknown, throwOnEmpty: boolean = false): Promise<AudioSearchResponse | SearchResult> {
    const Query = this.NodeManager.RyanlinkManager.utils.transformAudioSearchQuery(query)

    if (Query.source) this.NodeManager.RyanlinkManager.utils.validateSourceString(this, Query.source)
    if (/^https?:\/\//.test(Query.query)) return this.search({ query: Query.query, source: Query.source }, requestUser)

    const sourceName = Query.source?.toLowerCase()?.replace('search', '')?.replace('rec', '')?.replace('isrc', '')
    const isSupported = this.info?.sourceManagers?.includes(sourceName) ||
      this.info?.plugins?.some(p => p.name.toLowerCase().includes(sourceName))

    if (!isSupported && !this.NodeManager.RyanlinkManager.options?.playerOptions?.allowCustomSources) {
      throw new SyntaxError(
        `Query.source "${Query.source}" is not supported by LavaSearch on this node. Enable allowCustomSources to skip this check.`
      )
    }

    if (this._checkForPlugins) {

      const hasLavaSearch = this.info?.plugins?.some((v) =>
        v.name === 'lavasearch-plugin' ||
        v.name === 'search-engine' ||
        v.name.toLowerCase().includes('lavasearch')
      )
      if (!hasLavaSearch)
        throw new RangeError(`there is no LavaSearch (lavasearch-plugin) available in the ryanlink node: ${this.id}`)

      const hasLavaSrc = this.info?.plugins?.some((v) =>
        v.name === 'lavasrc-plugin' ||
        v.name === 'source-engine' ||
        v.name.toLowerCase().includes('lavasrc')
      )
      if (!hasLavaSrc)
        throw new RangeError(`there is no LavaSrc (lavasrc-plugin) available in the ryanlink node: ${this.id}`)
    }

    const { response } = await this.rawRequest(
      `/loadsearch?query=${Query.source ? `${Query.source}:` : ''}${encodeURIComponent(Query.query)}${Query.types?.length ? `&types=${Query.types.join(',')}` : ''}`
    )

    const res = (response.status === 204 ? {} : await response.json()) as AudioSearchResponse

    if (throwOnEmpty === true && !Object.entries(res).flat().filter(Boolean).length) {
      this.dispatchDebug(DebugEvents.SearchNothingFound, {
        state: 'warn',
        message: `LavaSearch found nothing for Request: "${Query.source ? `${Query.source}:` : ''}${Query.query}"`,
        functionLayer: '(RyanlinkNode > node | player) > audioSearch()',
      })
      throw new Error('Nothing found')
    }

    return {
      tracks: res.tracks?.map((v) => this.NodeManager.RyanlinkManager.utils.buildTrack(v, requestUser)) || [],
      albums:
        res.albums?.map((album) => ({
          info: album.info,
          pluginInfo: (album as unknown as { plugin: unknown })?.plugin || album.pluginInfo,
          tracks: album.tracks.map((track) => this.NodeManager.RyanlinkManager.utils.buildTrack(track, requestUser)),
        })) || [],
      artists:
        res.artists?.map((artist) => ({
          info: artist.info,
          pluginInfo: (artist as unknown as { plugin: unknown })?.plugin || artist.pluginInfo,
          tracks: artist.tracks.map((track) => this.NodeManager.RyanlinkManager.utils.buildTrack(track, requestUser)),
        })) || [],
      playlists:
        res.playlists?.map((playlist) => ({
          info: playlist.info,
          pluginInfo: (playlist as unknown as { plugin: unknown })?.plugin || playlist.pluginInfo,
          tracks: playlist.tracks.map((track) => this.NodeManager.RyanlinkManager.utils.buildTrack(track, requestUser)),
        })) || [],
      texts:
        res.texts?.map((text) => ({
          text: text.text,
          pluginInfo: (text as unknown as { plugin: unknown })?.plugin || text.pluginInfo,
        })) || [],
      pluginInfo: res.pluginInfo || (res as unknown as { plugin: unknown })?.plugin,
    }
  }

  public async updatePlayer(data: PlayerUpdateInfo): Promise<AudioPlayerState> {
    if (!this.sessionId) throw new Error('The Audio Node is either not ready, or not up to date!')

    this.syncPlayerData(data)

    const res = (await this.request(`/sessions/${this.sessionId}/players/${data.guildId}`, (r) => {
      r.method = 'PATCH'

      if (r.headers) r.headers['Content-Type'] = 'application/json'
      r.body = safeStringify(data.playerOptions)

      if (data.noReplace) {
        const url = new URL(`${this.restAddress}${r.path}`)
        url.searchParams.append('noReplace', data.noReplace === true && typeof data.noReplace === 'boolean' ? 'true' : 'false')
        r.path = url.pathname + url.search
      }
    })) as AudioPlayerState

    this.dispatchDebug(DebugEvents.PlayerUpdateSuccess, {
      state: 'log',
      message: `Player get's updated with following payload :: ${safeStringify(data.playerOptions, 3)}`,
      functionLayer: 'RyanlinkNode > node > updatePlayer()',
    })

    this.syncPlayerData({}, res)

    return res
  }

  public async destroyPlayer(guildId: string): Promise<void> {
    if (!this.sessionId) throw new Error('The Ryanlink-Node is either not ready, or not up to date!')

    return this.request(`/sessions/${this.sessionId}/players/${guildId}`, (r) => {
      r.method = 'DELETE'
    })
  }

  public connect(sessionId?: string): void {
    if (this.connected) {
      this.dispatchDebug(DebugEvents.TryingConnectWhileConnected, {
        state: 'warn',
        message: `Tryed to connect to node, but it's already connected!`,
        functionLayer: 'RyanlinkNode > node > connect()',
      })
      return
    }

    const headers = {
      Authorization: this.options.authorization,
      'User-Id': this.NodeManager.RyanlinkManager.options.client.id,
      'Client-Name': `${$clientName}/${$clientVersion}`,
    }

    if (typeof this.options.sessionId === 'string' || typeof sessionId === 'string') {
      headers['Session-Id'] = this.options.sessionId || sessionId
      this.sessionId = this.options.sessionId || sessionId
    }

    this.socket = new WebSocket(`ws${this.options.secure ? 's' : ''}://${this.options.host}:${this.options.port}/${this.version}/websocket`, { headers })
    this.socket.on('open', this.open.bind(this))
    this.socket.on('close', (code, reason) => this.close(code, reason?.toString()))
    this.socket.on('message', this.message.bind(this))
    this.socket.on('error', this.error.bind(this))
  }

  private heartBeat(): void {
    if (this.nodeType !== 'Core') return
    this.dispatchDebug(DebugEvents.HeartBeatTriggered, {
      state: 'log',
      message: `Node Socket Heartbeat triggered, resetting old Timeout to 65000ms (should happen every 60s due to /stats event)`,
      functionLayer: 'RyanlinkNode > nodeEvent > stats > heartBeat()',
    })

    this.resetAckTimeouts(false, true)

    this.pingTimeout = setTimeout(() => {
      this.pingTimeout = null
      if (!this.socket) {
        return this.dispatchDebug(DebugEvents.NoSocketOnDestroy, {
          state: 'error',
          message: `Heartbeat registered a disconnect, but socket didn't exist therefore can't terminate`,
          functionLayer: 'RyanlinkNode > nodeEvent > stats > heartBeat() > timeoutHit',
        })
      }
      this.dispatchDebug(DebugEvents.SocketTerminateHeartBeatTimeout, {
        state: 'warn',
        message: `Heartbeat registered a disconnect, because timeout wasn't resetted in time. Terminating Web-Socket`,
        functionLayer: 'RyanlinkNode > nodeEvent > stats > heartBeat() > timeoutHit',
      })
      this.isAlive = false
      this.socket.terminate()
    }, 65_000)
  }

  public get id(): string {
    return this.options.id || `${this.options.host}:${this.options.port}`
  }

  public destroy(destroyReason?: DestroyReasonsType, deleteNode: boolean = true, movePlayers: boolean = false): void {
    this.reconnectionState = ReconnectionState.IDLE

    const players = this._LManager.players.filter((p) => p.node.id === this.id)

    if (!players?.size) {
      this.socket?.close(1000, 'Node-Destroy')
      this.socket?.removeAllListeners()
      this.socket = null
      this.resetReconnectionAttempts()

      if (!deleteNode)
        return void this.NodeManager.emit('disconnect', this, {
          code: 1000,
          reason: destroyReason,
        })

      this.NodeManager.emit('destroy', this, destroyReason)
      this.NodeManager.nodes.delete(this.id)
      this.resetAckTimeouts(true, true)

      return
    }

    const handlePlayerOperations = () => {
      if (!movePlayers) {
        return Promise.allSettled(
          Array.from(players.values()).map((player: Player) =>
            player.destroy(destroyReason || DestroyReasons.NodeDestroy).catch((error) => {
              this.dispatchDebug(DebugEvents.PlayerDestroyFail, {
                state: 'error',
                message: `Failed to destroy player ${player.guildId}: ${error.message}`,
                error,
                functionLayer: 'Node > destroy() > movePlayers',
              })
            })
          )
        )
      }
      const nodeToMove = Array.from(this.NodeManager.leastUsedNodes('playingPlayers')).find((n) => n.connected && n.options.id !== this.id)

      if (!nodeToMove) {
        return Promise.allSettled(
          Array.from(players.values()).map((player: Player) =>
            player.destroy(DestroyReasons.PlayerChangeNodeFailNoEligibleNode).catch((error) => {
              this.dispatchDebug(DebugEvents.PlayerChangeNodeFailNoEligibleNode, {
                state: 'error',
                message: `Failed to destroy player ${player.guildId}: ${error.message}`,
                error,
                functionLayer: 'Node > destroy() > movePlayers',
              })
            })
          )
        )
      }
      return Promise.allSettled(
        Array.from(players.values()).map((player: Player) =>
          nodeToMove.updatePlayer({ guildId: player.guildId, playerOptions: (player as Player).toJSON() }).catch((error) => {
            this.dispatchDebug(DebugEvents.PlayerChangeNodeFail, {
              state: 'error',
              message: `Failed to move player ${player.guildId}: ${error.message}`,
              error,
              functionLayer: 'Node > destroy() > movePlayers',
            })

            return (player as Player).destroy(error.message ?? DestroyReasons.PlayerChangeNodeFail).catch((destroyError) => {
              this.dispatchDebug(DebugEvents.PlayerDestroyFail, {
                state: 'error',
                message: `Failed to destroy player ${player.guildId} after move failure: ${destroyError.message}`,
                error: destroyError,
                functionLayer: 'Node > destroy() > movePlayers',
              })
            })
          })
        )
      )
    }

    return void handlePlayerOperations().finally(() => {
      this.socket?.close(1000, 'Node-Destroy')
      this.socket?.removeAllListeners()
      this.socket = null
      this.resetReconnectionAttempts()

      if (!deleteNode)
        return void this.NodeManager.emit('disconnect', this, {
          code: 1000,
          reason: destroyReason,
        })
      this.NodeManager.emit('destroy', this, destroyReason)
      this.NodeManager.nodes.delete(this.id)
      this.resetAckTimeouts(true, true)
      return
    })
  }

  public disconnect(disconnectReason?: DisconnectReasonsType) {
    if (!this.connected) return

    this.socket?.close(1000, 'Node-Disconnect')
    this.socket?.removeAllListeners()
    this.socket = null
    this.reconnectionState = ReconnectionState.IDLE

    this.resetReconnectionAttempts()

    this.NodeManager.emit('disconnect', this, { code: 1000, reason: disconnectReason })
  }

  public async fetchAllPlayers(): Promise<AudioPlayerState[] | InvalidRestRequest | null> {
    if (!this.sessionId) throw new Error('The Ryanlink-Node is either not ready, or not up to date!')
    return (
      (this.request(`/sessions/${this.sessionId}/players`) as Promise<AudioPlayerState[] | InvalidRestRequest | null>) ||
      ([] as AudioPlayerState[])
    )
  }

  public async fetchPlayer(guildId: string): Promise<AudioPlayerState | InvalidRestRequest | null> {
    if (!this.sessionId) throw new Error('The Ryanlink-Node is either not ready, or not up to date!')
    return this.request(`/sessions/${this.sessionId}/players/${guildId}`) as Promise<AudioPlayerState | InvalidRestRequest | null>
  }

  public async updateSession(resuming?: boolean, timeout?: number): Promise<Session | InvalidRestRequest | null> {
    if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
    const data = {} as any
    if (typeof resuming === 'boolean') data.resuming = resuming
    if (typeof timeout === 'number' && timeout > 0) data.timeout = timeout

    const EXCLUDED_KEYS = [
      'authorization', 'host', 'port', 'secure', 'closeOnError',
      'retryAmount', 'retryDelay', 'retryTimespan', 'requestSignalTimeoutMS',
      'heartBeatInterval', 'enablePingOnStatsCheck', 'autoChecks', 'regions',
      'nodeType', 'id', 'sessionId'
    ]

    for (const [key, value] of Object.entries(this.options)) {
      if (value && typeof value === 'object' && !EXCLUDED_KEYS.includes(key) && !Array.isArray(value)) {
        data[key] = value
      }
    }

    this.resuming = {
      enabled: typeof resuming === 'boolean' ? resuming : this.resuming.enabled,
      timeout: typeof resuming === 'boolean' && resuming === true ? timeout : this.resuming.timeout,
    }
    return this.request(`/sessions/${this.sessionId}`, (r) => {
      r.method = 'PATCH'
      r.headers = { Authorization: this.options.authorization, 'Content-Type': 'application/json' }
      r.body = safeStringify(data)
    }) as Promise<Session | InvalidRestRequest | null>
  }

  decode = {
    singleTrack: async (encoded: Base64, requester: unknown): Promise<Track> => {
      if (!encoded) throw new SyntaxError('No encoded (Base64 string) was provided')

      return this._LManager.utils?.buildTrack(
        (await this.request(`/decodetrack?encodedTrack=${encodeURIComponent(encoded.replace(/\s/g, ''))}`)) as AudioTrack,
        requester
      )
    },

    multipleTracks: async (encodeds: Base64[], requester: unknown): Promise<Track[]> => {
      if (!Array.isArray(encodeds) || !encodeds.every((v) => typeof v === 'string' && v.length > 1))
        throw new SyntaxError('You need to provide encodeds, which is an array of base64 strings')

      return await this.request(`/decodetracks`, (r) => {
        r.method = 'POST'
        r.body = safeStringify(encodeds)

        if (r.headers) r.headers['Content-Type'] = 'application/json'
      }).then((r: AudioTrack[]) => r.map((track) => this._LManager.utils.buildTrack(track, requester)))
    },
  }

  lyrics = {
    get: async (track: Track, skipTrackSource: boolean = false): Promise<LyricsResult | null> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')

      if (this._checkForPlugins) {
        const plugins = this.info?.plugins ?? []

        const hasLyricsPlugin = plugins.some((v) =>
          v.name === 'lavalyrics-plugin' ||
          v.name === 'java-lyrics-plugin' ||
          v.name === 'lyrics' ||
          v.name === 'lavasrc-plugin'
        )
        if (!hasLyricsPlugin)
          throw new RangeError(`No lyrics plugin found on node ${this.id}. Expected: lavalyrics-plugin, java-lyrics-plugin, lyrics, or lavasrc-plugin.`)
      }

      const url = `/lyrics?track=${track.encoded}&skipTrackSource=${skipTrackSource}`
      return (await this.request(url)) as LyricsResult | null
    },

    getCurrent: async (guildId: string, skipTrackSource: boolean = false): Promise<LyricsResult | null> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')

      if (this._checkForPlugins) {
        const plugins = this.info?.plugins ?? []
        const hasLyricsPlugin = plugins.some((v) =>
          v.name === 'lavalyrics-plugin' ||
          v.name === 'java-lyrics-plugin' ||
          v.name === 'lyrics' ||
          v.name === 'lavasrc-plugin'
        )
        if (!hasLyricsPlugin)
          throw new RangeError(`No lyrics plugin found on node ${this.id}. Expected: lavalyrics-plugin, java-lyrics-plugin, lyrics, or lavasrc-plugin.`)
      }

      const url = `/sessions/${this.sessionId}/players/${guildId}/track/lyrics?skipTrackSource=${skipTrackSource}`
      return (await this.request(url)) as LyricsResult | null
    },

    subscribe: async (guildId: string, skipTrackSource?: boolean): Promise<unknown> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')

      if (this._checkForPlugins) {
        const plugins = this.info?.plugins ?? []
        const hasLyricsPlugin = plugins.some((v) =>
          v.name === 'lavalyrics-plugin' ||
          v.name === 'java-lyrics-plugin' ||
          v.name === 'lyrics' ||
          v.name === 'lavasrc-plugin'
        )
        if (!hasLyricsPlugin)
          throw new RangeError(`No lyrics plugin found on node ${this.id}.`)
      }

      return await this.request(
        `/sessions/${this.sessionId}/players/${guildId}/lyrics/subscribe?skipTrackSource=${skipTrackSource ?? false}`,
        (options) => {
          options.method = 'POST'
        }
      )
    },

    unsubscribe: async (guildId: string): Promise<void> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')

      if (this._checkForPlugins) {
        const plugins = this.info?.plugins ?? []
        const hasLyricsPlugin = plugins.some((v) =>
          v.name === 'lavalyrics-plugin' ||
          v.name === 'java-lyrics-plugin' ||
          v.name === 'lyrics' ||
          v.name === 'lavasrc-plugin'
        )
        if (!hasLyricsPlugin)
          throw new RangeError(`No lyrics plugin found on node ${this.id}.`)
      }

      return await this.request(`/sessions/${this.sessionId}/players/${guildId}/lyrics/subscribe`, (options) => {
        options.method = 'DELETE'
      })
    },
  }

  timedLyrics = {
    getCurrent: async (guildId: string): Promise<any | null> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      if (this._checkForPlugins) {
        const hasPlugin = this.info?.plugins?.some((v) =>
          v.name === 'lyrics' || v.name === 'java-lyrics-plugin'
        )
        if (!hasPlugin)
          throw new RangeError(`No timed-lyrics plugin found on node ${this.id}. Expected: 'lyrics' (lyrics.kt) or 'java-lyrics-plugin' (java-timed-lyrics).`)
      }
      return (await this.request(`/sessions/${this.sessionId}/players/${guildId}/lyrics`)) as any | null
    },

    getByVideoId: async (videoId: string): Promise<any | null> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      if (this._checkForPlugins) {
        const hasPlugin = this.info?.plugins?.some((v) =>
          v.name === 'lyrics' || v.name === 'java-lyrics-plugin'
        )
        if (!hasPlugin)
          throw new RangeError(`No timed-lyrics plugin found on node ${this.id}.`)
      }
      return (await this.request(`/lyrics/${encodeURIComponent(videoId)}`)) as any | null
    },

    search: async (query: string, source?: 'youtube' | 'genius'): Promise<any[]> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      if (this._checkForPlugins) {
        const hasPlugin = this.info?.plugins?.some((v) =>
          v.name === 'lyrics' || v.name === 'java-lyrics-plugin'
        )
        if (!hasPlugin)
          throw new RangeError(`No timed-lyrics plugin found on node ${this.id}.`)
      }
      const params = new URLSearchParams({ query })
      if (source) params.set('source', source)
      return ((await this.request(`/lyrics/search?${params.toString()}`)) ?? []) as any[]
    },
  }

  public hasXMPlugin(): boolean {
    return !!this.info?.plugins?.some((v) => v.name === 'lava-xm-plugin')
  }

  public async fetchStats(): Promise<BaseNodeStats> {
    return (await this.request(`/stats`)) as BaseNodeStats
  }

  public async fetchConnectionMetrics(): Promise<NodeLinkConnectionMetrics> {
    if (this.info && !this.info.isNodelink)
      throw new Error("There is no Information about wether you are using NodeLink instead of Lavalink, so this function won't work")
    return (await this.request(`/connection`)) as NodeLinkConnectionMetrics
  }

  public async fetchVersion(): Promise<string> {
    return (await this.request(
      `/version`,
      (r) => {
        r.path = '/version'
      },
      true
    )) as string
  }

  public async fetchInfo(): Promise<NodeInfo> {
    return (await this.request(`/info`)) as NodeInfo
  }

  public nodeMetricSummary(): NodeMetricSummary {
    if (!this.connected || !this.isAlive)
      return {
        systemLoad: 0,
        cpuLoad: 0,
        memoryUsage: 0,
        players: 0,
        playingPlayers: 0,
        uptime: 0,
        ping: 0,
        frameDeficit: 0,
      }
    const _memoryUsed = this.stats.memory.used
    const _memoryAllocated = this.stats.memory.allocated
    return {
      systemLoad: this.stats.cpu.systemLoad,
      cpuLoad: this.stats.cpu.audioLoad,
      memoryUsage: _memoryAllocated > 0 ? (_memoryUsed / _memoryAllocated) * 100 : 0,
      players: this.stats.players,
      playingPlayers: this.stats.playingPlayers,
      uptime: this.stats.uptime,
      ping: this.heartBeatPing,
      frameDeficit: this.stats.frameStats?.deficit || 0,
    }
  }

  public getHealthStatus(thresholds?: HealthStatusThresholdOptions): HealthStatusObject {
    const cpuThresholds: HealthStatusThreshold = {
      excellent: 0.3,
      good: 0.5,
      fair: 0.7,
      poor: 0.85,
      ...thresholds?.cpu,
    }
    const memoryThresholds: HealthStatusThreshold = {
      excellent: 60,
      good: 75,
      fair: 85,
      poor: 95,
      ...thresholds?.memory,
    }
    const pingThresholds: HealthStatusThreshold = {
      excellent: 50,
      good: 100,
      fair: 200,
      poor: 300,
      ...thresholds?.ping,
    }
    const recommendations: string[] = []
    const metrics = this.nodeMetricSummary()

    if (!this.connected || !this.isAlive) {
      return {
        status: 'offline',
        performance: 'poor',
        isOverloaded: false,
        needsRestart: true,
        penaltyScore: 999999,
        estimatedRemainingCapacity: 0,
        recommendations: [RecommendationsStrings.nodeOffline, RecommendationsStrings.checkConnectivity],
        metrics,
      }
    }

    let cpuScore = 0
    if (metrics.cpuLoad < cpuThresholds.excellent) cpuScore = 4
    else if (metrics.cpuLoad < cpuThresholds.good) cpuScore = 3
    else if (metrics.cpuLoad < cpuThresholds.fair) cpuScore = 2
    else if (metrics.cpuLoad < cpuThresholds.poor) cpuScore = 1

    let memoryScore = 0
    if (metrics.memoryUsage < memoryThresholds.excellent) memoryScore = 4
    else if (metrics.memoryUsage < memoryThresholds.good) memoryScore = 3
    else if (metrics.memoryUsage < memoryThresholds.fair) memoryScore = 2
    else if (metrics.memoryUsage < memoryThresholds.poor) memoryScore = 1

    let pingScore = 0
    if (metrics.ping < pingThresholds.excellent) pingScore = 4
    else if (metrics.ping < pingThresholds.good) pingScore = 3
    else if (metrics.ping < pingThresholds.fair) pingScore = 2
    else if (metrics.ping < pingThresholds.poor) pingScore = 1

    const avgScore = (cpuScore + memoryScore + pingScore) / 3
    let performance: HealthPerformanceKeys = 'poor'
    if (avgScore >= 3.5) performance = 'excellent'
    else if (avgScore >= 2.5) performance = 'good'
    else if (avgScore >= 1.5) performance = 'fair'

    const isOverloaded = metrics.cpuLoad > cpuThresholds.fair || metrics.memoryUsage > memoryThresholds.fair || metrics.frameDeficit > 100
    const isCritical = metrics.cpuLoad > cpuThresholds.poor || metrics.memoryUsage > memoryThresholds.poor || metrics.frameDeficit > 500

    const status: HealthStatusKeys = isCritical ? 'critical' : isOverloaded ? 'degraded' : 'healthy'

    const needsRestart =
      status === 'critical' ||
      (isOverloaded && metrics.memoryUsage > 90) ||
      metrics.frameDeficit > 1000 ||
      (this.reconnectionAttemptCount > 0 && this.reconnectionAttemptCount >= this.options.retryAmount / 2)

    if (metrics.cpuLoad > cpuThresholds.fair) recommendations.push(RecommendationsStrings.highCPULoad(metrics.cpuLoad))
    if (metrics.systemLoad > 0.8) recommendations.push(RecommendationsStrings.highSystemLoad(metrics.systemLoad))
    if (metrics.memoryUsage > memoryThresholds.fair) recommendations.push(RecommendationsStrings.highMemoryUsage(metrics.memoryUsage))
    if (metrics.frameDeficit > 100) recommendations.push(RecommendationsStrings.frameDeficit(metrics.frameDeficit))
    if (metrics.ping > pingThresholds.fair) recommendations.push(RecommendationsStrings.highLatency(metrics.ping))
    if (needsRestart) recommendations.push(RecommendationsStrings.nodeRestart)
    if (metrics.players > 500) recommendations.push(RecommendationsStrings.highPlayercount(metrics.players))

    const nullFrames = this.stats.frameStats?.nulled || 0
    let penaltyScore =
      metrics.players +
      Math.pow(metrics.cpuLoad * 100, 2) +
      Math.pow(metrics.memoryUsage, 1.5) +
      metrics.ping * 2 +
      metrics.frameDeficit * 10 +
      nullFrames * 5

    if (status === 'critical') penaltyScore += 10000
    else if (status === 'degraded') penaltyScore += 5000

    if (this.reconnectionAttemptCount > 0) penaltyScore += this.reconnectionAttemptCount * 1000

    penaltyScore = Math.round(penaltyScore)

    let estimatedRemainingCapacity = 0

    if (status !== 'critical') {
      const cpuCapacity =
        metrics.players === 0
          ? 200
          : metrics.cpuLoad > 0
            ? Math.max(0, Math.floor(((cpuThresholds.fair - metrics.cpuLoad) / metrics.cpuLoad) * metrics.players))
            : 200
      const memoryCapacity =
        metrics.players === 0
          ? 200
          : metrics.memoryUsage > 0
            ? Math.max(0, Math.floor(((memoryThresholds.fair - metrics.memoryUsage) / metrics.memoryUsage) * metrics.players))
            : 200

      estimatedRemainingCapacity = Math.min(Math.min(cpuCapacity, memoryCapacity), 500)

      if (isOverloaded) estimatedRemainingCapacity = 0
    }

    return {
      status,
      performance,
      isOverloaded,
      needsRestart,
      penaltyScore,
      estimatedRemainingCapacity,
      recommendations,
      metrics,
    }
  }

  public routePlannerApi = {
    getStatus: async (): Promise<RoutePlanner> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      return (await this.request(`/routeplanner/status`)) as RoutePlanner
    },

    unmarkFailedAddress: async (address: string): Promise<unknown> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      return await this.request(`/routeplanner/free/address`, (r) => {
        r.method = 'POST'

        if (r.headers) r.headers['Content-Type'] = 'application/json'
        r.body = safeStringify({ address })
      })
    },

    unmarkAllFailedAddresses: async (): Promise<unknown> => {
      if (!this.sessionId) throw new Error('the Ryanlink-Node is either not ready, or not up to date!')
      return await this.request(`/routeplanner/free/all`, (r) => {
        r.method = 'POST'

        if (r.headers) r.headers['Content-Type'] = 'application/json'
      })
    },
  }

  private validate(): void {
    if (!this.options.authorization) throw new SyntaxError("RyanlinkNode requires 'authorization'")
    if (!this.options.host) throw new SyntaxError("RyanlinkNode requires 'host'")
    if (!this.options.port) throw new SyntaxError("RyanlinkNode requires 'port'")
    if (typeof this.options.port !== 'number' || this.options.port < 1 || this.options.port > 65535)
      throw new SyntaxError('RyanlinkNode.port must be a number within 1 and 65535')
    if (this.options.closeOnError !== undefined && typeof this.options.closeOnError !== 'boolean')
      throw new SyntaxError('RyanlinkNode.closeOnError must be either false | true aka boolean')
    if (this.options.retryDelay !== undefined && typeof this.options.retryDelay !== 'number')
      throw new SyntaxError('NodeConfiguration.retryDelay must be a number')
    if (this.options.retryAmount !== undefined && typeof this.options.retryAmount !== 'number')
      throw new SyntaxError('NodeConfiguration.retryAmount must be a number')
    if (this.options.retryTimespan !== undefined && typeof this.options.retryTimespan !== 'number')
      throw new SyntaxError('NodeConfiguration.retryTimespan must be a number')
    if (this.options.requestSignalTimeoutMS !== undefined && typeof this.options.requestSignalTimeoutMS !== 'number')
      throw new SyntaxError('NodeConfiguration.requestSignalTimeoutMS must be a number')
    if (this.options.heartBeatInterval !== undefined && typeof this.options.heartBeatInterval !== 'number')
      throw new SyntaxError('NodeConfiguration.heartBeatInterval must be a number')
    if (this.options.enablePingOnStatsCheck !== undefined && typeof this.options.enablePingOnStatsCheck !== 'boolean')
      throw new SyntaxError('NodeConfiguration.enablePingOnStatsCheck must be either false | true aka boolean')
    if (this.options.autoChecks !== undefined && typeof this.options.autoChecks !== 'object')
      throw new SyntaxError('RyanlinkNode.autoChecks must be an object')
    if (this.options?.autoChecks?.sourcesValidations !== undefined && typeof this.options?.autoChecks?.sourcesValidations !== 'boolean')
      throw new SyntaxError('RyanlinkNode.autoChecks.sourcesValidations must be either false | true aka boolean')
    if (this.options?.autoChecks?.pluginValidations !== undefined && typeof this.options?.autoChecks?.pluginValidations !== 'boolean')
      throw new SyntaxError('RyanlinkNode.autoChecks.pluginValidations must be either false | true aka boolean')
    if (this.options.regions !== undefined && (!Array.isArray(this.options.regions) || !this.options.regions.every((r) => typeof r === 'string')))
      throw new SyntaxError('RyanlinkNode.regions must be an Array of strings')
  }

  public isNodeLink(): this is NodeLinkNode {
    return this.nodeType === 'NodeLink'
  }

  public isRyanlinkNode(): this is RyanlinkNode {
    return this.nodeType === 'Core'
  }

  private syncPlayerData(data: Partial<PlayerUpdateInfo>, res?: AudioPlayerState): void {
    if (
      typeof data === 'object' &&
      typeof data?.guildId === 'string' &&
      typeof data.playerOptions === 'object' &&
      Object.keys(data.playerOptions).length > 0
    ) {
      const player = this._LManager.getPlayer(data.guildId)
      if (!player) return

      if (typeof data.playerOptions.paused !== 'undefined') {
        player.paused = data.playerOptions.paused
        player.playing = !data.playerOptions.paused
      }

      if (typeof data.playerOptions.position === 'number') {
        player.lastPosition = data.playerOptions.position
        player.lastPositionChange = Date.now()
      }

      if (typeof data.playerOptions.voice !== 'undefined') player.voice = data.playerOptions.voice
      if (typeof data.playerOptions.volume !== 'undefined') {
        if (this._LManager.options.playerOptions.volumeDecrementer) {
          player.volume = Math.round(data.playerOptions.volume / this._LManager.options.playerOptions.volumeDecrementer)
          player.internalVolume = Math.round(data.playerOptions.volume)
        } else {
          player.volume = Math.round(data.playerOptions.volume)
          player.internalVolume = Math.round(data.playerOptions.volume)
        }
      }

      if (typeof data.playerOptions.filters !== 'undefined') {
        const oldFilterTimescale = { ...player.filterManager.data.timescale }
        Object.freeze(oldFilterTimescale)
        if (data.playerOptions.filters.timescale) player.filterManager.data.timescale = data.playerOptions.filters.timescale
        if (data.playerOptions.filters.distortion) player.filterManager.data.distortion = data.playerOptions.filters.distortion
        if (data.playerOptions.filters.channelMix) player.filterManager.data.channelMix = data.playerOptions.filters.channelMix
        if (data.playerOptions.filters.pluginFilters) player.filterManager.data.pluginFilters = data.playerOptions.filters.pluginFilters
        if (data.playerOptions.filters.vibrato) player.filterManager.data.vibrato = data.playerOptions.filters.vibrato
        if (data.playerOptions.filters.volume) player.filterManager.data.volume = data.playerOptions.filters.volume
        if (data.playerOptions.filters.equalizer) player.filterManager.equalizerBands = data.playerOptions.filters.equalizer
        if (data.playerOptions.filters.karaoke) player.filterManager.data.karaoke = data.playerOptions.filters.karaoke
        if (data.playerOptions.filters.lowPass) player.filterManager.data.lowPass = data.playerOptions.filters.lowPass
        if (data.playerOptions.filters.rotation) player.filterManager.data.rotation = data.playerOptions.filters.rotation
        if (data.playerOptions.filters.tremolo) player.filterManager.data.tremolo = data.playerOptions.filters.tremolo

        if (data.playerOptions.filters.echo) player.filterManager.data.echo = data.playerOptions.filters.echo
        if (data.playerOptions.filters.chorus) player.filterManager.data.chorus = data.playerOptions.filters.chorus
        if (data.playerOptions.filters.compressor) player.filterManager.data.compressor = data.playerOptions.filters.compressor
        if (data.playerOptions.filters.highPass) player.filterManager.data.highPass = data.playerOptions.filters.highPass
        if (data.playerOptions.filters.phaser) player.filterManager.data.phaser = data.playerOptions.filters.phaser
        if (data.playerOptions.filters.spatial) player.filterManager.data.spatial = data.playerOptions.filters.spatial
        player.filterManager.checkFiltersState(oldFilterTimescale)
      }
    }

    if (typeof res?.guildId === 'string' && typeof res?.voice !== 'undefined') {
      const player = this._LManager.getPlayer(res.guildId)
      if (!player) return

      if (typeof res?.voice?.connected === 'boolean' && res.voice.connected === false) {
        player.destroy(DestroyReasons.NodeNoVoice)
        return
      }
      player.ping.ws = res?.voice?.ping || player?.ping.ws
    }

    return
  }

  private get restAddress(): string {
    return `http${this.options.secure ? 's' : ''}://${this.options.host}:${this.options.port}`
  }

  public get isNodeReconnecting(): boolean {
    return this.reconnectionState !== ReconnectionState.IDLE
  }

  private reconnect(force = false): void {
    if (this.isNodeReconnecting) {
      return
    }

    this.reconnectionState = ReconnectionState.PENDING
    this.NodeManager.emit('reconnectinprogress', this)

    if (force) {
      this.executeReconnect()
      return
    }

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)

    this.consecutiveReconnectAttempts++
    const baseDelay = this.options.retryDelay || 1000
    const maxDelay = 30000
    const delay = Math.min(baseDelay * Math.pow(2, this.consecutiveReconnectAttempts - 1), maxDelay)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.executeReconnect()
    }, delay)
  }

  public get reconnectionAttemptCount(): number {
    const maxAllowedTimestan = this.options.retryTimespan || -1
    if (maxAllowedTimestan <= 0) return this.reconnectAttempts.length
    return this.reconnectAttempts.filter((timestamp) => Date.now() - timestamp <= maxAllowedTimestan).length
  }

  private executeReconnect() {
    if (this.reconnectionAttemptCount >= this.options.retryAmount) {
      const error = new Error(`Unable to connect after ${this.options.retryAmount} attempts.`)

      this.reconnectionState = ReconnectionState.DESTROYING

      this.NodeManager.emit('error', error, this)
      this.destroy(DestroyReasons.NodeReconnectFail)

      return
    }

    const MAX_RECONNECT_ATTEMPTS = 1000
    this.reconnectAttempts.push(Date.now())

    if (this.reconnectAttempts.length > MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts = this.reconnectAttempts.slice(-MAX_RECONNECT_ATTEMPTS)
    }
    this.reconnectionState = ReconnectionState.RECONNECTING

    this.NodeManager.emit('reconnecting', this)
    this.connect()
  }

  private resetReconnectionAttempts(): void {
    this.reconnectionState = ReconnectionState.IDLE
    this.reconnectAttempts = []
    this.consecutiveReconnectAttempts = 0
    clearTimeout(this.reconnectTimeout)
    this.reconnectTimeout = null
    return
  }

  private resetAckTimeouts(heartbeat: boolean = true, ping: boolean = true): void {
    if (ping) {
      if (this.pingTimeout) clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }
    if (heartbeat) {
      if (this.heartBeatInterval) clearInterval(this.heartBeatInterval)
      this.heartBeatInterval = null
    }
    return
  }

  private async open(): Promise<void> {
    this.isAlive = true
    const syncStart = Date.now()

    this.resetReconnectionAttempts()

    if (this.nodeType === 'Core') {
      try {
        await this.fetchInfo()
        const syncEnd = Date.now()
        const delta = syncEnd - syncStart
        this.handshakePing = delta
        this.dispatchDebug(DebugEvents.NodeHandshakeSync, {
          state: 'log',
          message: `Handshake Synchronization successful. Node latency: ${delta}ms.`,
          functionLayer: 'RyanlinkNode > open()',
        })
      } catch (e) {
        this.dispatchDebug(DebugEvents.NodeHandshakeSync, {
          state: 'warn',
          message: `Handshake Synchronization failed: ${e.message}`,
          functionLayer: 'RyanlinkNode > open()',
        })
      }

      if (this.options.enablePingOnStatsCheck) this.heartBeat()

      if (this.heartBeatInterval) clearInterval(this.heartBeatInterval)

      if (this.options.heartBeatInterval > 0) {
        if (typeof this.socket?.on === 'function') {
          this.socket.on('pong', () => {
            this.heartBeatPongTimestamp = performance.now()
            this.isAlive = true
          })
        }

        this.heartBeatInterval = setInterval(() => {
          if (!this.socket) return console.error('Node-Heartbeat-Interval - Socket not available - maybe reconnecting?')
          if (!this.isAlive) return this.close(500, 'Node-Heartbeat-Timeout')

          this.isAlive = false
          this.heartBeatPingTimestamp = performance.now()
          if (typeof this.socket?.ping === 'function') {
            this.socket.ping()
          }
        }, this.options.heartBeatInterval || 30_000)
      }
    }

    this.info = await this.fetchInfo().catch((e) => (console.error(e, 'ON-OPEN-FETCH'), null))

    if (!this.info && ['v3', 'v4'].includes(this.version)) {
      const errorString = `Audio Node(${this.restAddress}) does not provide any / ${this.version}/info`
      throw new Error(errorString)
    }

    this.info.isNodelink = !!this.info.isNodelink

    if (this.options.sponsorblock || this.options.xm || this.options.dunctebot || this.options.lavadspx) {
      await this.updateSession().catch((e) => {
        this.dispatchDebug(DebugEvents.UpdateSessionFail, {
          state: 'warn',
          message: `Failed to update session with plugin options: ${e.message}`,
          functionLayer: 'RyanlinkNode > open() > updateSession()',
        })
      })
    }

    this.NodeManager.emit('connect', this)
    console.log(`\x1b[32m[Ryanlink]\x1b[0m Node \x1b[36m${this.id}\x1b[0m connected successfully.`)
  }

  private close(code: number, reason: string): void {
    this.resetAckTimeouts(true, true)

    try {
      if (this.socket) {
        this.socket.removeAllListeners()
        this.socket = null
      }
    } catch (e) {
      if (this.NodeManager?.RyanlinkManager?.options?.advancedOptions?.enableDebugEvents) {
        this._LManager.emit('debug', DebugEvents.SocketCleanupError, {
          state: 'warn',
          message: `An error occurred during socket cleanup in close() (likely a race condition): ${e.message}`,
          functionLayer: 'RyanlinkNode > close()',
        })
      }
    }

    this.isAlive = false

    if (code === 1006 && !reason) reason = 'Socket got terminated due to no ping connection'
    if (code === 1000 && reason === 'Node-Disconnect') return

    this.NodeManager.emit('disconnect', this, { code, reason })

    if (code !== 1000 || reason !== 'Node-Destroy') {
      if (this.NodeManager.nodes.has(this.id)) {
        this.reconnect()
      }
    }

    this._LManager.players
      .filter((p) => p?.node?.options?.id === this?.options?.id)
      .forEach((p) => {
        if (!this._LManager.options.autoMove) return (p.playing = false)
        this.dispatchDebug(DebugEvents.NodeAtomicMigration, {
          state: 'log',
          message: `Initiating Atomic Migration for player on guild "${p.guildId}" due to node disconnect.`,
          functionLayer: 'RyanlinkNode > close() > AtomicMigration',
        })
        if (this.NodeManager.nodes.filter((n) => n.connected).size === 0) return (p.playing = false)
        p.moveNode().catch((e) => {
          this.dispatchDebug(DebugEvents.NodeAtomicMigration, {
            state: 'error',
            message: `Atomic Migration failed for player on guild "${p.guildId}": ${e.message}`,
            functionLayer: 'RyanlinkNode > close() > AtomicMigration',
          })
        })
      })
  }

  private error(error: Error): void {
    if (!error) return
    this.NodeManager.emit('error', error, this)
    this.reconnectionState = ReconnectionState.IDLE
    if (this.options.closeOnError) {
      if (this.heartBeatInterval) clearInterval(this.heartBeatInterval)
      if (this.pingTimeout) clearTimeout(this.pingTimeout)
      this.socket?.close(500, 'Node-Error - Force Reconnect')
      return
    }
    this.reconnect()
  }

  private async message(d: Buffer | string): Promise<void> {
    if (Array.isArray(d)) d = Buffer.concat(d)
    else if (d instanceof ArrayBuffer) d = Buffer.from(d)

    let payload
    try {
      payload = JSON.parse(d.toString())
    } catch (e) {
      this.NodeManager.emit('error', e, this)
      return
    }

    if (!payload.op) return

    this.NodeManager.emit('raw', this, payload)

    switch (payload.op) {
      case 'stats':
        if (this.options.enablePingOnStatsCheck) this.heartBeat()
        delete payload.op
        this.stats = { ...payload } as unknown as NodeStats
        break
      case 'playerUpdate':
        {
          const player = this._LManager.getPlayer(payload.guildId)
          if (!player)
            return this.dispatchDebug(DebugEvents.PlayerUpdateNoPlayer, {
              state: 'error',
              message: `PlayerUpdate Event Triggered, but no player found of payload.guildId: ${payload.guildId}`,
              functionLayer: 'RyanlinkNode > nodeEvent > playerUpdate',
            })

          const oldPlayer = player?.toJSON()

          player.lastPositionChange = Date.now()
          player.lastPosition = payload.state.position || 0
          player.connected = payload.state.connected
          player.ping.ws = payload.state.ping >= 0 ? payload.state.ping : player.ping.ws <= 0 && player.connected ? null : player.ping.ws || 0

          player.queue.position = player.lastPosition
          player.queue.utils.save().catch(() => { })

          if (!player.createdTimeStamp && payload.state.time) player.createdTimeStamp = payload.state.time

          if (
            player.filterManager.filterUpdatedState === true &&
            ((player.queue.current?.info?.duration || 0) <= (player.RyanlinkManager.options.advancedOptions.maxFilterFixDuration || 600_000) ||
              (player.queue.current?.info?.uri && isAbsolute(player.queue.current?.info?.uri)))
          ) {
            player.filterManager.filterUpdatedState = false

            this.dispatchDebug(DebugEvents.PlayerUpdateFilterFixApply, {
              state: 'log',
              message: `Fixing FilterState on "${player.guildId}" because player.options.instaUpdateFiltersFix === true`,
              functionLayer: 'RyanlinkNode > nodeEvent > playerUpdate',
            })

            await player.seek(player.position)
          }
          this._LManager.emit('playerUpdate', oldPlayer, player)
        }
        break
      case 'event':
        await this.handleEvent(payload)
        break
      case 'ready':
        this.resetReconnectionAttempts()

        this.sessionId = payload.sessionId
        this.resuming.enabled = payload.resumed
        if (payload.resumed === true) {
          try {
            this.NodeManager.emit('resumed', this, payload, await this.fetchAllPlayers())
          } catch (e) {
            this.dispatchDebug(DebugEvents.ResumingFetchingError, {
              state: 'error',
              message: `Failed to fetch players for resumed event, falling back without players array`,
              error: e,
              functionLayer: 'RyanlinkNode > nodeEvent > resumed',
            })
            this.NodeManager.emit('resumed', this, payload, [])
          }
        }
        break
      default:
        this.NodeManager.emit('error', new Error(`Unexpected op "${payload.op}" with data`), this, payload)
        return
    }
  }

  private async handleEvent(payload: PlayerEventType & PlayerEvents): Promise<void> {
    if (!payload?.guildId) return

    const player = this._LManager.getPlayer(payload.guildId)
    if (!player) return

    const NodeLinkEventType = payload.type as NodeLinkEventTypes
    if (NodeLinkExclusiveEvents.includes(NodeLinkEventType) && (!this.info || this.info.isNodelink)) {
      return this.nodeLinkEventHandler(
        NodeLinkEventType,
        player,
        player.queue.current,
        payload as unknown as NodeLinkEventPayload<typeof NodeLinkEventType>
      )
    }

    switch (payload.type) {
      case 'ReadyEvent':
        if (this.info?.isNodelink === true) await this.trackStart(player, player.queue.current as Track, payload as any)
        break
      case 'TrackStartEvent':
        await this.trackStart(player, player.queue.current as Track, payload as TrackStartEvent)
        break
      case 'TrackEndEvent':
        await this.trackEnd(player, player.queue.current as Track, payload as TrackEndEvent)
        break
      case 'TrackStuckEvent':
        await this.trackStuck(player, player.queue.current as Track, payload as TrackStuckEvent)
        break
      case 'TrackExceptionEvent':
        await this.trackError(player, player.queue.current as Track, payload as TrackExceptionEvent)
        break
      case 'WebSocketClosedEvent':
        this.socketClosed(player, payload as WebSocketClosedEvent)
        break
      case 'SegmentsLoaded':
        await this.SponsorBlockSegmentLoaded(player, player.queue.current as Track, payload)
        break
      case 'SegmentSkipped':
        await this.SponsorBlockSegmentSkipped(player, player.queue.current as Track, payload)
        break
      case 'ChaptersLoaded':
        await this.SponsorBlockChaptersLoaded(player, player.queue.current as Track, payload)
        break
      case 'ChapterStarted':
        await this.SponsorBlockChapterStarted(player, player.queue.current as Track, payload)
        break
      case 'LyricsLineEvent':
        await this.LyricsLine(player, player.queue.current as Track, payload)
        break
      case 'LyricsFoundEvent':
        await this.LyricsFound(player, player.queue.current as Track, payload)
        break
      case 'LyricsNotFoundEvent':
        await this.LyricsNotFound(player, player.queue.current as Track, payload)
        break
      default:
        this.NodeManager.emit(
          'error',
          new Error(`Node#event unknown event '${(payload as PlayerEventType & PlayerEvents).type}'.`),
          this,
          payload as PlayerEventType & PlayerEvents
        )
        break
    }
    return
  }

  private async nodeLinkEventHandler<NodeLinkEventName extends NodeLinkEventTypes>(
    eventName: NodeLinkEventName,
    player: Player,
    track: Track | null,
    payload: NodeLinkEventPayload<NodeLinkEventName>
  ) {
    this.NodeManager.emit('nodeLinkEvent', this, eventName as any, player, track, payload as any)
  }

  private getTrackOfPayload(payload: PlayerEvents): Track | null {
    return 'track' in payload ? this._LManager.utils.buildTrack(payload.track, undefined) : null
  }

  private async trackStart(player: Player, track: Track, payload: TrackStartEvent): Promise<void> {
    if (!player.getData('internal_nodeChanging')) {
      player.playing = true
      player.paused = false
    }

    if (this._LManager.options?.emitNewSongsOnly === true && player.queue.previous[0]?.info?.identifier === track?.info?.identifier) {
      return this.dispatchDebug(DebugEvents.TrackStartNewSongsOnly, {
        state: 'log',
        message: `TrackStart not Emitting, because playing the previous song again.`,
        functionLayer: 'RyanlinkNode > trackStart()',
      })
    }
    if (!player.queue.current) {
      player.queue.current = this.getTrackOfPayload(payload)
      if (player.queue.current) {
        await player.queue.utils.save()
      } else {
        this.dispatchDebug(DebugEvents.TrackStartNoTrack, {
          state: 'warn',
          message: `Trackstart emitted but there is no track on player.queue.current, trying to get the track of the payload failed too.`,
          functionLayer: 'RyanlinkNode > trackStart()',
        })
      }
    }
    if (typeof player.options.onTrackStart === 'function') {
      try {
        player.options.onTrackStart(player, track)
      } catch (e) {
        this.dispatchDebug(DebugEvents.NodeRawEvent, {
          state: 'error',
          message: `Error in player.options.onTrackStart: ${e.message}`,
          functionLayer: 'RyanlinkNode > trackStart() > onTrackStart',
        })
      }
    }

    this._LManager.emit('trackStart', player, player.queue.current, payload)
    return
  }

  private async trackEnd(player: Player, track: Track, payload: TrackEndEvent): Promise<void> {
    if (player.getData('internal_nodeChanging') === true) return
    const trackToUse = track || this.getTrackOfPayload(payload)

    if (payload.reason === 'replaced') {
      this.dispatchDebug(DebugEvents.TrackEndReplaced, {
        state: 'warn',
        message: `TrackEnd Event does not handle any playback, because the track was replaced.`,
        functionLayer: 'RyanlinkNode > trackEnd()',
      })
      this._LManager.emit('trackEnd', player, trackToUse, payload)
      return
    }

    if (!player.queue.tracks.length && (player.repeatMode === 'off' || player.getData('internal_stopPlaying')))
      return this.queueEnd(player, track, payload)

    if (['loadFailed', 'cleanup'].includes(payload.reason)) {
      if (player.getData('internal_destroystatus') === true) return
      await queueTrackEnd(player)

      if (!player.queue.current) return this.queueEnd(player, trackToUse, payload)

      this._LManager.emit('trackEnd', player, trackToUse, payload)

      if (this._LManager.options.autoSkip && player.queue.current) {
        player.play({ noReplace: true })
      }
      return
    }

    if (player.repeatMode !== 'track' || player.getData('internal_skipped')) await queueTrackEnd(player)
    else if (trackToUse && !trackToUse?.pluginInfo?.clientData?.previousTrack) {
      player.queue.previous.unshift(trackToUse as Track)
      if (player.queue.previous.length > player.queue.options.maxPreviousTracks)
        player.queue.previous.splice(player.queue.options.maxPreviousTracks, player.queue.previous.length)
      await player.queue.utils.save()
    }

    if (!player.queue.current) return this.queueEnd(player, trackToUse, payload)
    player.setData('internal_skipped', false)

    this._LManager.emit('trackEnd', player, trackToUse, payload)

    if (this._LManager.options.autoSkip && player.queue.current) {
      player.play({ noReplace: true })
    }
    return
  }

  private async trackStuck(player: Player, track: Track, payload: TrackStuckEvent): Promise<void> {
    if (
      this._LManager.options.playerOptions.maxErrorsPerTime?.threshold > 0 &&
      this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount >= 0
    ) {
      const oldTimestamps = ((player.getData('internal_erroredTracksTimestamps') as number[]) || []).filter(
        (v) => Date.now() - v < this._LManager.options.playerOptions.maxErrorsPerTime?.threshold
      )
      player.setData('internal_erroredTracksTimestamps', [...oldTimestamps, Date.now()])
      if (oldTimestamps.length >= this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount) {
        this.dispatchDebug(DebugEvents.TrackStuckMaxTracksErroredPerTime, {
          state: 'log',
          message: `trackStuck Event was triggered too often within a given threshold (RyanlinkManager.options.playerOptions.maxErrorsPerTime). Threshold: "${this._LManager.options.playerOptions.maxErrorsPerTime?.threshold}ms", maxAmount: "${this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount}"`,
          functionLayer: 'RyanlinkNode > trackStuck()',
        })
        player.destroy(DestroyReasons.TrackStuckMaxTracksErroredPerTime)
        return
      }
    }
    this._LManager.emit('trackStuck', player, track || this.getTrackOfPayload(payload), payload)

    if (!player.queue.tracks.length && (player.repeatMode === 'off' || player.getData('internal_stopPlaying'))) {
      try {
        await player.node.updatePlayer({
          guildId: player.guildId,
          playerOptions: { track: { encoded: null } },
        })
        return
      } catch {
        return this.queueEnd(player, track || this.getTrackOfPayload(payload), payload)
      }
    }

    await queueTrackEnd(player)

    if (!player.queue.current) {
      return this.queueEnd(player, track || this.getTrackOfPayload(payload), payload)
    }

    if (this._LManager.options.autoSkip && player.queue.current) {
      player.play({ track: player.queue.current, noReplace: false })
    }
    return
  }

  private async trackError(player: Player, track: Track, payload: TrackExceptionEvent): Promise<void> {
    if (
      this._LManager.options.playerOptions.maxErrorsPerTime?.threshold > 0 &&
      this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount >= 0
    ) {
      const oldTimestamps = ((player.getData('internal_erroredTracksTimestamps') as number[]) || []).filter(
        (v) => Date.now() - v < this._LManager.options.playerOptions.maxErrorsPerTime?.threshold
      )
      player.setData('internal_erroredTracksTimestamps', [...oldTimestamps, Date.now()])
      if (oldTimestamps.length >= this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount) {
        this.dispatchDebug(DebugEvents.TrackErrorMaxTracksErroredPerTime, {
          state: 'log',
          message: `TrackError Event was triggered too often within a given threshold (RyanlinkManager.options.playerOptions.maxErrorsPerTime). Threshold: "${this._LManager.options.playerOptions.maxErrorsPerTime?.threshold}ms", maxAmount: "${this._LManager.options.playerOptions.maxErrorsPerTime?.maxAmount}"`,
          functionLayer: 'RyanlinkNode > trackError()',
        })
        player.destroy(DestroyReasons.TrackErrorMaxTracksErroredPerTime)
        return
      }
    }

    this._LManager.emit('trackError', player, track || this.getTrackOfPayload(payload), payload)
    return
  }

  private socketClosed(player: Player, payload: WebSocketClosedEvent): void {
    this._LManager.emit('playerSocketClosed', player, payload)
    return
  }

  private SponsorBlockSegmentLoaded(player: Player, track: Track, payload: SponsorBlockSegmentsLoaded): void {
    this._LManager.emit('SegmentsLoaded', player, track || this.getTrackOfPayload(payload), payload)
    return
  }

  private SponsorBlockSegmentSkipped(player: Player, track: Track, payload: SponsorBlockSegmentSkipped): void {
    this._LManager.emit('SegmentSkipped', player, track || this.getTrackOfPayload(payload), payload)
    return
  }

  private SponsorBlockChaptersLoaded(player: Player, track: Track, payload: SponsorBlockChaptersLoaded): void {
    this._LManager.emit('ChaptersLoaded', player, track || this.getTrackOfPayload(payload), payload)
    return
  }

  private SponsorBlockChapterStarted(player: Player, track: Track, payload: SponsorBlockChapterStarted): void {
    this._LManager.emit('ChapterStarted', player, track || this.getTrackOfPayload(payload), payload)
    return
  }

  public async getSponsorBlock(player: Player): Promise<SponsorBlockSegment[]> {

    if (this._checkForPlugins && !this.info?.plugins?.find?.((v) =>
      v.name === 'sponsorblock-plugin' ||
      v.name.toLowerCase() === 'sponsorblock'
    ))
      throw new RangeError(`there is no sponsorblock-plugin available in the ryanlink node: ${this.id}`)

    return (await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/sponsorblock/categories`)) as SponsorBlockSegment[]
  }

  public async setSponsorBlock(player: Player, segments: SponsorBlockSegment[] = ['sponsor', 'selfpromo']): Promise<void> {
    if (this._checkForPlugins && !this.info?.plugins?.find?.((v) =>
      v.name === 'sponsorblock-plugin' ||
      v.name.toLowerCase() === 'sponsorblock'
    ))
      throw new RangeError(`there is no sponsorblock-plugin available in the ryanlink node: ${this.id}`)

    if (!segments.length) throw new RangeError("No Segments provided. Did you ment to use 'deleteSponsorBlock'?")

    if (segments.some((v) => !validSponsorBlocks.includes(v.toLowerCase())))
      throw new SyntaxError(`You provided a sponsorblock which isn't valid, valid ones are: ${validSponsorBlocks.map((v) => `'${v}'`).join(', ')}`)

    await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/sponsorblock/categories`, (r) => {
      r.method = 'PUT'
      r.headers = {
        Authorization: this.options.authorization,
        'Content-Type': 'application/json',
      }
      r.body = safeStringify(segments.map((v) => v.toLowerCase()))
    })

    player.setData(
      'internal_sponsorBlockCategories',
      segments.map((v) => v.toLowerCase())
    )

    this.dispatchDebug(DebugEvents.SetSponsorBlock, {
      state: 'log',
      message: `SponsorBlock was set for Player: ${player.guildId} to: ${segments.map((v) => `'${v.toLowerCase()}'`).join(', ')}`,
      functionLayer: 'RyanlinkNode > setSponsorBlock()',
    })

    return
  }

  public async deleteSponsorBlock(player: Player): Promise<void> {
    if (this._checkForPlugins && !this.info?.plugins?.find?.((v) =>
      v.name === 'sponsorblock-plugin' ||
      v.name.toLowerCase() === 'sponsorblock'
    ))
      throw new RangeError(`there is no sponsorblock-plugin available in the ryanlink node: ${this.id}`)

    await this.request(`/sessions/${this.sessionId}/players/${player.guildId}/sponsorblock/categories`, (r) => {
      r.method = 'DELETE'
    })

    player.setData('internal_sponsorBlockCategories', [])

    this.dispatchDebug(DebugEvents.DeleteSponsorBlock, {
      state: 'log',
      message: `SponsorBlock was deleted for Player: ${player.guildId}`,
      functionLayer: 'RyanlinkNode > deleteSponsorBlock()',
    })
    return
  }

  private async queueEnd(player: Player, track: Track, payload: TrackEndEvent | TrackStuckEvent | TrackExceptionEvent): Promise<void> {
    if (player.getData('internal_nodeChanging') === true) return

    player.queue.current = null
    player.playing = false
    player.setData('internal_stopPlaying', undefined)

    this.dispatchDebug(DebugEvents.QueueEnded, {
      state: 'log',
      message: `Queue Ended because no more Tracks were in the Queue, due to EventName: "${payload.type}"`,
      functionLayer: 'RyanlinkNode > queueEnd()',
    })

    if (
      typeof this._LManager.options?.playerOptions?.onEmptyQueue?.autoPlayFunction === 'function' &&
      typeof player.getData('internal_autoplayStopPlaying') === 'undefined'
    ) {
      this.dispatchDebug(DebugEvents.AutoplayExecution, {
        state: 'log',
        message: `Now Triggering Autoplay.`,
        functionLayer: 'RyanlinkNode > queueEnd() > autoplayFunction',
      })

      const previousAutoplayTime = player.getData('internal_previousautoplay') as number
      const duration = previousAutoplayTime ? Date.now() - previousAutoplayTime : 0
      if (!duration || duration > this._LManager.options.playerOptions.minAutoPlayMs || !!player.getData('internal_skipped')) {
        await this._LManager.options?.playerOptions?.onEmptyQueue?.autoPlayFunction(player, track)
        player.setData('internal_previousautoplay', Date.now())
        if (player.queue.tracks.length > 0) await queueTrackEnd(player)
        else
          this.dispatchDebug(DebugEvents.AutoplayNoSongsAdded, {
            state: 'warn',
            message: `Autoplay was triggered but no songs were added to the queue.`,
            functionLayer: 'RyanlinkNode > queueEnd() > autoplayFunction',
          })
      }
      if (player.queue.current) {
        if (payload.type === 'TrackEndEvent') this._LManager.emit('trackEnd', player, track, payload)
        if (this._LManager.options.autoSkip) return player.play({ noReplace: true, paused: false })
      } else {
        this.dispatchDebug(DebugEvents.AutoplayThresholdSpamLimiter, {
          state: 'warn',
          message: `Autoplay was triggered after the previousautoplay too early. Threshold is: ${this._LManager.options.playerOptions.minAutoPlayMs}ms and the Duration was ${duration}ms`,
          functionLayer: 'RyanlinkNode > queueEnd() > autoplayFunction',
        })
      }
    }

    player.setData('internal_skipped', false)
    player.setData('internal_autoplayStopPlaying', undefined)

    if (track && !track?.pluginInfo?.clientData?.previousTrack) {
      player.queue.previous.unshift(track)
      if (player.queue.previous.length > player.queue.options.maxPreviousTracks)
        player.queue.previous.splice(player.queue.options.maxPreviousTracks, player.queue.previous.length)
      await player.queue.utils.save()
    }

    if ((payload as TrackEndEvent)?.reason !== 'stopped') {
      await player.queue.utils.save()
    }

    if (
      typeof this._LManager.options.playerOptions?.onEmptyQueue?.destroyAfterMs === 'number' &&
      !isNaN(this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs) &&
      this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs >= 0
    ) {
      if (this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs === 0) {
        player.destroy(DestroyReasons.QueueEmpty)
        return
      } else {
        this.dispatchDebug(DebugEvents.TriggerQueueEmptyInterval, {
          state: 'log',
          message: `Trigger Queue Empty Interval was Triggered because playerOptions.onEmptyQueue.destroyAfterMs is set to ${this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs}ms`,
          functionLayer: 'RyanlinkNode > queueEnd() > destroyAfterMs',
        })

        this._LManager.emit('playerQueueEmptyStart', player, this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs)

        if (player.getData('internal_queueempty')) clearTimeout(player.getData('internal_queueempty'))
        player.setData(
          'internal_queueempty',
          setTimeout(() => {
            player.setData('internal_queueempty', undefined)
            if (player.queue.current) {
              return this._LManager.emit('playerQueueEmptyCancel', player)
            }
            this._LManager.emit('playerQueueEmptyEnd', player)
            player.destroy(DestroyReasons.QueueEmpty)
          }, this._LManager.options.playerOptions.onEmptyQueue?.destroyAfterMs)
        )
      }
    }

    if (typeof player.options.onQueueEnd === 'function') {
      try {
        player.options.onQueueEnd(player)
      } catch (e) {
        this.dispatchDebug(DebugEvents.QueueEnded, {
          state: 'error',
          message: `Error in player.options.onQueueEnd: ${e.message}`,
          functionLayer: 'RyanlinkNode > queueEnd() > onQueueEnd',
        })
      }
    }

    this._LManager.emit('queueEnd', player, track, payload)
    return
  }

  private async LyricsLine(player: Player, track: Track, payload: LyricsLineEvent): Promise<void> {
    if (!player.queue.current) {
      player.queue.current = this.getTrackOfPayload(payload)
      if (player.queue.current) {
        await player.queue.utils.save()
      } else {
        this.dispatchDebug(DebugEvents.TrackStartNoTrack, {
          state: 'warn',
          message: `Trackstart emitted but there is no track on player.queue.current, trying to get the track of the payload failed too.`,
          functionLayer: 'RyanlinkNode > trackStart()',
        })
      }
    }

    this._LManager.emit('LyricsLine', player, track, payload)
    return
  }

  private async LyricsFound(player: Player, track: Track, payload: LyricsFoundEvent): Promise<void> {
    if (!player.queue.current) {
      player.queue.current = this.getTrackOfPayload(payload)
      if (player.queue.current) {
        await player.queue.utils.save()
      } else {
        this.dispatchDebug(DebugEvents.TrackStartNoTrack, {
          state: 'warn',
          message: `Trackstart emitted but there is no track on player.queue.current, trying to get the track of the payload failed too.`,
          functionLayer: 'RyanlinkNode > trackStart()',
        })
      }
    }

    this._LManager.emit('LyricsFound', player, track, payload)
    return
  }

  private async LyricsNotFound(player: Player, track: Track, payload: LyricsNotFoundEvent): Promise<void> {
    if (!player.queue.current) {
      player.queue.current = this.getTrackOfPayload(payload)
      if (player.queue.current) {
        await player.queue.utils.save()
      } else {
        this.dispatchDebug(DebugEvents.TrackStartNoTrack, {
          state: 'warn',
          message: `Trackstart emitted but there is no track on player.queue.current, trying to get the track of the payload failed too.`,
          functionLayer: 'RyanlinkNode > trackStart()',
        })
      }
    }

    this._LManager.emit('LyricsNotFound', player, track, payload)
    return
  }

  public toJSON() {
    return {
      options: this.options,
      stats: this.stats,
      sessionId: this.sessionId,
      connected: this.connected,
      version: this.version,
    }
  }
}
