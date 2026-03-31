import { DebugEvents } from '../config/Constants'
import type { DestroyReasons } from '../config/Constants'
import { FilterManager } from './Filters'
import type { RyanlinkManager } from '../core/Manager'
import type { RyanlinkNode } from '../node/Node'
import type { NodeLinkNode } from '../node/NodeLink'
import { Queue, QueueSaver } from './Queue'
import type { SponsorBlockSegment } from '../types/Node'
import type { anyObject, PlayConfiguration, PlayerJson, PlayerOptions, PlayOptions, RepeatMode } from '../types/Player'
import type { Track, UnresolvedTrack } from '../types/Track'
import type { VoiceConnectionOptions, AudioSearchQuery, SearchQuery, UnresolvedSearchResult } from '../types/Utils'
import { queueTrackEnd } from '../utils/Utils'

interface BandCampAutocompleteTrackObject {
  url?: string
  uri?: string
  img?: string
  band_name?: string
  name?: string
  id?: string
  [name: string]: unknown
}

export interface AutoplayConfig {
  enabled?: boolean

  defaultSource?: 'ytsearch' | 'ytmsearch' | 'scsearch' | 'spsearch' | 'amsearch'

  limit?: number

  minDuration?: number

  maxDuration?: number

  excludeKeywords?: string[]
}
export class Player {
  public filterManager: FilterManager

  public RyanlinkManager: RyanlinkManager

  public options: PlayerOptions

  public node: RyanlinkNode | NodeLinkNode

  public queue: Queue

  public guildId: string

  public voiceChannelId: string | null = null

  public textChannelId: string | null = null

  public playing: boolean = false

  public paused: boolean = false

  public repeatMode: RepeatMode = 'off'

  public ping = {
    node: 0,

    ws: 0,
  }

  public volume: number = 100

  public internalVolume: number = 100

  public get position() {
    return this.lastPosition + (this.lastPositionChange ? Date.now() - this.lastPositionChange : 0)
  }

  public lastPositionChange: number | null = null

  public lastPosition: number = 0

  public lastSavedPosition: number = 0

  public createdTimeStamp: number

  public recentHistory: string[] = []

  public recentHistoryLimit: number = 15

  public autoplay: boolean = false

  public resolveRetryCount: number = 0

  public connected: boolean | undefined = false

  public voice: VoiceConnectionOptions = {
    endpoint: null,
    sessionId: null,
    token: null,
    channelId: undefined,
  }

  public voiceState: {
    selfDeaf: boolean
    selfMute: boolean
    serverDeaf: boolean
    serverMute: boolean
    suppress: boolean
  } = {
      selfDeaf: false,
      selfMute: false,
      serverDeaf: false,
      serverMute: false,
      suppress: false,
    }

  private readonly data: Record<string, unknown> = {}

  private dispatchDebug(
    name: DebugEvents,
    eventData: {
      message: string
      state: 'log' | 'warn' | 'error'
      error?: Error | string
      functionLayer: string
    }
  ) {
    if (!this.RyanlinkManager.options?.advancedOptions?.enableDebugEvents) return
    this.RyanlinkManager.emit('debug', name, eventData)
  }

  constructor(options: PlayerOptions, RyanlinkManager: RyanlinkManager, dontEmitPlayerCreateEvent?: boolean) {
    if (typeof options?.customData === 'object') for (const [key, value] of Object.entries(options.customData)) this.setData(key, value)

    this.options = options
    this.filterManager = new FilterManager(this)
    this.RyanlinkManager = RyanlinkManager

    if (typeof this.options.autoplay === 'boolean') {
      this.autoplay = this.options.autoplay
    }
    if (Array.isArray(this.options.recentHistory)) {
      this.recentHistory = this.options.recentHistory
    }

    this.guildId = this.options.guildId
    this.voiceChannelId = this.options.voiceChannelId
    this.textChannelId = this.options.textChannelId || null

    this.node = typeof this.options.node === 'string' ? this.RyanlinkManager.nodeManager.nodes.get(this.options.node) : this.options.node

    if (!this.node || typeof this.node.request !== 'function') {
      if (typeof this.options.node === 'string') {
        this.dispatchDebug(DebugEvents.PlayerCreateNodeNotFound, {
          state: 'warn',
          message: `Player was created with provided node Id: ${this.options.node}, but no node with that Id was found.`,
          functionLayer: 'Player > constructor()',
        })
      }

      const least = this.RyanlinkManager.nodeManager.leastUsedNodes()
      this.node = least.filter((v) => (options.vcRegion ? v.options?.regions?.includes(options.vcRegion) : true))[0] || least[0] || null
    }
    if (!this.node) throw new Error('No available Node was found, please add a RyanlinkNode to the Manager via Manager.NodeManager#createNode')

    if (typeof options.volume === 'number' && !isNaN(options.volume)) this.volume = Number(options.volume)

    this.volume = Math.round(Math.max(Math.min(this.volume, 1000), 0))

    this.internalVolume = Math.round(
      Math.max(
        Math.min(
          Math.round(
            this.RyanlinkManager.options.playerOptions.volumeDecrementer
              ? this.volume * this.RyanlinkManager.options.playerOptions.volumeDecrementer
              : this.volume
          ),
          1000
        ),
        0
      )
    )

    if (!dontEmitPlayerCreateEvent) this.RyanlinkManager.emit('playerCreate', this)

    this.queue = new Queue(this.guildId, {}, new QueueSaver(this.RyanlinkManager.options.queueOptions), this.RyanlinkManager.options.queueOptions)

    if (this.RyanlinkManager.options.resuming.enabled) {
      this.autoResume().catch(() => {})
    }
  }

  public async autoResume() {
    await this.queue.utils.sync(true, false)
    if (this.queue.current) {
      await this.play({
        clientTrack: this.queue.current,
        position: this.queue.position,
      })
    }
    return this
  }

  public set(key: string, value: unknown) {
    this.data[key] = value
    return this
  }

  public get<T>(key: string): T {
    return this.data[key] as T
  }

  public setData(key: string, value: unknown) {
    this.data[key] = value
    return this
  }

  public getData<T>(key: string): T {
    return this.data[key] as T
  }

  public deleteData(key: string) {
    if (key.startsWith('internal_')) return this
    delete this.data[key]
    return this
  }

  public clearData() {
    const toKeep = Object.keys(this.data).filter((v) => v.startsWith('internal_'))
    for (const key in this.data) {
      if (toKeep.includes(key)) continue
      delete this.data[key]
    }
    return this
  }

  public getAllData(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this.data).filter((v) => !v[0].startsWith('internal_')))
  }

  async play(options: Partial<PlayOptions> = {}) {
    if (this.getData('internal_queueempty')) {
      this.dispatchDebug(DebugEvents.PlayerPlayQueueEmptyTimeoutClear, {
        state: 'log',
        message: `Player was called to play something, while there was a queueEmpty Timeout set, clearing the timeout.`,
        functionLayer: 'Player > play()',
      })
      this.RyanlinkManager.emit('playerQueueEmptyCancel', this)
      clearTimeout(this.getData('internal_queueempty'))
      this.setData('internal_queueempty', undefined)
    }

    if (typeof options.startTime === 'number') options.position = options.startTime

    if (
      options?.clientTrack &&
      (this.RyanlinkManager.utils.isTrack(options?.clientTrack) || this.RyanlinkManager.utils.isUnresolvedTrack(options.clientTrack))
    ) {
      if (this.RyanlinkManager.utils.isUnresolvedTrack(options.clientTrack)) {
        try {
          await (options.clientTrack as UnresolvedTrack).resolve(this)
          this.resolveRetryCount = 0
        } catch (error) {
          this.resolveRetryCount++
          const limit = this.options.trackResolveRetryLimit || 3
          
          this.dispatchDebug(DebugEvents.PlayerPlayUnresolvedTrackFailed, {
            state: 'error',
            error: error,
            message: `Player Play failed to resolve track (Attempt ${this.resolveRetryCount}/${limit})`,
            functionLayer: 'Player > play() > resolve currentTrack',
          })

          if (this.resolveRetryCount >= limit) {
            this.resolveRetryCount = 0
            this.queue.tracks.shift() // Purge the failing track
            this.RyanlinkManager.emit('queueErrorReport', this, options.clientTrack as UnresolvedTrack, error)
            
            if (this.RyanlinkManager.options?.autoSkipOnResolveError === true && this.queue.tracks[0]) {
              return this.play(options)
            }
            return this
          }

          this.RyanlinkManager.emit('trackError', this, this.queue.current, error)

          if (options && 'clientTrack' in options) delete options.clientTrack
          if (options && 'track' in options) delete options.track

          if (this.RyanlinkManager.options?.autoSkipOnResolveError === true && this.queue.tracks[0]) return this.play(options)

          return this
        }
      }

      if ((typeof options.track?.userData === 'object' || typeof options.clientTrack?.userData === 'object') && options.clientTrack)
        options.clientTrack.userData = {
          ...(typeof options?.clientTrack?.requester === 'object'
            ? {
              requester: this.RyanlinkManager.utils.getTransformedRequester(options?.clientTrack?.requester || {}) as anyObject,
            }
            : {}),
          ...options?.clientTrack.userData,
          ...options.track?.userData,
        }

      options.track = {
        encoded: options.clientTrack?.encoded,
        requester: options.clientTrack?.requester,
        userData: options.clientTrack?.userData,
        audioTrackId: options.track?.audioTrackId ?? options.clientTrack?.audioTrackId,
      }
      if (options.track.audioTrackId && !this.node.isNodeLink()) {
        delete options.track.audioTrackId
      }
    }

    if (options?.track?.encoded || options?.track?.identifier) {
      this.queue.current = (options.clientTrack as Track) || null
      this.queue.utils.save()

      if (typeof options?.volume === 'number' && !isNaN(options?.volume)) {
        this.volume = Math.max(Math.min(options?.volume, 1000), 0)
        let vol = Number(this.volume)
        if (this.RyanlinkManager.options.playerOptions.volumeDecrementer) vol *= this.RyanlinkManager.options.playerOptions.volumeDecrementer
        this.internalVolume = Math.round(vol)
        options.volume = this.internalVolume
      }

      const track = Object.fromEntries(
        Object.entries({
          encoded: options.track.encoded,
          identifier: options.track.identifier,
          userData: {
            ...(typeof options?.track?.requester === 'object'
              ? {
                requester: this.RyanlinkManager.utils.getTransformedRequester(options?.track?.requester || {}),
              }
              : {}),
            ...options.track.userData,
          },
          audioTrackId: options.track.audioTrackId,
        }).filter((v) => typeof v[1] !== 'undefined')
      ) as PlayConfiguration['track']

      this.dispatchDebug(DebugEvents.PlayerPlayWithTrackReplace, {
        state: 'log',
        message: `Player was called to play something, with a specific track provided. Replacing the current Track and resolving the track on trackStart Event.`,
        functionLayer: 'Player > play()',
      })

      if (track.audioTrackId && !this.node.isNodeLink()) {
        delete track.audioTrackId
      }

      return this.node.updatePlayer({
        guildId: this.guildId,
        noReplace: false,
        playerOptions: Object.fromEntries(
          Object.entries({
            track,
            position: options.position ?? undefined,
            paused: options.paused ?? undefined,
            endTime: options?.endTime ?? undefined,
            filters: options?.filters ?? undefined,
            volume: options.volume ?? this.internalVolume ?? undefined,
            voice: options.voice ?? undefined,
          }).filter((v) => typeof v[1] !== 'undefined')
        ) as Partial<PlayConfiguration>,
      })
    }

    if (!this.queue.current && this.queue.tracks.length) await queueTrackEnd(this)

    if (this.queue.current && this.RyanlinkManager.utils.isUnresolvedTrack(this.queue.current)) {
      this.dispatchDebug(DebugEvents.PlayerPlayUnresolvedTrack, {
        state: 'log',
        message: `Player Play was called, current Queue Song is unresolved, resolving the track.`,
        functionLayer: 'Player > play()',
      })

      try {
        await (this.queue.current as unknown as UnresolvedTrack).resolve(this)

        if (typeof options.track?.userData === 'object' && this.queue.current)
          this.queue.current.userData = {
            ...(typeof this.queue.current?.requester === 'object'
              ? {
                requester: this.RyanlinkManager.utils.getTransformedRequester(this.queue.current?.requester || {}) as anyObject,
              }
              : {}),
            ...this.queue.current?.userData,
            ...options.track?.userData,
          }
      } catch (error) {
        this.dispatchDebug(DebugEvents.PlayerPlayUnresolvedTrackFailed, {
          state: 'error',
          error: error,
          message: `Player Play was called, current Queue Song is unresolved, but couldn't resolve it`,
          functionLayer: 'Player > play() > resolve currentTrack',
        })

        this.RyanlinkManager.emit('trackError', this, this.queue.current, error)

        if (options && 'clientTrack' in options) delete options.clientTrack
        if (options && 'track' in options) delete options.track

        await queueTrackEnd(this, true)

        if (this.RyanlinkManager.options?.autoSkipOnResolveError === true && this.queue.tracks[0]) return this.play(options)

        return this
      }
    }

    if (!this.queue.current) throw new Error(`There is no Track in the Queue, nor provided in the PlayOptions`)

    if (typeof options?.volume === 'number' && !isNaN(options?.volume)) {
      this.volume = Math.max(Math.min(options?.volume, 1000), 0)
      let vol = Number(this.volume)
      if (this.RyanlinkManager.options.playerOptions.volumeDecrementer) vol *= this.RyanlinkManager.options.playerOptions.volumeDecrementer
      this.internalVolume = Math.round(vol)
      options.volume = this.internalVolume
    }

    const finalOptions = Object.fromEntries(
      Object.entries({
        track: {
          encoded: this.queue.current?.encoded || null,

          userData: {
            ...(typeof this.queue.current?.requester === 'object'
              ? {
                requester: this.RyanlinkManager.utils.getTransformedRequester(this.queue.current?.requester || {}),
              }
              : {}),
            ...options?.track?.userData,
            ...this.queue.current?.userData,
          },
          audioTrackId: options?.track?.audioTrackId,
        },
        volume: this.internalVolume,
        position: options?.position ?? 0,
        endTime: options?.endTime ?? undefined,
        filters: options?.filters ?? undefined,
        paused: options?.paused ?? undefined,
        voice: options?.voice ?? undefined,
      }).filter((v) => typeof v[1] !== 'undefined')
    ) as Partial<PlayConfiguration>

    if (finalOptions.track.audioTrackId && !this.node.isNodeLink()) {
      delete finalOptions.track.audioTrackId
    }
    if (
      (typeof finalOptions.position !== 'undefined' && isNaN(finalOptions.position)) ||
      (typeof finalOptions.position === 'number' && finalOptions.position < 0) ||
      (typeof finalOptions.position === 'number' && this.queue.current.info.duration > 0 && finalOptions.position >= this.queue.current.info.duration)
    )
      throw new Error("PlayerOption#position must be a positive number, less than track's duration")
    if (
      (typeof finalOptions.volume !== 'undefined' && isNaN(finalOptions.volume)) ||
      (typeof finalOptions.volume === 'number' && finalOptions.volume < 0)
    )
      throw new Error('PlayerOption#volume must be a positive number')
    if (
      (typeof finalOptions.endTime !== 'undefined' && isNaN(finalOptions.endTime)) ||
      (typeof finalOptions.endTime === 'number' && finalOptions.endTime < 0) ||
      (typeof finalOptions.endTime === 'number' && this.queue.current.info.duration > 0 && finalOptions.endTime >= this.queue.current.info.duration)
    )
      throw new Error("PlayerOption#endTime must be a positive number, less than track's duration")
    if (typeof finalOptions.position === 'number' && typeof finalOptions.endTime === 'number' && finalOptions.endTime < finalOptions.position)
      throw new Error('PlayerOption#endTime must be bigger than PlayerOption#position')

    const now = performance.now()

    await this.node.updatePlayer({
      guildId: this.guildId,
      noReplace: options?.noReplace ?? false,
      playerOptions: finalOptions,
    })

    this.ping.node = Math.round((performance.now() - now) / 10) / 100
    return this
  }

  public oldJSON: PlayerJson = this.toJSON()

  public syncState() {
    this.RyanlinkManager.emit('playerClientUpdate', this.oldJSON, this)
    this.oldJSON = this.toJSON()

    if (this.filterManager.filterUpdatedState) {
      this.filterManager.filterUpdatedState = false
      if (this.queue.current && (this.queue.current.info.duration < (this.RyanlinkManager.options.advancedOptions?.maxFilterFixDuration || 600_000))) {
        this.seek(this.position)
      }
    }
  }

  async setVolume(volume: number, ignoreVolumeDecrementer: boolean = false) {
    volume = Number(volume)
    if (isNaN(volume)) throw new TypeError('Volume must be a number.')

    const targetVolume = Math.round(Math.max(Math.min(volume, 1000), 0))
    if (this.volume === targetVolume) return this

    const startVolume = this.volume
    const steps = 10
    const interval = 50 // 500ms total

    for (let i = 1; i <= steps; i++) {
      const currentVolume = Math.round(startVolume + (targetVolume - startVolume) * (i / steps))
      await this._setVolumeInternal(currentVolume, ignoreVolumeDecrementer)
      if (i < steps) await new Promise((resolve) => setTimeout(resolve, interval))
    }

    return this
  }

  private async _setVolumeInternal(volume: number, ignoreVolumeDecrementer: boolean = false) {
    this.volume = volume

    this.internalVolume = Math.round(
      Math.max(
        Math.min(
          Math.round(
            this.RyanlinkManager.options.playerOptions.volumeDecrementer && !ignoreVolumeDecrementer
              ? this.volume * this.RyanlinkManager.options.playerOptions.volumeDecrementer
              : this.volume
          ),
          1000
        ),
        0
      )
    )

    this.syncState()

    const now = performance.now()
    if (this.RyanlinkManager.options.playerOptions.applyVolumeAsFilter) {
      this.dispatchDebug(DebugEvents.PlayerVolumeAsFilter, {
        state: 'log',
        message: `Player Volume was set as a Filter, because RyanlinkManager option "playerOptions.applyVolumeAsFilter" is true`,
        functionLayer: 'Player > setVolume()',
      })
      await this.node.updatePlayer({
        guildId: this.guildId,
        playerOptions: { filters: { volume: this.internalVolume / 100 } },
      })
    } else {
      await this.node.updatePlayer({
        guildId: this.guildId,
        playerOptions: { volume: this.internalVolume },
      })
    }
    this.ping.node = Math.round((performance.now() - now) / 10) / 100
  }

  async audioSearch(query: AudioSearchQuery, requestUser: unknown, throwOnEmpty: boolean = false) {
    return this.node.audioSearch(query, requestUser, throwOnEmpty)
  }

  public async setSponsorBlock(segments: SponsorBlockSegment[] = ['sponsor', 'selfpromo']) {
    return this.node.setSponsorBlock(this, segments)
  }

  public async getSponsorBlock() {
    return this.node.getSponsorBlock(this)
  }

  public async deleteSponsorBlock() {
    return this.node.deleteSponsorBlock(this)
  }

  async search(query: SearchQuery, requestUser: unknown, throwOnEmpty: boolean = false) {
    const Query = this.RyanlinkManager.utils.transformQuery(query)

    if (['bcsearch', 'bandcamp'].includes(Query.source) && !this.node.info?.sourceManagers.includes('bandcamp')) {
      this.dispatchDebug(DebugEvents.BandcampSearchLokalEngine, {
        state: 'log',
        message: `Player.search was called with a Bandcamp Query, but no bandcamp search was enabled on the audio node, searching with the custom Search Engine.`,
        functionLayer: 'Player > search()',
      })
      return await this._bandCampSearch(Query.query, requestUser)
    }

    return this.node.search(Query, requestUser, throwOnEmpty)
  }

  private async _bandCampSearch(query: string, requestUser: unknown): Promise<UnresolvedSearchResult> {
    let error = null
    let tracks = []

    this.RyanlinkManager.utils.validateQueryString(this.node, query)

    try {
      const requestUrl = new URL('https://bandcamp.com/api/nusearch/2/autocomplete')
      requestUrl.searchParams.append('q', query)
      const data = await fetch(requestUrl.toString(), {
        headers: {
          'User-Agent': 'android-async-http/1.4.1 (http://loopj.com/android-async-http)',
          Cookie: '$Version=1',
        },
      })

      if (!data.ok) throw new Error(`Bandcamp Error: ${data.statusText}`)

      let json: null | { results: BandCampAutocompleteTrackObject[] } = null
      try {
        json = await data.json()
      } catch {
        throw new Error('Invalid JSON response from Bandcamp')
      }

      tracks =
        json?.results
          ?.filter((x) => !!x && typeof x === 'object' && 'type' in x && x.type === 't')
          .map?.((item) =>
            this.RyanlinkManager.utils.buildUnresolvedTrack(
              {
                uri: item.url || item.uri,
                artworkUrl: item.img,
                author: item.band_name,
                title: item.name,
                identifier: item.id ? `${item.id}` : item.url?.split('/')?.reverse()[0],
              },
              requestUser
            )
          ) || []
    } catch (e) {
      error = e
    }

    return {
      loadType: 'search',
      exception: error,
      pluginInfo: {},
      playlist: null,
      tracks: tracks,
    } as UnresolvedSearchResult
  }

  async pause() {
    this.paused = true
    this.lastPositionChange = null
    const now = performance.now()
    this.syncState()
    await this.node.updatePlayer({ guildId: this.guildId, playerOptions: { paused: true } })
    this.ping.node = Math.round((performance.now() - now) / 10) / 100

    this.RyanlinkManager.emit('playerPaused', this, this.queue.current)
    return this
  }

  async resume() {
    if (!this.paused) throw new Error("Player isn't paused - not able to resume.")
    this.paused = false
    const now = performance.now()
    this.syncState()
    await this.node.updatePlayer({ guildId: this.guildId, playerOptions: { paused: false } })
    this.ping.node = Math.round((performance.now() - now) / 10) / 100

    this.RyanlinkManager.emit('playerResumed', this, this.queue.current)
    return this
  }

  async seek(position: number) {
    if (!this.queue.current) return undefined

    position = Number(position)

    if (isNaN(position)) throw new RangeError('Position must be a number.')

    if (!this.queue.current.info.isSeekable || this.queue.current.info.isStream) throw new RangeError('Current Track is not seekable / a stream')

    if (position < 0 || position > this.queue.current.info.duration) position = Math.max(Math.min(position, this.queue.current.info.duration), 0)

    this.lastPositionChange = Date.now()
    this.lastPosition = position

    const now = performance.now()
    this.syncState()
    await this.node.updatePlayer({ guildId: this.guildId, playerOptions: { position } })
    this.ping.node = Math.round((performance.now() - now) / 10) / 100

    return this
  }

  async setRepeatMode(repeatMode: RepeatMode) {
    if (!['off', 'track', 'queue'].includes(repeatMode)) throw new RangeError("Repeatmode must be either 'off', 'track', or 'queue'")
    this.repeatMode = repeatMode
    this.syncState()
    return this
  }

  async skip(skipTo: number = 0, throwError: boolean = true) {
    if (!this.queue.tracks.length && (throwError || (typeof skipTo === 'boolean' && skipTo === true)))
      throw new RangeError("Can't skip more than the queue size")

    if (typeof skipTo === 'number' && skipTo > 1) {
      if (skipTo > this.queue.tracks.length) throw new RangeError("Can't skip more than the queue size")
      await this.queue.splice(0, skipTo - 1)
    }

    if (!this.playing && !this.queue.current) return (this.play(), this)

    const now = performance.now()
    this.setData('internal_skipped', true)

    await this.node.updatePlayer({
      guildId: this.guildId,
      playerOptions: { track: { encoded: null }, paused: false },
    })

    this.ping.node = Math.round((performance.now() - now) / 10) / 100

    return this
  }

  async stopPlaying(clearQueue: boolean = true, executeAutoplay: boolean = false) {
    this.setData('internal_stopPlaying', true)

    if (this.queue.tracks.length && clearQueue === true) await this.queue.splice(0, this.queue.tracks.length)

    if (executeAutoplay === false) this.setData('internal_autoplayStopPlaying', true)
    else this.setData('internal_autoplayStopPlaying', undefined)

    const now = performance.now()

    await this.node.updatePlayer({
      guildId: this.guildId,
      playerOptions: this.node.isNodeLink()
        ? {
          track: { encoded: null },

          nextTrack: { encoded: null },
        }
        : {
          track: { encoded: null },
        },
    })

    this.paused = false

    this.ping.node = Math.round((performance.now() - now) / 10) / 100

    return this
  }

  public async connect() {
    if (!this.options.voiceChannelId) throw new RangeError('No Voice Channel id has been set. (player.options.voiceChannelId)')

    await this.RyanlinkManager.options.sendToShard(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: this.options.voiceChannelId,
        self_mute: this.options.selfMute ?? false,
        self_deaf: this.options.selfDeaf ?? true,
      },
    })

    this.voiceChannelId = this.options.voiceChannelId

    return this
  }

  public async changeVoiceState(data: { voiceChannelId?: string; selfDeaf?: boolean; selfMute?: boolean }) {
    if (this.options.voiceChannelId === data.voiceChannelId) throw new RangeError("New Channel can't be equal to the old Channel.")

    await this.RyanlinkManager.options.sendToShard(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: data.voiceChannelId,
        self_mute: data.selfMute ?? this.options.selfMute ?? false,
        self_deaf: data.selfDeaf ?? this.options.selfDeaf ?? true,
      },
    })

    this.options.voiceChannelId = data.voiceChannelId
    this.options.selfMute = data.selfMute
    this.options.selfDeaf = data.selfDeaf

    this.voiceChannelId = data.voiceChannelId

    return this
  }

  public async disconnect(force: boolean = false) {
    if (!force && !this.options.voiceChannelId) throw new RangeError('No Voice Channel id has been set. (player.options.voiceChannelId)')

    await this.RyanlinkManager.options.sendToShard(this.guildId, {
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    })

    this.voiceChannelId = null

    return this
  }

  public async destroy(reason?: DestroyReasons | string, disconnect: boolean = true) {
    if (this.RyanlinkManager.options.advancedOptions?.debugOptions.playerDestroy.debugLog) {
      // Audio-Debug removed
    }

    if (this.getData('internal_queueempty')) {
      clearTimeout(this.getData('internal_queueempty'))
      this.setData('internal_queueempty', undefined)
    }

    if (this.getData('internal_destroystatus') === true) {
      this.dispatchDebug(DebugEvents.PlayerDestroyingSomewhereElse, {
        state: 'warn',
        message: `Player is already destroying somewhere else..`,
        functionLayer: 'Player > destroy()',
      })

      if (this.RyanlinkManager.options.advancedOptions?.debugOptions.playerDestroy.debugLog) {
        // Audio-Debug removed
      }
      return
    }
    this.setData('internal_destroystatus', true)

    if (disconnect) await this.disconnect(true)
    else this.setData('internal_destroywithoutdisconnect', true)

    await this.queue.utils.destroy()

    this.RyanlinkManager.deletePlayer(this.guildId)

    await this.node.destroyPlayer(this.guildId)

    if (this.RyanlinkManager.options.advancedOptions?.debugOptions.playerDestroy.debugLog) {
      // Audio-Debug removed
    }

    this.RyanlinkManager.emit('playerDestroy', this, reason)

    return this
  }

  public async getCurrentLyrics(skipTrackSource?: boolean) {
    return await this.node.lyrics.getCurrent(this.guildId, skipTrackSource)
  }

  public async getLyrics(track: Track, skipTrackSource?: boolean) {
    return await this.node.lyrics.get(track, skipTrackSource)
  }

  public subscribeLyrics(skipTrackSource?: boolean) {
    return this.node.lyrics.subscribe(this.guildId, skipTrackSource)
  }

  public unsubscribeLyrics() {
    return this.node.lyrics.unsubscribe(this.guildId)
  }

  public async changeNode(newNode: RyanlinkNode | string, checkSources: boolean = true) {
    const oldNode = this.node
    const updateNode = typeof newNode === 'string' ? this.RyanlinkManager.nodeManager.nodes.get(newNode) : newNode
    if (!updateNode) throw new Error('Could not find the new Node')
    if (!updateNode.connected) throw new Error('The provided Node is not active or disconnected')
    if (this.node.id === updateNode.id) throw new Error('Player is already on the provided Node')
    if (this.getData('internal_nodeChanging') === true) throw new Error('Player is already changing the node please wait')

    if (checkSources) {
      const isDefaultSource = (): boolean => {
        try {
          this.RyanlinkManager.utils.validateSourceString(updateNode, this.RyanlinkManager.options.playerOptions.defaultSearchPlatform)
          return true
        } catch {
          return false
        }
      }
      if (!isDefaultSource())
        throw new RangeError(
          `defaultSearchPlatform "${this.RyanlinkManager.options.playerOptions.defaultSearchPlatform}" is not supported by the newNode`
        )
      if (this.queue.current || this.queue.tracks.length) {
        const trackSources = new Set([this.queue.current, ...this.queue.tracks].map((track) => track.info.sourceName))
        const missingSources = [...trackSources].filter((source) => !updateNode.info?.sourceManagers.includes(source))
        if (updateNode._checkForSources && missingSources.length)
          throw new RangeError(`Sources missing for Node ${updateNode.id}: ${missingSources.join(', ')}`)
      }
    }

    this.dispatchDebug(DebugEvents.PlayerChangeNode, {
      state: 'log',
      message: `Player: ${this.guildId} changing node to: ${updateNode.id}`,
      functionLayer: 'Player > changeNode()',
    })

    const targetNode = updateNode
    if (typeof this.options.onNodeFailover === 'function') {
      try {
        this.options.onNodeFailover(this, oldNode, targetNode)
      } catch (e) {
        this.dispatchDebug(DebugEvents.PlayerChangeNode, {
          state: 'error',
          message: `Error in player.options.onNodeFailover: ${e.message}`,
          functionLayer: 'Player > changeNode() > onNodeFailover',
        })
      }
    }

    const data = this.toJSON()
    const currentTrack = this.queue.current
    if (!this.voice.endpoint || !this.voice.sessionId || !this.voice.token) throw new Error("Voice Data is missing, can't change the node")
    this.setData('internal_nodeChanging', true)
    if (this.node.connected) await this.node.destroyPlayer(this.guildId)
    this.node = updateNode
    const now = performance.now()
    try {
      await this.connect()
      const hasSponsorBlock = !this.node._checkForPlugins || this.node.info?.plugins?.find((v) => v.name === 'sponsorblock-plugin')
      if (hasSponsorBlock) {
        const sponsorBlockCategories = this.getData('internal_sponsorBlockCategories')
        if (Array.isArray(sponsorBlockCategories) && sponsorBlockCategories.length) {
          await this.setSponsorBlock(sponsorBlockCategories).catch((error) => {
            this.dispatchDebug(DebugEvents.PlayerChangeNode, {
              state: 'error',
              error: error,
              message: `Player > changeNode() Unable to set SponsorBlock Segments`,
              functionLayer: 'Player > changeNode()',
            })
          })
        } else if (this.RyanlinkManager.options?.playerOptions?.enforceSponsorBlockRequestForEventEnablement !== false) {
          await this.setSponsorBlock().catch((error) => {
            this.dispatchDebug(DebugEvents.PlayerChangeNode, {
              state: 'error',
              error: error,
              message: `Player > changeNode() Unable to set SponsorBlock Segments`,
              functionLayer: 'Player > changeNode()',
            })
          })
        }
      }
      await this.node.updatePlayer({
        guildId: this.guildId,
        noReplace: false,
        playerOptions: {
          ...(currentTrack && {
            track: currentTrack,
            position: data.lastPosition || 0,
            volume: this.internalVolume,
            paused: this.paused,
          }),
          voice: {
            token: this.voice.token,
            endpoint: this.voice.endpoint,
            sessionId: this.voice.sessionId,
            channelId: this.voice.channelId,
          },
        },
      })
      this.filterManager.applyPlayerFilters()
      this.ping.node = Math.round((performance.now() - now) / 10) / 100
      return this.node.id
    } catch (error) {
      this.dispatchDebug(DebugEvents.PlayerChangeNode, {
        state: 'error',
        error: error,
        message: `Player.changeNode() execution failed`,
        functionLayer: 'Player > changeNode()',
      })
      throw new Error(`Failed to change the node: ${error}`)
    } finally {
      this.setData('internal_nodeChanging', undefined)
    }
  }

  public async moveNode(node?: string) {
    try {
      if (!node) {
        const targetNode = Array.from(this.RyanlinkManager.nodeManager.leastUsedNodes('weighted')).find(
          (n) => n.connected && n.options.id !== this.node.options.id
        )
        if (!targetNode) throw new RangeError('No nodes are available.')
        node = targetNode.id
      }
      if (!node || !this.RyanlinkManager.nodeManager.nodes.get(node)) throw new RangeError('No nodes are available.')
      if (this.node.options.id === node) return this
      this.RyanlinkManager.emit('debug', DebugEvents.PlayerChangeNode, {
        state: 'log',
        message: `Player.moveNode() was executed, trying to move from "${this.node.id}" to "${node}"`,
        functionLayer: 'Player > moveNode()',
      })
      const updateNode = this.RyanlinkManager.nodeManager.nodes.get(node)
      if (!updateNode) throw new RangeError('No nodes are available.')
      return await this.changeNode(updateNode)
    } catch (error) {
      throw new Error(`Failed to move the node: ${error}`)
    }
  }

  public toJSON() {
    return {
      guildId: this.guildId,
      options: this.options,
      voiceChannelId: this.voiceChannelId,
      textChannelId: this.textChannelId,
      position: this.position,
      lastPosition: this.lastPosition,
      lastPositionChange: this.lastPositionChange,
      volume: this.volume,
      internalVolume: this.internalVolume,
      repeatMode: this.repeatMode,
      paused: this.paused,
      playing: this.playing,
      createdTimeStamp: this.createdTimeStamp,
      filters: this.filterManager?.data || {},
      equalizer: this.filterManager?.equalizerBands || [],
      nodeId: this.node?.id,
      nodeSessionId: this.node?.sessionId,
      ping: this.ping,
      queue: this.queue?.utils?.toJSON?.(),
      autoplay: this.autoplay,
      recentHistory: this.recentHistory,
    } as PlayerJson
  }
}

export class Autoplay {
  private static adding: Set<string> = new Set<string>()

  public static async defaultAutoplay(player: Player, lastTrack: Track): Promise<void> {
    if (!lastTrack) return

    const config: AutoplayConfig = player.RyanlinkManager.options.playerOptions.autoplayConfig

    if (!player.autoplay && config.enabled !== true) return

    if (Autoplay.adding.has(player.guildId)) return
    Autoplay.adding.add(player.guildId)

    try {
      const playedData = Autoplay.buildPlayedData(player)
      const relatedTracks = await Autoplay.fetchRelatedTracks(player, lastTrack, config, playedData)

      if (relatedTracks.length > 0) {
        for (const track of relatedTracks) {
          player.queue.add(track)
        }

        if (!player.playing && !player.paused && player.queue.tracks.length > 0) {
          await player.play()
        }
      }
    } catch (error) {
      player.RyanlinkManager.emit('debug', 'AutoplayError' as any, {
        state: 'error',
        message: `Autoplay failed: ${error.message}`,
        error,
        functionLayer: 'Autoplay > defaultAutoplay()',
      })
    } finally {
      Autoplay.adding.delete(player.guildId)
    }
  }

  private static buildPlayedData(player: Player) {
    const playedIds = new Set<string>()
    const playedTracks = new Set<string>()

    const addTrack = (track: Track) => {
      if (!track) return
      if (track.info.identifier) playedIds.add(track.info.identifier)
      if (track.info.isrc) playedIds.add(track.info.isrc)
      if (track.info.title && track.info.author) {
        const key = `${track.info.title.toLowerCase()}|${track.info.author.toLowerCase()}`
        playedTracks.add(key)
      }
    }

    if (player.queue.current) addTrack(player.queue.current)
    player.queue.previous.forEach(addTrack)
    player.queue.tracks.forEach(addTrack)

    player.recentHistory.forEach((id) => playedIds.add(id))

    return { playedIds, playedTracks }
  }

  private static async fetchRelatedTracks(
    player: Player,
    lastTrack: Track,
    config: AutoplayConfig,
    playedData: { playedIds: Set<string>; playedTracks: Set<string> }
  ): Promise<Track[]> {
    const tracks: Track[] = []
    const source = lastTrack.info.sourceName?.toLowerCase()

    if (source?.includes('spotify')) {
      const spotifyTracks = await this.getSpotifyRecommendations(player, lastTrack)
      tracks.push(...spotifyTracks)
    }

    if (tracks.length < (config.limit || 5) && (source?.includes('youtube') || source?.includes('yt'))) {
      const youtubeTracks = await this.getYouTubeSimilar(player, lastTrack)
      tracks.push(...youtubeTracks)
    }

    if (tracks.length === 0) {
      const searchTracks = await this.getArtistSearch(player, lastTrack, config.defaultSource || 'ytsearch')
      tracks.push(...searchTracks)
    }

    return this.filterTracks(lastTrack, tracks, playedData, config)
  }

  private static filterTracks(lastTrack: Track, tracks: Track[], playedData: { playedIds: Set<string>; playedTracks: Set<string> }, config: AutoplayConfig): Track[] {
    const excludeKeywords = config.excludeKeywords?.map((k) => k.toLowerCase()) || []

    return tracks
      .filter((track) => {
        if (playedData.playedIds.has(track.info.identifier)) return false
        if (track.info.isrc && playedData.playedIds.has(track.info.isrc)) return false

        const key = `${track.info.title.toLowerCase()}|${track.info.author.toLowerCase()}`
        if (playedData.playedTracks.has(key)) return false

        if (track.info.duration < (config.minDuration || 20000) || track.info.duration > (config.maxDuration || 900000)) {
          return false
        }

        const title = track.info.title.toLowerCase()
        if (excludeKeywords.some((keyword) => title.includes(keyword))) return false

        return true
      })
      .sort((a, b) => {
        const diffA = Math.abs(a.info.duration - lastTrack.info.duration)
        const diffB = Math.abs(b.info.duration - lastTrack.info.duration)
        return (diffA - diffB) + (Math.random() - 0.5) * 30000
      })
      .slice(0, config.limit || 5)
  }

  private static async getSpotifyRecommendations(player: Player, track: Track): Promise<Track[]> {
    try {
      const res = (await player.search({ query: `sprec:seed_tracks=${track.info.identifier}` }, 'Autoplay')) as any
      if (res.loadType === 'search' || res.loadType === 'track') return res.tracks as Track[]
      if (res.loadType === 'playlist') return res.tracks as Track[]
    } catch { }
    return []
  }

  private static async getYouTubeSimilar(player: Player, track: Track): Promise<Track[]> {
    try {
      const res = (await player.search({ query: `https://www.youtube.com/watch?v=${track.info.identifier}` }, 'Autoplay')) as any
      if (res.loadType === 'playlist') return res.tracks as Track[]
    } catch { }
    return []
  }

  private static async getArtistSearch(player: Player, track: Track, source: string): Promise<Track[]> {
    try {
      const res = (await player.search({ query: track.info.author, source: source as any }, 'Autoplay')) as any
      if (res.loadType === 'search' || res.loadType === 'track') return res.tracks as Track[]
    } catch { }
    return []
  }
}
