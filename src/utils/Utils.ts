import { URL } from 'node:url'
import { isRegExp } from 'node:util/types'

import { DebugEvents } from '../config/Constants'
import type { RyanlinkManager } from '../core/Manager'
import { SourceMappings, BuiltinSources, LinkMatchers } from '../node/Sources'
import type { RyanlinkNode } from '../node/Node'
import type { Player } from '../audio/Player'
import type { NodeConfiguration, NodeTypes } from '../types/Node'
import type { AudioTrack, Track, UnresolvedQuery, UnresolvedTrack } from '../types/Track'
import type { RyanlinkSearchPlatform, AudioSearchQuery, MiniMapConstructor, SearchPlatform, SearchQuery, SearchResult } from '../types/Utils'
import { TrackEntry } from './TrackRegistry'
export const AudioTrackSymbol = Symbol('Ryanlink-Track')
export const UnresolvedAudioTrackSymbol = Symbol('Ryanlink-Track-Unresolved')
export const AudioQueueSymbol = Symbol('Ryanlink-Queue')
export const AudioNodeSymbol = Symbol('Ryanlink-Node')
export const ManagerSymbol = Symbol('Ryanlink-Manager-Internal')
export const NodeManagerSymbol = Symbol('Ryanlink-NodeManager-Internal')
export const NodeSymbol = Symbol('Ryanlink-Node-Internal')
export const PlayerSymbol = Symbol('Ryanlink-Player-Internal')

const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseConnectionUrl(connectionUrl: string) {
  if (!connectionUrl.startsWith('ryanlink://') && !connectionUrl.startsWith('nodelink://'))
    throw new Error(`ConnectionUrl (${connectionUrl}) must start with 'ryanlink://' or 'nodelink://'`)
  const parsed = new URL(connectionUrl.replace(/^ryanlink:\/\//, 'https://').replace(/^nodelink:\/\//, 'https://'))
  return {
    authorization: parsed.password,
    nodeType: (connectionUrl.startsWith('ryanlink://') ? 'Core' : 'NodeLink') as NodeTypes,
    id: parsed.username,
    host: parsed.hostname,
    port: Number(parsed.port),
  }
}

export class RyanlinkUtils {
  public get RyanlinkManager(): RyanlinkManager | undefined {
    return (this as any)[ManagerSymbol]
  }
  constructor(RyanlinkManager?: RyanlinkManager) {
    if (RyanlinkManager) (this as any)[ManagerSymbol] = RyanlinkManager
  }

  buildPluginInfo(data: any, clientData: any = {}) {
    return {
      clientData: clientData,
      ...(data.pluginInfo || (data as any).plugin),
    }
  }

  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  buildTrack(data: AudioTrack | Track, requester: unknown) {
    if (!data?.encoded || typeof data.encoded !== 'string') throw new RangeError("Argument 'data.encoded' must be present.")
    if (!data.info) throw new RangeError("Argument 'data.info' must be present.")
    try {
      let transformedRequester = typeof requester === 'object' ? this.getTransformedRequester(requester) : undefined

      if (!transformedRequester && typeof data?.userData?.requester === 'object' && data.userData.requester !== null) {
        transformedRequester = this.getTransformedRequester(data.userData.requester)
      }

      const baseTrack = {
        encoded: data.encoded,
        info: {
          identifier: data.info.identifier,
          title: data.info.title,
          author: data.info.author,
          duration: (data as Track).info?.duration || (data as AudioTrack).info?.length,
          artworkUrl: data.info.artworkUrl || data.pluginInfo?.artworkUrl || (data as any).plugin?.artworkUrl,
          uri: data.info.uri,
          sourceName: data.info.sourceName,
          isSeekable: data.info.isSeekable,
          isStream: data.info.isStream,
          isrc: data.info.isrc,
        },
        userData: {
          ...data.userData,
          requester: transformedRequester,
        },
        pluginInfo: this.buildPluginInfo(data, 'clientData' in data ? data.clientData : {}),
        requester: transformedRequester || this.getTransformedRequester(this.RyanlinkManager?.options?.client),
      } as Track

      const r = new TrackEntry(baseTrack)
      Object.defineProperty(r, AudioTrackSymbol, { configurable: true, value: true })
      return r
    } catch (error) {
      if (this.RyanlinkManager?.options?.advancedOptions?.enableDebugEvents) {
        this.RyanlinkManager?.emit('debug', DebugEvents.BuildTrackError, {
          error: error,
          functionLayer: 'RyanlinkUtils > buildTrack()',
          message: 'Error while building track',
          state: 'error',
        })
      }
      throw new RangeError(`Argument "data" is not a valid track: ${error.message}`)
    }
  }

  buildUnresolvedTrack(query: UnresolvedQuery | UnresolvedTrack, requester: unknown) {
    if (typeof query === 'undefined') throw new RangeError('Argument "query" must be present.')

    const unresolvedTrack: UnresolvedTrack = {
      encoded: query.encoded || undefined,
      info: (query as UnresolvedTrack).info
        ? (query as UnresolvedTrack).info
        : (query as UnresolvedQuery).title
          ? (query as UnresolvedQuery)
          : undefined,
      pluginInfo: this.buildPluginInfo(query),
      requester: this.getTransformedRequester(requester),
      async resolve(player: Player) {
        const closest = await getClosestTrack(this, player)
        if (!closest) throw new SyntaxError('No closest Track found')

        for (const prop of Object.getOwnPropertyNames(this)) delete this[prop]

        delete this[UnresolvedAudioTrackSymbol]

        Object.defineProperty(this, AudioTrackSymbol, { configurable: true, value: true })

        return Object.assign(this, closest)
      },
    }

    if (!this.isUnresolvedTrack(unresolvedTrack)) throw SyntaxError('Could not build Unresolved Track')

    Object.defineProperty(unresolvedTrack, UnresolvedAudioTrackSymbol, {
      configurable: true,
      value: true,
    })
    return unresolvedTrack as UnresolvedTrack
  }

  isNode(data: RyanlinkNode) {
    if (!data) return false
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(data))
    if (!keys.includes('constructor')) return false
    if (!keys.length) return false

    if (
      ![
        'connect',
        'destroy',
        'destroyPlayer',
        'fetchAllPlayers',
        'fetchInfo',
        'fetchPlayer',
        'fetchStats',
        'fetchVersion',
        'request',
        'updatePlayer',
        'updateSession',
      ].every((v) => keys.includes(v))
    )
      return false
    return true
  }

  getTransformedRequester(requester: unknown) {
    try {
      return typeof this.RyanlinkManager?.options?.playerOptions?.requesterTransformer === 'function'
        ? this.RyanlinkManager?.options?.playerOptions?.requesterTransformer(requester)
        : requester
    } catch (e) {
      if (this.RyanlinkManager?.options?.advancedOptions?.enableDebugEvents) {
        this.RyanlinkManager?.emit('debug', DebugEvents.TransformRequesterFunctionFailed, {
          error: e,
          functionLayer: 'RyanlinkUtils > getTransformedRequester()',
          message: 'Your custom transformRequesterFunction failed to execute, please check your function for errors.',
          state: 'error',
        })
      }
      return requester
    }
  }

  isNodeOptions(data: NodeConfiguration) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false
    if (typeof data.host !== 'string' || !data.host.length) return false
    if (typeof data.port !== 'number' || isNaN(data.port) || data.port < 0 || data.port > 65535) return false
    if (typeof data.authorization !== 'string' || !data.authorization.length) return false
    if ('secure' in data && typeof data.secure !== 'boolean' && data.secure !== undefined) return false
    if ('sessionId' in data && typeof data.sessionId !== 'string' && data.sessionId !== undefined) return false
    if ('id' in data && typeof data.id !== 'string' && data.id !== undefined) return false
    if ('regions' in data && (!Array.isArray(data.regions) || (!data.regions.every((v) => typeof v === 'string') && data.regions !== undefined)))
      return false
    if ('poolOptions' in data && typeof data.poolOptions !== 'object' && data.poolOptions !== undefined) return false
    if (
      'retryAmount' in data &&
      (typeof data.retryAmount !== 'number' || isNaN(data.retryAmount) || (data.retryAmount <= 0 && data.retryAmount !== undefined))
    )
      return false
    if (
      'retryDelay' in data &&
      (typeof data.retryDelay !== 'number' || isNaN(data.retryDelay) || (data.retryDelay <= 0 && data.retryDelay !== undefined))
    )
      return false
    if (
      'requestTimeout' in data &&
      (typeof data.requestTimeout !== 'number' || isNaN(data.requestTimeout) || (data.requestTimeout <= 0 && data.requestTimeout !== undefined))
    )
      return false
    return true
  }

  isNotBrokenTrack(data: Track | UnresolvedTrack, minDuration = 29e3): data is Track {
    if (typeof data?.info?.duration !== 'number' || isNaN(data?.info?.duration)) return false
    if (data.info.duration <= Math.max(minDuration, 0)) return false

    if (!data.info) return false

    return this.isTrack(data)
  }

  isTrack(data: Track | UnresolvedTrack): data is Track {
    if (!data) return false
    if (data[AudioTrackSymbol] === true) return true
    return typeof data?.encoded === 'string' && typeof data?.info === 'object' && !('resolve' in data)
  }

  isUnresolvedTrack(data: UnresolvedTrack | Track): data is UnresolvedTrack {
    if (!data) return false
    if (data[UnresolvedAudioTrackSymbol] === true) return true
    return (
      typeof data === 'object' &&
      (('info' in data && typeof data.info.title === 'string') || typeof data.encoded === 'string') &&
      'resolve' in data &&
      typeof data.resolve === 'function'
    )
  }

  isUnresolvedTrackQuery(data: UnresolvedQuery): boolean {
    return typeof data === 'object' && !('info' in data) && typeof data.title === 'string'
  }

  async getClosestTrack(data: UnresolvedTrack, player: Player): Promise<Track | undefined> {
    try {
      return getClosestTrack(data, player)
    } catch (e) {
      if (this.RyanlinkManager?.options?.advancedOptions?.enableDebugEvents) {
        this.RyanlinkManager?.emit('debug', DebugEvents.GetClosestTrackFailed, {
          error: e,
          functionLayer: 'RyanlinkUtils > getClosestTrack()',
          message: 'Failed to resolve track because the getClosestTrack function failed.',
          state: 'error',
        })
      }
      throw e
    }
  }

  validateQueryString(node: RyanlinkNode, queryString: string, sourceString?: SearchPlatform): void {
    if (!node.info) throw new Error('No Audio Node was provided')
    if (node._checkForSources && !node.info.sourceManagers?.length) throw new Error('Audio Node, has no sourceManagers enabled')

    if (!queryString.trim().length) throw new Error(`Query string is empty, please provide a valid query string.`)

    if (sourceString === 'speak' && queryString.length > 100) throw new Error(`Query is speak, which is limited to 100 characters.`)

    if (this.RyanlinkManager.options?.linksBlacklist?.length > 0) {
      if (this.RyanlinkManager.options?.advancedOptions?.enableDebugEvents) {
        this.RyanlinkManager.emit('debug', DebugEvents.ValidatingBlacklistLinks, {
          state: 'log',
          message: `Validating Query against RyanlinkManager.options.linksBlacklist, query: "${queryString}"`,
          functionLayer: '(RyanlinkNode > node | player) > search() > validateQueryString()',
        })
      }
      if (
        this.RyanlinkManager.options?.linksBlacklist.some(
          (v) => (typeof v === 'string' && queryString.toLowerCase().includes(v.toLowerCase())) || (isRegExp(v) && v.test(queryString))
        )
      ) {
        throw new Error(`Query string contains a link / word which is blacklisted.`)
      }
    }

    if (/^https?:\/\//.test(queryString) && this.RyanlinkManager.options?.linksAllowed === false)
      throw new Error('Using links to make a request is not allowed.')

    if (this.RyanlinkManager.options?.linksWhitelist?.length > 0) {
      if (this.RyanlinkManager.options?.advancedOptions?.enableDebugEvents) {
        this.RyanlinkManager.emit('debug', DebugEvents.ValidatingWhitelistLinks, {
          state: 'log',
          message: `Link was provided to the Query, validating against RyanlinkManager.options.linksWhitelist, query: "${queryString}"`,
          functionLayer: '(RyanlinkNode > node | player) > search() > validateQueryString()',
        })
      }
      if (
        !this.RyanlinkManager.options?.linksWhitelist.some(
          (v) => (typeof v === 'string' && queryString.toLowerCase().includes(v.toLowerCase())) || (isRegExp(v) && v.test(queryString))
        )
      ) {
        throw new Error(`Query string contains a link / word which isn't whitelisted.`)
      }
    }

    if (!node._checkForSources) return

    if (
      (LinkMatchers.YoutubeMusicRegex.test(queryString) || LinkMatchers.YoutubeRegex.test(queryString)) &&
      !node.info?.sourceManagers?.includes('youtube')
    ) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'youtube' enabled")
    }
    if (
      (LinkMatchers.SoundCloudMobileRegex.test(queryString) || LinkMatchers.SoundCloudRegex.test(queryString)) &&
      !node.info?.sourceManagers?.includes('soundcloud')
    ) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'soundcloud' enabled")
    }
    if (LinkMatchers.bandcamp.test(queryString) && !node.info?.sourceManagers?.includes('bandcamp')) {
      throw new Error(
        "Query / Link Provided for this Source but Audio Node has not 'bandcamp' enabled (introduced with audio-engine 2.2.0+)"
      )
    }
    if (LinkMatchers.TwitchTv.test(queryString) && !node.info?.sourceManagers?.includes('twitch')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'twitch' enabled")
    }
    if (LinkMatchers.vimeo.test(queryString) && !node.info?.sourceManagers?.includes('vimeo')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'vimeo' enabled")
    }
    if (LinkMatchers.tiktok.test(queryString) && !node.info?.sourceManagers?.includes('tiktok')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'tiktok' enabled")
    }
    if (LinkMatchers.mixcloud.test(queryString) && !node.info?.sourceManagers?.includes('mixcloud')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'mixcloud' enabled")
    }
    if (LinkMatchers.AllSpotifyRegex.test(queryString) && !node.info?.sourceManagers?.includes('spotify')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'spotify' enabled")
    }
    if (LinkMatchers.appleMusic.test(queryString) && !node.info?.sourceManagers?.includes('applemusic')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'applemusic' enabled")
    }
    if (LinkMatchers.AllDeezerRegex.test(queryString) && !node.info?.sourceManagers?.includes('deezer')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'deezer' enabled")
    }
    if (LinkMatchers.musicYandex.test(queryString) && !node.info?.sourceManagers?.includes('yandexmusic')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'yandexmusic' enabled")
    }
    if (LinkMatchers.jiosaavn.test(queryString) && !node.info?.sourceManagers?.includes('jiosaavn')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'jiosaavn' enabled")
    }
    if (LinkMatchers.tidal.test(queryString) && !node.info?.sourceManagers?.includes('tidal')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'tidal' enabled")
    }
    if (LinkMatchers.AllPandoraRegex.test(queryString) && !node.info?.sourceManagers?.includes('pandora')) {
      throw new Error("Query / Link Provided for this Source but Audio Node has not 'pandora' enabled")
    }
    return
  }

  findSourceOfQuery(queryString: string) {
    const foundSource = Object.keys(SourceMappings)
      .find((source) => queryString?.toLowerCase?.()?.startsWith(`${source}:`.toLowerCase()))
      ?.trim?.()
      ?.toLowerCase?.() as SearchPlatform | undefined

    if (foundSource && !['https', 'http'].includes(foundSource) && SourceMappings[foundSource]) {
      return foundSource
    }
    return null
  }

  extractSourceOfQuery<T extends { query: string; source?: string }>(searchQuery: T): T {
    const foundSource = this.findSourceOfQuery(searchQuery.query)

    if (foundSource) {
      searchQuery.source = SourceMappings[foundSource]
      searchQuery.query = searchQuery.query.slice(`${foundSource}:`.length, searchQuery.query.length)
    }
    return searchQuery
  }

  typedLowerCase<T extends unknown>(input: T) {
    if (!input) return input
    if (typeof input === 'string') return input.toLowerCase() as unknown as T
    return input
  }

  transformQuery(query: SearchQuery) {
    const typedDefault = this.typedLowerCase(this.RyanlinkManager?.options?.playerOptions?.defaultSearchPlatform)
    if (typeof query === 'string') {
      const Query = {
        query: query,
        extraQueryUrlParams: undefined,
        source: typedDefault,
      }
      return this.extractSourceOfQuery(Query)
    }
    const providedSource = query?.source?.trim?.()?.toLowerCase?.() as RyanlinkSearchPlatform | undefined
    const validSourceExtracted = SourceMappings[providedSource ?? typedDefault]
    return this.extractSourceOfQuery({
      query: query.query,
      extraQueryUrlParams: query.extraQueryUrlParams,
      source: validSourceExtracted ?? providedSource ?? typedDefault,
    })
  }

  transformAudioSearchQuery(query: AudioSearchQuery) {
    const typedDefault = this.typedLowerCase(this.RyanlinkManager?.options?.playerOptions?.defaultSearchPlatform)
    if (typeof query === 'string') {
      const Query = {
        query: query,
        types: [],
        extraQueryUrlParams: undefined,
        source: typedDefault,
      }
      return this.extractSourceOfQuery(Query)
    }
    const providedSource = query?.source?.trim?.()?.toLowerCase?.() as RyanlinkSearchPlatform | undefined
    const validSourceExtracted = SourceMappings[providedSource ?? typedDefault]

    const Query = {
      query: query.query,
      types: query.types
        ? ['track', 'playlist', 'artist', 'album', 'text'].filter((v) => query.types?.find((x) => x.toLowerCase().startsWith(v)))
        : ['track', 'playlist', 'artist', 'album'],
      source: validSourceExtracted ?? providedSource ?? typedDefault,
    }

    return this.extractSourceOfQuery(Query)
  }

  validateSourceString(node: RyanlinkNode, sourceString: SearchPlatform) {
    if (!sourceString) throw new Error(`No SourceString was provided`)
    const source = SourceMappings[sourceString.toLowerCase().trim()] as RyanlinkSearchPlatform
    if (!source && !!this.RyanlinkManager.options.playerOptions.allowCustomSources)
      throw new Error(
        `Ryanlink does not support SearchQuerySource: '${sourceString}'. You can disable this check by setting 'ManagerOptions.PlayerOptions.allowCustomSources' to true`
      )

    if (!node.info) throw new Error('Audio Node does not have any info cached yet, not ready yet!')

    if (!node._checkForSources) return

    const lavaSrcSources = [
      'spsearch', 'sprec',           
      'amsearch',                     
      'dzsearch', 'dzisrc', 'dzrec', 
      'ymsearch', 'ymrec',           
      'vksearch', 'vkrec',           
      'tdsearch', 'tdrec',           
      'jssearch', 'jsrec',           
      'admsearch', 'admrec',         
      'shsearch',                    
      'lfsearch',                    
      'amzsearch', 'amzrec',         
      'gnsearch', 'gnrec',           
      'qbsearch', 'qbisrc', 'qbrec', 
      'pdsearch', 'pdisrc', 'pdrec', 
    ]
    if (lavaSrcSources.includes(source) && node._checkForPlugins) {
      const hasLavaSrc = node.info?.plugins?.some((p) =>
        p.name === 'lavasrc-plugin' || p.name.toLowerCase().includes('lavasrc')
      )
      if (!hasLavaSrc)
        throw new Error(`Audio Node requires 'lavasrc-plugin' for source '${source}'`)
    }

    if (source === 'amsearch' && !node.info?.sourceManagers?.includes('applemusic')) {
      throw new Error("Audio Node has not 'applemusic' enabled, which is required to have 'amsearch' work")
    }
    if ((source === 'dzisrc' || source === 'dzsearch' || source === 'dzrec') && !node.info?.sourceManagers?.includes('deezer')) {
      throw new Error("Audio Node has not 'deezer' enabled, which is required to have '" + source + "' work")
    }
    if (source === 'dzisrc' && node.info?.sourceManagers?.includes('deezer') && !node.info?.sourceManagers?.includes('http')) {
      throw new Error("Audio Node has not 'http' enabled, which is required to have 'dzisrc' to work")
    }
    if ((source === 'jsrec' || source === 'jssearch') && !node.info?.sourceManagers?.includes('jiosaavn')) {
      throw new Error("Audio Node has not 'jiosaavn' enabled, which is required to have '" + source + "' work")
    }
    if (source === 'scsearch' && !node.info?.sourceManagers?.includes('soundcloud')) {
      throw new Error("Audio Node has not 'soundcloud' enabled, which is required to have 'scsearch' work")
    }
    if ((source === 'tdsearch' || source === 'tdrec') && !node.info?.sourceManagers?.includes('tidal')) {
      throw new Error("Audio Node has not 'tidal' enabled, which is required to have '" + source + "' work")
    }
    if ((source === 'ymsearch' || source === 'ymrec') && !node.info?.sourceManagers?.includes('yandexmusic')) {
      throw new Error("Audio Node has not 'yandexmusic' enabled, which is required to have '" + source + "' work")
    }
    if ((source === 'ytmsearch' || source === 'ytsearch') && !node.info?.sourceManagers?.includes('youtube')) {
      throw new Error("Audio Node has not 'youtube' enabled, which is required to have '" + source + "' work")
    }
    if ((source === 'vksearch' || source === 'vkrec') && !node.info?.sourceManagers?.includes('vkmusic')) {
      throw new Error("Audio Node has not 'vkmusic' enabled, which is required to have '" + source + "' work")
    }
    if ((source === 'qbsearch' || source === 'qbisrc' || source === 'qbrec') && !node.info?.sourceManagers?.includes('qobuz')) {
      throw new Error("Audio Node has not 'qobuz' enabled, which is required to have '" + source + "' work")
    }
    if ((source === 'pdsearch' || source === 'pdisrc' || source === 'pdrec') && !node.info?.sourceManagers?.includes('pandora')) {
      throw new Error("Audio Node has not 'pandora' enabled, which is required to have '" + source + "' work")
    }

    if (
      source === 'speak' &&
      node._checkForPlugins &&
      !node.info?.plugins?.find((c) =>
        c.name === 'skybot-lavalink-plugin' ||
        c.name.toLowerCase().includes(BuiltinSources.DuncteBot_Plugin.toLowerCase())
      )
    ) {
      throw new Error("Audio Node has not 'speak' enabled — requires 'skybot-lavalink-plugin'")
    }
    if (
      source === 'phsearch' &&
      node._checkForPlugins &&
      !node.info?.plugins?.find((c) => c.name === 'skybot-lavalink-plugin')
    ) {
      throw new Error("Audio Node has not 'phsearch' enabled — requires 'skybot-lavalink-plugin'")
    }
    if (
      source === 'tts' &&
      node._checkForPlugins &&
      !node.info?.plugins?.find((c) =>
        c.name === 'tts-plugin' ||
        c.name.toLowerCase().includes(BuiltinSources.GoogleCloudTTS.toLowerCase())
      )
    ) {
      throw new Error("Audio Node has not 'tts' enabled — requires 'tts-plugin'")
    }
    if (
      source === 'ftts' &&
      !(
        node.info?.sourceManagers?.includes('ftts') ||
        node.info?.sourceManagers?.includes('flowery-tts') ||
        node.info?.sourceManagers?.includes('flowerytts')
      )
    ) {
      throw new Error("Audio Node has not 'flowery-tts' enabled, which is required to have 'ftts' work")
    }

    return
  }
}

export interface MiniMap<K, V> extends Map<K, V> {
  constructor: MiniMapConstructor
}

export class MiniMap<K, V> extends Map<K, V> {
  constructor(data: [K, V][] = []) {
    super(data)
  }

  public filter<K2 extends K>(fn: (value: V, key: K, miniMap: this) => key is K2): MiniMap<K2, V>
  public filter<V2 extends V>(fn: (value: V, key: K, miniMap: this) => value is V2): MiniMap<K, V2>
  public filter(fn: (value: V, key: K, miniMap: this) => boolean): MiniMap<K, V>
  public filter<This, K2 extends K>(fn: (this: This, value: V, key: K, miniMap: this) => key is K2, thisArg: This): MiniMap<K2, V>
  public filter<This, V2 extends V>(fn: (this: This, value: V, key: K, miniMap: this) => value is V2, thisArg: This): MiniMap<K, V2>
  public filter<This>(fn: (this: This, value: V, key: K, miniMap: this) => boolean, thisArg: This): MiniMap<K, V>
  public filter(fn: (value: V, key: K, miniMap: this) => boolean, thisArg?: unknown): MiniMap<K, V> {
    if (typeof thisArg !== 'undefined') fn = fn.bind(thisArg)
    const results = new this.constructor[Symbol.species]<K, V>()
    for (const [key, val] of this) {
      if (fn(val, key, this)) results.set(key, val)
    }
    return results
  }

  public toJSON() {
    return [...this.entries()]
  }

  public map<T>(fn: (value: V, key: K, miniMap: this) => T): T[]
  public map<This, T>(fn: (this: This, value: V, key: K, miniMap: this) => T, thisArg: This): T[]
  public map<T>(fn: (value: V, key: K, miniMap: this) => T, thisArg?: unknown): T[] {
    if (typeof thisArg !== 'undefined') fn = fn.bind(thisArg)
    const iter = this.entries()
    return Array.from({ length: this.size }, (): T => {
      const [key, value] = iter.next().value

      return fn(value, key, this)
    })
  }
}

export async function queueTrackEnd(player: Player, dontShiftQueue: boolean = false) {
  if (player.queue.current && !player.queue.current?.pluginInfo?.clientData?.previousTrack) {
    player.queue.previous.unshift(player.queue.current)
    if (player.queue.previous.length > player.queue.options.maxPreviousTracks)
      player.queue.previous.splice(player.queue.options.maxPreviousTracks, player.queue.previous.length)

    const trackId = player.queue.current.info.isrc || player.queue.current.info.identifier
    if (trackId && !player.recentHistory.includes(trackId)) {
      player.recentHistory.unshift(trackId)
      if (player.recentHistory.length > player.recentHistoryLimit) {
        player.recentHistory.splice(player.recentHistoryLimit, player.recentHistory.length)
      }
    }

    await player.queue.utils.save()
  }

  if (player.repeatMode === 'queue' && player.queue.current) player.queue.tracks.push(player.queue.current)

  const nextSong = dontShiftQueue ? null : (player.queue.tracks.shift() as Track)

  try {
    if (nextSong && player.RyanlinkManager.utils.isUnresolvedTrack(nextSong)) await (nextSong as UnresolvedTrack).resolve(player)

    player.queue.current = nextSong || null

    await player.queue.utils.save()
  } catch (error) {
    if (player.RyanlinkManager.options?.advancedOptions?.enableDebugEvents) {
      player.RyanlinkManager.emit('debug', DebugEvents.PlayerPlayUnresolvedTrackFailed, {
        state: 'error',
        error: error,
        message: `queueTrackEnd Util was called, tried to resolve the next track, but failed to find the closest matching song`,
        functionLayer: 'Player > play() > resolve currentTrack',
      })
    }

    player.RyanlinkManager.emit('trackError', player, player.queue.current, error)

    if (!dontShiftQueue && player.RyanlinkManager.options?.autoSkipOnResolveError === true && player.queue.tracks[0]) return queueTrackEnd(player)
  }

  return player.queue.current
}

export async function applyUnresolvedData(resTrack: Track, data: UnresolvedTrack, utils: RyanlinkUtils) {
  if (!resTrack?.info || !data?.info) return
  if (data.info.uri) resTrack.info.uri = data.info.uri
  if (utils?.RyanlinkManager?.options?.playerOptions?.useUnresolvedData === true) {
    if (data.info.artworkUrl?.length) resTrack.info.artworkUrl = data.info.artworkUrl
    if (data.info.title?.length) resTrack.info.title = data.info.title
    if (data.info.author?.length) resTrack.info.author = data.info.author
  } else {
    if ((resTrack.info.title === 'Unknown title' || resTrack.info.title === 'Unspecified description') && resTrack.info.title != data.info.title)
      resTrack.info.title = data.info.title
    if (resTrack.info.author !== data.info.author) resTrack.info.author = data.info.author
    if (resTrack.info.artworkUrl !== data.info.artworkUrl) resTrack.info.artworkUrl = data.info.artworkUrl
  }
  for (const key of Object.keys(data.info))
    if (typeof resTrack.info[key] === 'undefined' && key !== 'resolve' && data.info[key]) resTrack.info[key] = data.info[key]
  return resTrack
}

async function getClosestTrack(data: UnresolvedTrack, player: Player): Promise<Track | undefined> {
  if (!player || !player.node) throw new RangeError('No player with a ryanlink node was provided')
  if (player.RyanlinkManager.utils.isTrack(data)) return player.RyanlinkManager.utils.buildTrack(data, data.requester)
  if (!player.RyanlinkManager.utils.isUnresolvedTrack(data)) throw new RangeError('Track is not an unresolved Track')
  if (!data?.info?.title && typeof data.encoded !== 'string' && !data.info.uri)
    throw new SyntaxError('the track uri / title / encoded Base64 string is required for unresolved tracks')
  if (!data.requester) throw new SyntaxError('The requester is required')

  if (typeof data.encoded === 'string') {
    const r = await player.node.decode.singleTrack(data.encoded, data.requester)
    if (r) return applyUnresolvedData(r, data, player.RyanlinkManager.utils)
  }

  if (typeof data.info.uri === 'string') {
    const r = await player.search({ query: data?.info?.uri }, data.requester).then((v) => v.tracks?.[0] as Track | undefined)
    if (r) return applyUnresolvedData(r, data, player.RyanlinkManager.utils)
  }

  const query = [data.info?.title, data.info?.author].filter((str) => !!str).join(' by ')
  const sourceName = data.info?.sourceName

  return await player
    .search(
      {
        query,
        source:
          sourceName !== 'twitch' && sourceName !== 'flowery-tts' ? sourceName : player.RyanlinkManager.options?.playerOptions?.defaultSearchPlatform,
      },
      data.requester
    )
    .then((res: SearchResult) => {
      let trackToUse = null

      if ((data.info?.title || data.info?.author) && !trackToUse)
        trackToUse = res.tracks.find(
          (track) =>
            [data.info?.author || '', `${data.info?.author} - Topic`].some((name) =>
              new RegExp(`^${escapeRegExp(name)}$`, 'i').test(track.info?.author)
            ) || new RegExp(`^${escapeRegExp(data.info?.title)}$`, 'i').test(track.info?.title)
        )

      if (data.info?.isrc && !trackToUse) trackToUse = res.tracks.find((track) => track.info?.isrc === data.info?.isrc)

      if (data.info?.duration && !trackToUse)
        trackToUse = res.tracks.find(
          (track) => track.info?.duration >= data.info?.duration - 1500 && track?.info.duration <= data.info?.duration + 1500
        )

      return applyUnresolvedData(trackToUse || res.tracks[0], data, player.RyanlinkManager.utils)
    })
}

export function safeStringify(obj: any, padding = 0) {
  const seen = new WeakSet()
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'function') return undefined
      if (typeof value === 'symbol') return undefined
      if (typeof value === 'bigint') return value.toString()
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }
      return value
    },
    padding
  )
}
