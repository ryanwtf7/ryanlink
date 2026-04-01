import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'

jest.mock('ws', () => {
  const { EventEmitter } = require('node:events')
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1
    public static CLOSED = 3
    public readyState = 0
    constructor(public url: string, public options: any) {
       super()
       setTimeout(() => {
         this.readyState = 1
         this.emit('open')
         setTimeout(() => {
           this.emit('message', JSON.stringify({ 
             op: 'ready', 
             sessionId: 'mock-session', 
             resumed: false,
             info: {
               version: { semver: '4.0.0' },
               plugins: []
             }
           }))
         }, 5)
       }, 5)
    }
    send = jest.fn()
    close = jest.fn((code, reason) => { 
      this.readyState = 3
      this.emit('close', code, reason) 
    })
    terminate = jest.fn(() => this.close(1006, 'term'))
    ping = jest.fn(() => this.emit('pong'))
  }
  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  }
})
import { DestroyReasons } from '../src/config/Constants'

describe('Manager.provideVoiceUpdate', () => {
  let manager: RyanlinkManager

  const BOT_ID = 'bot123'

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: BOT_ID },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
    })
    await manager.init({ id: BOT_ID })
    const node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'sess123'
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles missing "t" in payload', async () => {
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    // @ts-ignore
    await manager.provideVoiceUpdate({})
    expect(debugSpy).toHaveBeenCalledWith('error', expect.stringContaining('provideVoiceUpdate'), expect.objectContaining({ consoleMessage: expect.stringContaining("no 't' in payload-data") }), expect.anything())
  })

  it('handles missing update data (d property)', async () => {
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    // @ts-ignore
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: null })
    expect(debugSpy).toHaveBeenCalledWith('warn', expect.stringContaining('provideVoiceUpdate'), expect.objectContaining({ consoleMessage: expect.stringContaining('no update data') }), expect.anything())
  })

  it('handles CHANNEL_DELETE', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(true as any)
    
    await manager.provideVoiceUpdate({ 
      t: 'CHANNEL_DELETE', 
      d: { guild_id: 'g1', id: 'v1' } 
    } as any)
    
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.ChannelDeleted)
  })

  it('handles missing token and session_id', async () => {
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', user_id: BOT_ID } } as any)
    expect(debugSpy).toHaveBeenCalledWith('error', expect.stringContaining('provideVoiceUpdate'), expect.objectContaining({ consoleMessage: expect.stringContaining("no 'token' nor 'session_id'") }), expect.anything())
  })

  it('handles unknown player', async () => {
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'unknown', token: 't', endpoint: 'e', user_id: BOT_ID } } as any)
    expect(debugSpy).toHaveBeenCalledWith('warn', expect.stringContaining('provideVoiceUpdate'), expect.objectContaining({ consoleMessage: expect.stringContaining('No Audio Player found') }), expect.anything())
  })

  it('handles player in destroying state', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    player.setData('internal_destroystatus', true)
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't', endpoint: 'e', user_id: BOT_ID } } as any)
    expect(debugSpy).toHaveBeenCalledWith('warn', expect.stringContaining('provideVoiceUpdate'), expect.objectContaining({ message: expect.stringContaining('destroying state') }))
  })

  it('handles voice server update (missing sessionId/channelId)', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    
    // Explicitly clear sessionId to trigger failure
    // @ts-ignore
    player.voice.sessionId = null
    
    // Missing sessionId (using session_id to pass initial check)
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't', endpoint: 'e', user_id: BOT_ID, session_id: 's' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('log', 'RyanlinkManager > provideVoiceUpdate()', expect.objectContaining({ consoleMessage: 'Sent updatePlayer for voice token session', message: expect.stringContaining('Sent updatePlayer for voice token session') }), expect.anything())
    
    // Missing channelId
    player.voice.sessionId = 's1'
    player.voiceChannelId = null
    player.options.voiceChannelId = undefined
    // @ts-ignore
    player.voice.channelId = null
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't', endpoint: 'e', user_id: BOT_ID, session_id: 's' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('log', 'RyanlinkManager > provideVoiceUpdate()', expect.objectContaining({ consoleMessage: 'Sent updatePlayer for voice token session', message: expect.stringContaining('Sent updatePlayer for voice token session') }), expect.anything())
  })

  it('successfully updates player voice on server update', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    player.voice.sessionId = 's1'
    player.voice.channelId = 'v1'
    LavalinkMock.setResponse('/sessions/sess123/players/g1', {})
    const updateSpy = jest.spyOn(player.node, 'updatePlayer')
    
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't', endpoint: 'e', user_id: BOT_ID, session_id: 's1' } } as any)
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      playerOptions: expect.objectContaining({
        voice: expect.objectContaining({ token: 't', endpoint: 'e', sessionId: 's1' })
      })
    }))
  })

  it('handles other user voice join/leave', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const joinSpy = jest.fn()
    const leaveSpy = jest.fn()
    manager.on('playerVoiceJoin', joinSpy)
    manager.on('playerVoiceLeave', leaveSpy)

    // Other user joins our channel
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1', user_id: 'other', channel_id: 'v1', session_id: 's2' } } as any)
    expect(joinSpy).toHaveBeenCalledWith(player, 'other')

    // Other user joins DIFFERENT channel (leaves ours)
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1', user_id: 'other', channel_id: 'v2', session_id: 's2' } } as any)
    expect(leaveSpy).toHaveBeenCalledWith(player, 'other')
  })

  it('handles player movement and voice state changes', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const moveSpy = jest.fn()
    const muteSpy = jest.fn()
    const deafSpy = jest.fn()
    manager.on('playerMove', moveSpy)
    manager.on('playerMuteChange', muteSpy)
    manager.on('playerDeafChange', deafSpy)

    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { 
      guild_id: 'g1', 
      user_id: BOT_ID, 
      channel_id: 'v2', 
      session_id: 's1',
      self_mute: true,
      self_deaf: true
    } } as any)

    expect(moveSpy).toHaveBeenCalledWith(player, 'v1', 'v2')
    expect(muteSpy).toHaveBeenCalledWith(player, true, expect.anything())
    expect(deafSpy).toHaveBeenCalledWith(player, true, expect.anything())
    expect(player.voiceChannelId).toBe('v2')
  })

  it('handles disconnect and automatic destruction', async () => {
    manager.options.playerOptions.onDisconnect = { destroyPlayer: true }
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(true as any)
    
    // channel_id: null means disconnect
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { 
        guild_id: 'g1', 
        user_id: BOT_ID, 
        channel_id: null,
        session_id: 's1'
      } 
    } as any)
    
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.Disconnected)
  })

  it('handles manual disconnect and reset', async () => {
    manager.options.playerOptions.onDisconnect = { destroyPlayer: false, autoReconnect: false }
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const disconnectSpy = jest.fn()
    manager.on('playerDisconnect', disconnectSpy)
    
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1', user_id: BOT_ID, channel_id: null, session_id: 's1' } } as any)
    expect(disconnectSpy).toHaveBeenCalledWith(player, 'v1')
    expect(player.voiceChannelId).toBeNull()
  })

  it('handles auto-reconnect logic', async () => {
    manager.options.playerOptions.onDisconnect = { autoReconnect: true }
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    player.queue.current = { encoded: 'e' } as any
    
    jest.spyOn(player, 'connect').mockImplementation(async () => player as any)
    jest.spyOn(player, 'play').mockImplementation(async () => 'local' as any)
    
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1', user_id: BOT_ID, channel_id: null, session_id: 's1' } } as any)
    expect(player.connect).toHaveBeenCalled()
    expect(player.play).toHaveBeenCalled()
  })

  it('handles auto-reconnect failure', async () => {
    manager.options.playerOptions.onDisconnect = { autoReconnect: true }
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    
    jest.spyOn(player, 'connect').mockImplementation(() => Promise.reject(new Error('Connect failed')))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(true as any)
    
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1', user_id: BOT_ID, channel_id: null, session_id: 's1' } } as any)
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.PlayerReconnectFail)
    expect(console.error).toHaveBeenCalled()
  })
})
