import { RyanlinkManager, RyanlinkNode } from '../src'
import { RyanlinkUtils, applyUnresolvedData, AudioTrackSymbol } from '../src/utils/Utils'
import { TrackRegistry } from '../src/utils/TrackRegistry'

function makeManager(opts: any = {}) {
  return new RyanlinkManager({ nodes: [], client: { id: 'bot1' }, sendToShard: jest.fn().mockResolvedValue(undefined), ...opts })
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  // @ts-ignore
  node.destroyPlayer = jest.fn().mockResolvedValue(undefined)
  return node
}

function makeSetup(opts: any = {}) {
  const manager = makeManager(opts)
  const node = makeConnectedNode(manager)
  manager.initiated = true
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'n1' })
  return { manager, node, player }
}

describe('Manager - dispatchDebug with enableDebugEvents', () => {
  it('emits debug when enableDebugEvents=true via init failure', async () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true } })
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    await manager.init({ id: 'bot1' })
    expect(debugListener).toHaveBeenCalled()
  })
})

describe('Manager - _debugNoAudio console output', () => {
  it('logs to console when noAudio=true and enableDebugEvents=true', async () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true, debugOptions: { noAudio: true } } })
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    manager.initiated = true
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: null } as any)
    consoleSpy.mockRestore()
  })
})

describe('Manager - deletePlayer with internal_destroywithoutdisconnect', () => {
  it('does not throw when internal_destroywithoutdisconnect is set', () => {
    const manager = makeManager()
    makeConnectedNode(manager)
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'n1' })
    player.connected = true
    player.setData('internal_destroywithoutdisconnect', true)
    expect(() => manager.deletePlayer('g')).not.toThrow()
  })
})

describe('Manager - init() client.id not string', () => {
  it('throws when client.id is not a string', async () => {
    const manager = makeManager()
    manager.options.client.id = 123 as any
    await expect(manager.init({ id: 123 as any })).rejects.toThrow('not type of')
  })
})

describe('Manager - provideVoiceUpdate VOICE_SERVER_UPDATE missing fields', () => {
  it('logs warning when voice data fields are missing', async () => {
    const { manager, player } = makeSetup()
    player.voice.sessionId = null
    player.voice.channelId = null
    await manager.provideVoiceUpdate({
      t: 'VOICE_SERVER_UPDATE',
      d: { guild_id: 'g', token: 'tok', endpoint: 'ep.discord.gg' },
    } as any)
  })
})

describe('Manager - provideVoiceUpdate samePayload skip VOICE_SERVER_UPDATE', () => {
  it('skips update when payload is identical', async () => {
    const { manager, node, player } = makeSetup()
    player.voice.sessionId = 'sess'
    player.voice.channelId = 'vc1'
    player.voice.token = 'tok'
    player.voice.endpoint = 'ep.discord.gg'
    player.lastVoiceUpdate = { sessionId: 'sess', token: 'tok', endpoint: 'ep.discord.gg', channelId: 'vc1' }
    const callsBefore = (node.updatePlayer as jest.Mock).mock.calls.length
    await manager.provideVoiceUpdate({
      t: 'VOICE_SERVER_UPDATE',
      d: { guild_id: 'g', token: 'tok', endpoint: 'ep.discord.gg' },
    } as any)
    expect((node.updatePlayer as jest.Mock).mock.calls.length).toBe(callsBefore)
  })
})

describe('Manager - provideVoiceUpdate other user smartLeave/autoPause', () => {
  it('destroys player when smartLeave=true and channel empty', async () => {
    const { manager, player } = makeSetup()
    player.options.smartLeave = true
    player.voiceChannelId = 'vc1'
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc2', user_id: 'other', session_id: 's' },
    } as any)
    expect(destroySpy).toHaveBeenCalled()
  })

  it('autoPauses when autoPause=true and channel empty', async () => {
    const { manager, player } = makeSetup()
    player.options.autoPause = true
    player.voiceChannelId = 'vc1'
    player.paused = false
    const pauseSpy = jest.spyOn(player, 'pause').mockResolvedValue(player)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc2', user_id: 'other', session_id: 's' },
    } as any)
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('resumes when autoPause=true and user rejoins', async () => {
    const { manager, player } = makeSetup()
    player.options.autoPause = true
    player.voiceChannelId = 'vc1'
    player.paused = true
    player.setData('internal_autoPaused', true)
    const resumeSpy = jest.spyOn(player, 'resume').mockResolvedValue(player)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc1', user_id: 'other', session_id: 's' },
    } as any)
    expect(resumeSpy).toHaveBeenCalled()
  })
})

describe('Manager - provideVoiceUpdate voiceState mute/deaf autoPauseOnMute', () => {
  it('pauses when autoPauseOnMute=true and bot muted', async () => {
    const { manager, player } = makeSetup()
    player.options.autoPauseOnMute = true
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    const pauseSpy = jest.spyOn(player, 'pause').mockResolvedValue(player)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc1', user_id: 'bot1', session_id: 'sess', self_mute: true },
    } as any)
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('resumes when autoPauseOnMute=true and bot unmuted', async () => {
    const { manager, player } = makeSetup()
    player.options.autoPauseOnMute = true
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    player.paused = true
    player.voiceState.selfMute = true
    const resumeSpy = jest.spyOn(player, 'resume').mockResolvedValue(player)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc1', user_id: 'bot1', session_id: 'sess', self_mute: false },
    } as any)
    expect(resumeSpy).toHaveBeenCalled()
  })
})

describe('Manager - provideVoiceUpdate autoReconnect', () => {
  it('reconnects and plays current track', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    manager.options.playerOptions.onDisconnect.destroyPlayer = false
    manager.options.playerOptions.onDisconnect.autoReconnect = true
    const connectSpy = jest.spyOn(player, 'connect').mockResolvedValue(player)
    const playSpy = jest.spyOn(player, 'play').mockResolvedValue(player)
    const t = { encoded: 't1', info: { duration: 1000 } } as any
    Object.defineProperty(t, AudioTrackSymbol, { value: true, configurable: true })
    player.queue.current = t
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: null, user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect(connectSpy).toHaveBeenCalled()
    expect(playSpy).toHaveBeenCalled()
  })

  it('reconnects and plays from queue when no current', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    manager.options.playerOptions.onDisconnect.destroyPlayer = false
    manager.options.playerOptions.onDisconnect.autoReconnect = true
    const connectSpy = jest.spyOn(player, 'connect').mockResolvedValue(player)
    const playSpy = jest.spyOn(player, 'play').mockResolvedValue(player)
    player.queue.current = null
    player.queue.tracks.push({ encoded: 't1', info: {} } as any)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: null, user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect(connectSpy).toHaveBeenCalled()
    expect(playSpy).toHaveBeenCalled()
  })

  it('reconnects with nothing to play', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    manager.options.playerOptions.onDisconnect.destroyPlayer = false
    manager.options.playerOptions.onDisconnect.autoReconnect = true
    jest.spyOn(player, 'connect').mockResolvedValue(player)
    player.queue.current = null
    player.queue.tracks.length = 0
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: null, user_id: 'bot1', session_id: 'sess' },
    } as any)
  })

  it('destroys on reconnect failure', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    manager.options.playerOptions.onDisconnect.destroyPlayer = false
    manager.options.playerOptions.onDisconnect.autoReconnect = true
    jest.spyOn(player, 'connect').mockRejectedValue(new Error('connect failed'))
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: null, user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect(destroySpy).toHaveBeenCalled()
  })
})

describe('Manager - provideVoiceUpdate samePayload skip VOICE_STATE_UPDATE', () => {
  it('skips update when voice data is identical', async () => {
    const { manager, node, player } = makeSetup()
    player.voice.token = 'tok'
    player.voice.sessionId = 'sess'
    player.voice.endpoint = 'ep.discord.gg'
    player.voice.channelId = 'vc1'
    player.lastVoiceUpdate = { token: 'tok', sessionId: 'sess', endpoint: 'ep.discord.gg', channelId: 'vc1' }
    const callsBefore = (node.updatePlayer as jest.Mock).mock.calls.length
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc1', user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect((node.updatePlayer as jest.Mock).mock.calls.length).toBe(callsBefore)
  })
})

describe('Manager - provideVoiceUpdate bot moves channel smartLeave/autoPause', () => {
  it('smartLeave destroys when new channel is empty', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    player.options.smartLeave = true
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc2', user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect(destroySpy).toHaveBeenCalled()
  })

  it('autoPause when bot moves to empty channel', async () => {
    const { manager, player } = makeSetup()
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    player.options.autoPause = true
    player.paused = false
    const pauseSpy = jest.spyOn(player, 'pause').mockResolvedValue(player)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: { guild_id: 'g', channel_id: 'vc2', user_id: 'bot1', session_id: 'sess' },
    } as any)
    expect(pauseSpy).toHaveBeenCalled()
  })
})

describe('Utils - getClosestTrack debug event', () => {
  it('re-throws error from getClosestTrack', async () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true } })
    const utils = new RyanlinkUtils(manager)
    const unresolvedTrack = utils.buildUnresolvedTrack({ title: 'T' } as any, { id: 'u' })
    const mockPlayer = { node: null, RyanlinkManager: { utils, options: manager.options } } as any
    await expect(utils.getClosestTrack(unresolvedTrack, mockPlayer)).rejects.toThrow('No player')
  })

  it('emits debug when enableDebugEvents=true and getClosestTrack fails', async () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true } })
    const utils = new RyanlinkUtils(manager)
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    const unresolvedTrack = utils.buildUnresolvedTrack({ title: 'T' } as any, { id: 'u' })
    // Use a player whose node throws to trigger the catch block
    const mockPlayer = {
      node: null,
      RyanlinkManager: manager,
    } as any
    await expect(utils.getClosestTrack(unresolvedTrack, mockPlayer)).rejects.toThrow()
    expect(debugListener).toHaveBeenCalled()
  })
})

describe('Utils - validateQueryString debug events', () => {
  it('emits debug for blacklist check when enableDebugEvents=true', () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true }, linksBlacklist: ['badsite.com'] })
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    expect(() => utils.validateQueryString(node, 'https://badsite.com/track')).toThrow()
    expect(debugListener).toHaveBeenCalled()
  })

  it('emits debug for whitelist check when enableDebugEvents=true', () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true }, linksWhitelist: ['youtube.com'] })
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    expect(() => utils.validateQueryString(node, 'https://youtube.com/watch?v=abc')).not.toThrow()
    expect(debugListener).toHaveBeenCalled()
  })
})

describe('Utils - applyUnresolvedData Unspecified description', () => {
  beforeEach(() => TrackRegistry.clear())

  it('fixes Unspecified description title', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = { info: { title: 'Unspecified description', author: 'A', artworkUrl: null }, pluginInfo: {} } as any
    const data = { info: { title: 'Real Title', author: 'A', uri: null }, pluginInfo: {} } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.title).toBe('Real Title')
  })

  it('uses pluginInfo.title when data.info.title is empty', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = { info: { title: 'Unknown title', author: 'A', artworkUrl: null }, pluginInfo: {} } as any
    const data = { info: { title: '', author: 'A', uri: null }, pluginInfo: { title: 'Plugin Title' } } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.title).toBe('Plugin Title')
  })

  it('uses pluginInfo.artworkUrl when data.info.artworkUrl is empty', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = { info: { title: 'T', author: 'A', artworkUrl: 'old' }, pluginInfo: {} } as any
    const data = { info: { title: 'T', author: 'A', artworkUrl: '', uri: null }, pluginInfo: { artworkUrl: 'http://plugin.art' } } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.artworkUrl).toBe('http://plugin.art')
  })
})

describe('NodeManager - leastUsedNodes returns empty for disconnected nodes', () => {
  it('returns empty array for all sort types when no connected nodes', () => {
    const manager = makeManager()
    new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    const types = ['memory', 'cpuLavalink', 'cpuSystem', 'calls', 'playingPlayers'] as const
    for (const t of types) {
      expect(manager.nodeManager.leastUsedNodes(t)).toEqual([])
    }
  })
})
