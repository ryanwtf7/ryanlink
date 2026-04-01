import { EventEmitter } from 'node:events'
import { DebugEvents, DestroyReasons } from '../config/Constants'
import { NodeManager } from '../node/NodeManager'
import { Player, Autoplay } from '../audio/Player'
import { MemoryQueueStore } from '../audio/QueueStore'
import type { BotClientOptions, DeepRequired, ManagerEvents, RyanConfiguration, RequiredManagerOptions } from '../types/Manager'
import type { NodeConfiguration } from '../types/Node'
import type { PlayerOptions } from '../types/Player'
import type { ChannelDeletePacket, VoicePacket, VoiceServer, VoiceState, SearchQuery, SearchResult } from '../types/Utils'
import { RyanlinkUtils, MiniMap, safeStringify } from '../utils/Utils'
import type { RyanlinkNode } from '../node/Node'
import type { NodeLinkNode } from '../node/NodeLink'
export class RyanlinkManager<CustomPlayerT extends Player = Player> extends EventEmitter {
  emit<Event extends keyof ManagerEvents<CustomPlayerT>>(
    event: Event,
    ...args: Parameters<ManagerEvents<CustomPlayerT>[Event]>
  ): boolean {
    return super.emit(event as string, ...args)
  }

  on<Event extends keyof ManagerEvents<CustomPlayerT>>(event: Event, listener: ManagerEvents<CustomPlayerT>[Event]): this {
    return super.on(event as string, listener)
  }

  once<Event extends keyof ManagerEvents<CustomPlayerT>>(event: Event, listener: ManagerEvents<CustomPlayerT>[Event]): this {
    return super.once(event as string, listener)
  }

  off<Event extends keyof ManagerEvents<CustomPlayerT>>(event: Event, listener: ManagerEvents<CustomPlayerT>[Event]): this {
    return super.off(event as string, listener)
  }

  removeListener<Event extends keyof ManagerEvents<CustomPlayerT>>(
    event: Event,
    listener: ManagerEvents<CustomPlayerT>[Event]
  ): this {
    return super.removeListener(event as string, listener)
  }

  public options: RyanConfiguration<CustomPlayerT>

  public nodeManager: NodeManager

  public utils: RyanlinkUtils

  public voiceStates: Map<string, { guildId: string; channelId: string; userId: string; deaf: boolean; mute: boolean }> = new Map()

  public getVoiceStateUsers(guildId: string, channelId: string) {
    return Array.from(this.voiceStates.values()).filter((v) => v.guildId === guildId && v.channelId === channelId)
  }

  public initiated: boolean = false

  public readonly players: MiniMap<string, CustomPlayerT> = new MiniMap()

  private applyOptions(options: RyanConfiguration<CustomPlayerT>) {
    const optionsToAssign: RequiredManagerOptions<CustomPlayerT> = {
      ...options,
      client: {
        ...options?.client,
        id: options?.client?.id,
        username: options?.client?.username ?? 'ryanlink',
      },
      sendToShard: options?.sendToShard,
      autoMove: options?.autoMove ?? false,
      nodes: options?.nodes as DeepRequired<NodeConfiguration>[],
      playerClass: (options?.playerClass ?? Player) as unknown as DeepRequired<CustomPlayerT>,
      playerOptions: {
        applyVolumeAsFilter: options?.playerOptions?.applyVolumeAsFilter ?? false,
        clientBasedPositionUpdateInterval: options?.playerOptions?.clientBasedPositionUpdateInterval ?? 100,
        defaultSearchPlatform: options?.playerOptions?.defaultSearchPlatform ?? 'ytsearch',
        allowCustomSources: options?.playerOptions?.allowCustomSources ?? false,
        onDisconnect: {
          destroyPlayer: options?.playerOptions?.onDisconnect?.destroyPlayer ?? true,
          autoReconnect: options?.playerOptions?.onDisconnect?.autoReconnect ?? false,
          autoReconnectOnlyWithTracks: options?.playerOptions?.onDisconnect?.autoReconnectOnlyWithTracks ?? false,
        },
        onEmptyQueue: {
          autoPlayFunction: options?.playerOptions?.onEmptyQueue?.autoPlayFunction ?? Autoplay.defaultAutoplay,
          destroyAfterMs: options?.playerOptions?.onEmptyQueue?.destroyAfterMs ?? undefined,
        },
        autoplayConfig: {
          enabled: options?.playerOptions?.autoplayConfig?.enabled ?? true,
          defaultSource: options?.playerOptions?.autoplayConfig?.defaultSource ?? 'ytsearch',
          limit: options?.playerOptions?.autoplayConfig?.limit ?? 1,
          minDuration: options?.playerOptions?.autoplayConfig?.minDuration ?? 20000,
          maxDuration: options?.playerOptions?.autoplayConfig?.maxDuration ?? 900000,
          excludeKeywords: options?.playerOptions?.autoplayConfig?.excludeKeywords ?? [
            'nightcore', 'bass boosted', '8d audio', 'slowed', 'reverb',
            'bass boost', 'pitch shift', 'speed up', 'sped up',
          ],
          durationTolerance: options?.playerOptions?.autoplayConfig?.durationTolerance ?? 90000,
          historyLimit: options?.playerOptions?.autoplayConfig?.historyLimit ?? 20,
          prefetchThreshold: options?.playerOptions?.autoplayConfig?.prefetchThreshold ?? 1,
        },
        volumeDecrementer: options?.playerOptions?.volumeDecrementer ?? 1,
        requesterTransformer: options?.playerOptions?.requesterTransformer ?? null,
        useUnresolvedData: options?.playerOptions?.useUnresolvedData ?? false,
        minAutoPlayMs: options?.playerOptions?.minAutoPlayMs ?? 10_000,
        maxErrorsPerTime: {
          threshold: options?.playerOptions?.maxErrorsPerTime?.threshold ?? 35_000,
          maxAmount: options?.playerOptions?.maxErrorsPerTime?.maxAmount ?? 3,
        },
        enforceSponsorBlockRequestForEventEnablement: options?.playerOptions?.enforceSponsorBlockRequestForEventEnablement ?? true,
        trackResolveRetryLimit: options?.playerOptions?.trackResolveRetryLimit ?? options?.trackResolveRetryLimit ?? 3,
        onTrackStart: options?.playerOptions?.onTrackStart ?? options?.onTrackStart ?? null,
        onQueueEnd: options?.playerOptions?.onQueueEnd ?? options?.onQueueEnd ?? null,
        onNodeFailover: options?.playerOptions?.onNodeFailover ?? options?.onNodeFailover ?? null,
      },
      linksWhitelist: options?.linksWhitelist ?? [],
      linksBlacklist: options?.linksBlacklist ?? [],
      linksAllowed: options?.linksAllowed ?? true,
      autoSkip: options?.autoSkip ?? true,
      resuming: {
        enabled: options?.resuming?.enabled ?? options?.resume ?? false,
        timeout: options?.resuming?.timeout ?? (options?.resume ? 60000 : 0),
      },
      resume: options?.resume ?? false,
      autoSkipOnResolveError: options?.autoSkipOnResolveError ?? true,
      emitNewSongsOnly: options?.emitNewSongsOnly ?? false,
      trackResolveRetryLimit: options?.playerOptions?.trackResolveRetryLimit ?? options?.trackResolveRetryLimit ?? 3,
      onTrackStart: options?.playerOptions?.onTrackStart ?? options?.onTrackStart ?? null,
      onQueueEnd: options?.playerOptions?.onQueueEnd ?? options?.onQueueEnd ?? null,
      onNodeFailover: options?.playerOptions?.onNodeFailover ?? options?.onNodeFailover ?? null,
      queueOptions: {
        maxPreviousTracks: options?.queueOptions?.maxPreviousTracks ?? 25,
        queueChangesWatcher: options?.queueOptions?.queueChangesWatcher ?? null,
        queueStore: options?.queueOptions?.queueStore ?? new MemoryQueueStore(),
        resuming: {
          enabled: options?.resuming?.enabled ?? false,
          timeout: options?.resuming?.timeout ?? 60000,
        },
      },
      advancedOptions: {
        enableDebugEvents: options?.advancedOptions?.enableDebugEvents ?? false,
        maxFilterFixDuration: options?.advancedOptions?.maxFilterFixDuration ?? 600_000,
        debugOptions: {
          logCustomSearches: options?.advancedOptions?.debugOptions?.logCustomSearches ?? false,
          noAudio: options?.advancedOptions?.debugOptions?.noAudio ?? false,
          playerDestroy: {
            dontThrowError: options?.advancedOptions?.debugOptions?.playerDestroy?.dontThrowError ?? false,
            debugLog: options?.advancedOptions?.debugOptions?.playerDestroy?.debugLog ?? false,
          },
        },
      },
    }

    this.options = optionsToAssign as unknown as RyanConfiguration<CustomPlayerT>

    return
  }

  private validateOptions(options: RyanConfiguration<CustomPlayerT>) {
    if (typeof options?.sendToShard !== 'function') throw new SyntaxError('ManagerOption.sendToShard was not provided, which is required!')

    if (options?.autoSkip && typeof options?.autoSkip !== 'boolean')
      throw new SyntaxError('ManagerOption.autoSkip must be either false | true aka boolean')

    if (options?.autoSkipOnResolveError && typeof options?.autoSkipOnResolveError !== 'boolean')
      throw new SyntaxError('ManagerOption.autoSkipOnResolveError must be either false | true aka boolean')

    if (options?.emitNewSongsOnly && typeof options?.emitNewSongsOnly !== 'boolean')
      throw new SyntaxError('ManagerOption.emitNewSongsOnly must be either false | true aka boolean')

    if (!options?.nodes || !Array.isArray(options?.nodes) || !options?.nodes.every((node) => this.utils.isNodeOptions(node)))
      throw new SyntaxError('ManagerOption.nodes must be an Array of NodeOptions and is required of at least 1 Node')

    if (options?.queueOptions?.queueStore) {
      const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(options?.queueOptions?.queueStore))
      const requiredKeys = ['get', 'set', 'stringify', 'parse', 'delete']
      if (!requiredKeys.every((v) => keys.includes(v)) || !requiredKeys.every((v) => typeof options?.queueOptions?.queueStore[v] === 'function'))
        throw new SyntaxError(`The provided ManagerOption.QueueStore, does not have all required functions: ${requiredKeys.join(', ')}`)
    }

    if (options?.queueOptions?.queueChangesWatcher) {
      const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(options?.queueOptions?.queueChangesWatcher))
      const requiredKeys = ['tracksAdd', 'tracksRemoved', 'shuffled']
      if (
        !requiredKeys.every((v) => keys.includes(v)) ||
        !requiredKeys.every((v) => typeof options?.queueOptions?.queueChangesWatcher[v] === 'function')
      )
        throw new SyntaxError(
          `The provided ManagerOption.DefaultQueueChangesWatcher, does not have all required functions: ${requiredKeys.join(', ')}`
        )
    }

    if (typeof options?.queueOptions?.maxPreviousTracks !== 'number' || options?.queueOptions?.maxPreviousTracks < 0)
      options.queueOptions.maxPreviousTracks = 25
  }

  private dispatchDebug(name: DebugEvents, eventData: any) {
    if (!this.options?.advancedOptions?.enableDebugEvents) return
    try {

      const sanitizedData = JSON.parse(safeStringify(eventData))
      this.emit('debug', name, sanitizedData)
    } catch {
      this.emit('debug', name, { state: eventData.state, message: 'Serialization failed during debug dispatch', functionLayer: eventData.functionLayer })
    }
  }

  private _debugNoAudio(
    state: 'log' | 'warn' | 'error',
    functionLayer: string,
    messages: { message: string; consoleMessage?: string },
    ..._consoleArgs: unknown[]
  ): void {
    this.dispatchDebug(DebugEvents.NoAudioDebug, { state, functionLayer, message: messages.message })
    if (this.options?.advancedOptions?.debugOptions?.noAudio) {
      void 0;
    }
  }

  constructor(options: RyanConfiguration<CustomPlayerT>) {
    super()

    if (!options) throw new SyntaxError('No Manager Options Provided')
    this.utils = new RyanlinkUtils(this as RyanlinkManager)

    this.applyOptions(options)
    this.validateOptions(this.options)

    this.nodeManager = new NodeManager(this as RyanlinkManager)
  }

  public toJSON() {
    return {
      initiated: this.initiated,
      playerCount: this.players.size,
      nodeCount: this.nodeManager.nodes.size,
    }
  }

  public getPlayer(guildId: string): CustomPlayerT | undefined {
    return this.players.get(guildId)
  }

  public createPlayer(options: PlayerOptions): CustomPlayerT {
    const oldPlayer = this.getPlayer(options?.guildId)
    if (oldPlayer) return oldPlayer

    const newPlayer = new this.options.playerClass(options, this, true)
    this.players.set(newPlayer.guildId, newPlayer)
    this.emit('playerCreate', newPlayer)
    return newPlayer
  }

  public async search(
    query: SearchQuery,
    requestUser?: unknown,
    node?: RyanlinkNode | NodeLinkNode,
    throwOnEmpty: boolean = false
  ): Promise<SearchResult> {
    const Query = this.utils.transformQuery(query)
    const targetNode = node || this.nodeManager.leastUsedNodes('players')[0]

    if (!targetNode || !targetNode.connected) {
      throw new Error('No nodes are available / connected to perform a search.')
    }

    return targetNode.search(Query, requestUser, throwOnEmpty)
  }

  public destroyPlayer(guildId: string, destroyReason?: string): Promise<void | CustomPlayerT> {
    const oldPlayer = this.getPlayer(guildId)
    if (!oldPlayer) return
    return oldPlayer.destroy(destroyReason) as Promise<void | CustomPlayerT>
  }

  public deletePlayer(guildId: string): boolean | void {
    const oldPlayer = this.getPlayer(guildId)
    if (!oldPlayer) return

    if (typeof oldPlayer.voiceChannelId === 'string' && oldPlayer.connected && !oldPlayer.getData('internal_destroywithoutdisconnect')) {
      if (!this.options?.advancedOptions?.debugOptions?.playerDestroy?.dontThrowError)
        throw new Error(`Use Player#destroy() not RyanlinkManager#deletePlayer() to stop the Player ${safeStringify(oldPlayer.toJSON?.())}`)

      this.dispatchDebug(DebugEvents.PlayerDeleteInsteadOfDestroy, {
        state: 'warn',
        message: 'Use Player#destroy() not RyanlinkManager#deletePlayer() to stop the Player',
        functionLayer: 'RyanlinkManager > deletePlayer()',
      })
    }
    return this.players.delete(guildId)
  }

  public get useable(): boolean {
    return this.nodeManager.nodes.filter((v) => v.connected).size > 0
  }

  public async init(clientData: BotClientOptions): Promise<this> {
    if (this.initiated) return this
    clientData = clientData ?? ({} as BotClientOptions)
    this.options.client = { ...this.options?.client, ...clientData }
    if (!this.options?.client.id) throw new Error('"client.id" is not set. Pass it in Manager#init() or as a option in the constructor.')

    if (typeof this.options?.client.id !== 'string') throw new Error('"client.id" set is not type of "string"')

    let success = 0
    for (const node of this.nodeManager.nodes.values()) {
      try {
        await node.connect()
        success++
      } catch (err) {
        console.error(err)
        this.nodeManager.emit('error', err, node)
      }
    }
    if (success > 0) this.initiated = true
    else
      this.dispatchDebug(DebugEvents.FailedToConnectToNodes, {
        state: 'error',
        message: 'Failed to connect to at least 1 Node',
        functionLayer: 'RyanlinkManager > init()',
      })
    return this
  }

  public async provideVoiceUpdate(data: VoicePacket | VoiceServer | VoiceState | ChannelDeletePacket): Promise<void> {
    if (!this.initiated) {
      this._debugNoAudio('log', 'RyanlinkManager > provideVoiceUpdate()', {
        message: 'Manager is not initated yet',
        consoleMessage: 'manager is not initated yet',
      })
      return
    }

    if (!('t' in data)) {
      this._debugNoAudio(
        'error',
        'RyanlinkManager > provideVoiceUpdate()',
        {
          message: "No 't' in payload-data of the raw event:",
          consoleMessage: "no 't' in payload-data of the raw event:",
        },
        data
      )
      return
    }

    if ('CHANNEL_DELETE' === data.t) {
      const update = 'd' in data ? data.d : data
      if (!update.guild_id) return
      const player = this.getPlayer(update.guild_id)
      if (player && player.voiceChannelId === update.id) return void player.destroy(DestroyReasons.ChannelDeleted)
    }

    if (['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'].includes(data.t)) {
      const update = ('d' in data ? data.d : data) as VoiceServer | VoiceState
      if (!update) {
        this._debugNoAudio(
          'warn',
          'RyanlinkManager > provideVoiceUpdate()',
          {
            message: `No Update data found in payload :: ${safeStringify(data, 2)}`,
            consoleMessage: 'no update data found in payload:',
          },
          data
        )
        return
      }

      if ('user_id' in update && update.guild_id) {
        if (update.channel_id) {
          this.voiceStates.set(`${update.guild_id}_${update.user_id}`, {
            guildId: update.guild_id,
            channelId: update.channel_id,
            userId: update.user_id,
            deaf: update.deaf ?? false,
            mute: update.mute ?? false,
          })
        } else {
          this.voiceStates.delete(`${update.guild_id}_${update.user_id}`)
        }
      }

      if (!('token' in update) && !('session_id' in update)) {
        this._debugNoAudio(
          'error',
          'RyanlinkManager > provideVoiceUpdate()',
          {
            message: `No 'token' nor 'session_id' found in payload :: ${safeStringify(data, 2)}`,
            consoleMessage: "no 'token' nor 'session_id' found in payload:",
          },
          data
        )
        return
      }

      const player = this.getPlayer(update.guild_id)

      if (!player) {
        this._debugNoAudio(
          'warn',
          'RyanlinkManager > provideVoiceUpdate()',
          {
            message: `No Audio Player found via key: 'guild_id' of update-data :: ${safeStringify(update, 2)}`,
            consoleMessage: "No Audio Player found via key: 'guild_id' of update-data:",
          },
          update
        )
        return
      }

      if (player.getData('internal_destroystatus') === true) {
        this._debugNoAudio('warn', 'RyanlinkManager > provideVoiceUpdate()', {
          message: "Player is in a destroying state. can't signal the voice states",
        })
        return
      }

      if ('token' in update) {
        if (!player.node?.sessionId) throw new Error('Audio Node is either not ready or not up to date')

        const sessionId2Use = player.voice?.sessionId || ('sessionId' in update ? (update.sessionId as string) : undefined)

        const channelId2Use = player.voice?.channelId || ('channel_id' in update ? (update.channel_id as string) : undefined)

        const voiceData = {
          token: update.token,
          endpoint: update.endpoint,
          sessionId: sessionId2Use,
          channelId: channelId2Use,
        }
        if (!sessionId2Use) {
          this._debugNoAudio(
            'error',
            'RyanlinkManager > provideVoiceUpdate()',
            {
              message: `Can't send updatePlayer for voice token session - Missing sessionId :: ${safeStringify({ voice: voiceData, update, playerVoice: player.voice }, 2)}`,
              consoleMessage: "Can't send updatePlayer for voice token session - Missing sessionId",
            },
            { voice: voiceData, update, playerVoice: player.voice }
          )
        } else if (!channelId2Use) {
          this._debugNoAudio(
            'error',
            'RyanlinkManager > provideVoiceUpdate()',
            {
              message: `Can't send updatePlayer for voice token session - Missing channelId :: ${safeStringify({ voice: voiceData, update, playerVoice: player.voice }, 2)}`,
              consoleMessage: "Can't send updatePlayer for voice token session - Missing channelId",
            },
            { voice: voiceData, update, playerVoice: player.voice }
          )
        } else {
          await player.node.updatePlayer({
            guildId: player.guildId,
            playerOptions: {
              voice: voiceData,
            },
          })
          this._debugNoAudio(
            'log',
            'RyanlinkManager > provideVoiceUpdate()',
            {
              message: `Sent updatePlayer for voice token session :: ${safeStringify({ voice: voiceData, update, playerVoice: player.voice }, 2)}`,
              consoleMessage: 'Sent updatePlayer for voice token session',
            },
            { voice: voiceData, playerVoice: player.voice, update }
          )
        }
        return
      }

      if (update.user_id !== this.options?.client.id) {
        if (update.user_id && player.voiceChannelId) {
          this.emit(update.channel_id === player.voiceChannelId ? 'playerVoiceJoin' : 'playerVoiceLeave', player, update.user_id)

          if (update.channel_id !== player.voiceChannelId) {
            const users = this.getVoiceStateUsers(player.guildId, player.voiceChannelId)
            if (users.length <= 1) {
              if (player.options.smartLeave) {
                player.destroy('Destroyed due to empty channel (smartLeave)')
                return
              } else if (player.options.autoPause && !player.paused) {
                player.setData('internal_autoPaused', true)
                player.pause().catch(() => { })
              }
            }
          } else {

            if (player.options.autoPause && player.paused && player.getData('internal_autoPaused')) {
              player.setData('internal_autoPaused', undefined)
              player.resume().catch(() => { })
            }
          }
        }

        this._debugNoAudio(
          'warn',
          'RyanlinkManager > provideVoiceUpdate()',
          {
            message: `voice update user is not equal to provided client id of the RyanlinkManager.options.client.id :: user: "${update.user_id}" manager client id: "${this.options?.client.id}"`,
            consoleMessage: 'voice update user is not equal to provided client id of the manageroptions#client#id',
          },
          'user:',
          update.user_id,
          'manager client id:',
          this.options?.client.id
        )
        return
      }

      if (update.channel_id) {
        if (player.voiceChannelId !== update.channel_id) {
          this.emit('playerMove', player, player.voiceChannelId, update.channel_id)
          const users = this.getVoiceStateUsers(player.guildId, update.channel_id)
          if (users.length <= 1) {
            if (player.options.smartLeave) {
              player.destroy('Destroyed due to empty channel (smartLeave)')
              return
            } else if (player.options.autoPause && !player.paused) {
              player.pause().catch(() => { })
            }
          }
        }

        player.voice.sessionId = update.session_id || player.voice.sessionId
        player.voice.channelId = update.channel_id || player.voice.channelId

        if (!player.voice.sessionId) {
          this._debugNoAudio('warn', 'RyanlinkManager > provideVoiceUpdate()', {
            message: `Function to assing sessionId provided, but no found in Payload: ${safeStringify({ update, playerVoice: player.voice }, 2)}`,
            consoleMessage: `Function to assing sessionId provided, but no found in Payload: ${safeStringify(update, 2)}`,
          })
        }

        player.voiceChannelId = update.channel_id
        player.options.voiceChannelId = update.channel_id

        const selfMuteChanged = typeof update.self_mute === 'boolean' && player.voiceState.selfMute !== update.self_mute
        const serverMuteChanged = typeof update.mute === 'boolean' && player.voiceState.serverMute !== update.mute
        const selfDeafChanged = typeof update.self_deaf === 'boolean' && player.voiceState.selfDeaf !== update.self_deaf
        const serverDeafChanged = typeof update.deaf === 'boolean' && player.voiceState.serverDeaf !== update.deaf
        const suppressChange = typeof update.suppress === 'boolean' && player.voiceState.suppress !== update.suppress

        player.voiceState.selfDeaf = update.self_deaf ?? player.voiceState?.selfDeaf
        player.voiceState.selfMute = update.self_mute ?? player.voiceState?.selfMute
        player.voiceState.serverDeaf = update.deaf ?? player.voiceState?.serverDeaf
        player.voiceState.serverMute = update.mute ?? player.voiceState?.serverMute
        player.voiceState.suppress = update.suppress ?? player.voiceState?.suppress

        if (selfMuteChanged || serverMuteChanged) {
          this.emit('playerMuteChange', player, player.voiceState.selfMute, player.voiceState.serverMute)
          if (player.options.autoPauseOnMute === true) {
            if (player.voiceState.selfMute || player.voiceState.serverMute) await player.pause()
            else await player.resume()
          }
        }
        if (selfDeafChanged || serverDeafChanged) this.emit('playerDeafChange', player, player.voiceState.selfDeaf, player.voiceState.serverDeaf)
        if (suppressChange) this.emit('playerSuppressChange', player, player.voiceState.suppress)
      } else {
        const { autoReconnectOnlyWithTracks, destroyPlayer, autoReconnect } = this.options?.playerOptions?.onDisconnect ?? {}

        if (destroyPlayer === true) {
          return void (await player.destroy(DestroyReasons.Disconnected))
        }

        if (autoReconnect === true) {
          try {
            const previousPosition = player.position
            const previousPaused = player.paused
            
            if (!autoReconnectOnlyWithTracks || (autoReconnectOnlyWithTracks && (player.queue.current || player.queue.tracks.length))) {
              await player.connect()

              this.emit('playerReconnect', player, player.voiceChannelId)
            }

            if (player.queue.current) {
              return void (await player.play({
                position: previousPosition,
                paused: previousPaused,
                clientTrack: player.queue.current,
              }))
            }

            if (player.queue.tracks.length) {
              return void (await player.play({ paused: previousPaused }))
            }

            this.dispatchDebug(DebugEvents.PlayerAutoReconnect, {
              state: 'log',
              message: `Auto reconnected, but nothing to play`,
              functionLayer: 'RyanlinkManager > provideVoiceUpdate()',
            })

            return
          } catch (e) {
            console.error(e)
            return void (await player.destroy(DestroyReasons.PlayerReconnectFail))
          }
        }

        this.emit('playerDisconnect', player, player.voiceChannelId)

        player.voiceChannelId = null
        player.voice = Object.assign({})
        return
      }
    }
  }
}
