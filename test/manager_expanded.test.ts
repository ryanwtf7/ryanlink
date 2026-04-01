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
import { DebugEvents } from '../src/config/Constants'

describe('Manager Expanded', () => {
  let manager: RyanlinkManager

  beforeEach(() => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
      advancedOptions: { enableDebugEvents: true }
    })
    manager.nodeManager.on('error', () => {}) // Prevent unhandled error events
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('init() handles total node connection failure', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    jest.spyOn(node, 'connect').mockImplementation(() => Promise.reject(new Error('Connection failed')))
    
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)

    await manager.init({ id: 'bot123' })
    
    expect(manager.initiated).toBe(false)
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.FailedToConnectToNodes, expect.objectContaining({
      state: 'error',
      message: 'Failed to connect to at least 1 Node'
    }))
  })

  it('provideVoiceUpdate() handles uninitiated manager', async () => {
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    // manager.initiated is false by default
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: {} } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: 'Manager is not initated yet'
    }))
  })

  it('provideVoiceUpdate() handles missing "t" in payload', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ d: {} } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: "No 't' in payload-data of the raw event:"
    }))
  })

  it('provideVoiceUpdate() handles missing update data', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE' } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("No 'token' nor 'session_id' found in payload")
    }))
  })

  it('provideVoiceUpdate() handles missing token and session_id', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("No 'token' nor 'session_id' found")
    }))
  })

  it('provideVoiceUpdate() handles missing player for guild', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'not_found', session_id: 's1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("No Audio Player found")
    }))
  })

  it('provideVoiceUpdate() handles missing sessionId or channelId for updatePlayer', async () => {
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
    // @ts-ignore
    node.sessionId = 'node_sess'

    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    
    const debugSpy = jest.fn()
    manager.on('debug', debugSpy)
    
    // Test Missing sessionId
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      state: 'warn',
      message: expect.stringContaining("Voice Server Update received, but some required fields are missing")
    }))

    // Test Missing channelId
    player.voice.sessionId = 's1'
    player.voiceChannelId = null
    player.options.voiceChannelId = undefined
    // @ts-ignore
    player.voice.channelId = null
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      state: 'warn',
      message: expect.stringContaining("Voice Server Update received, but some required fields are missing")
    }))
  })

  it('provideVoiceUpdate() handles autoPauseOnMute logic', async () => {
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.isAlive = true
    node.sessionId = 'sess123'
    // @ts-ignore
    if (node.socket) node.socket.readyState = 1
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    player.options.autoPauseOnMute = true
    
    const pauseSpy = jest.spyOn(player, 'pause').mockImplementation(async () => ({}) as any)
    const resumeSpy = jest.spyOn(player, 'resume').mockImplementation(async () => ({}) as any)
    
    // Simulate mute
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v1', self_mute: true, user_id: 'bot123' } 
    } as any)
    
    expect(pauseSpy).toHaveBeenCalled()
    
    // Simulate unmute
    player.voiceState.selfMute = true // Ensure change is detected
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v1', self_mute: false, user_id: 'bot123' } 
    } as any)
    
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('provideVoiceUpdate() handles CHANNEL_DELETE', async () => {
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.isAlive = true
    node.sessionId = 'sess123'
    // @ts-ignore
    if (node.socket) node.socket.readyState = 1
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined as any)

    await manager.provideVoiceUpdate({ 
      t: 'CHANNEL_DELETE', 
      d: { guild_id: 'g1', id: 'v1' } 
    } as any)
    
    expect(destroySpy).toHaveBeenCalledWith(expect.stringContaining('ChannelDeleted'))
  })

  it('provideVoiceUpdate() handles smartLeave and autoPause on empty channel', async () => {
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.isAlive = true
    node.sessionId = 'sess123'
    // @ts-ignore
    if (node.socket) node.socket.readyState = 1
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    
    // Mock getVoiceStateUsers to return only the bot (length 1)
    jest.spyOn(manager, 'getVoiceStateUsers').mockReturnValue([{ userId: 'bot123' } as any])
    
    // Test smartLeave
    player.options.smartLeave = true
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined as any)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v2', user_id: 'user123' } 
    } as any)
    
    expect(destroySpy).toHaveBeenCalledWith(expect.stringContaining('smartLeave'))

    // Test autoPause
    player.options.smartLeave = false
    player.options.autoPause = true
    const pauseSpy = jest.spyOn(player, 'pause').mockImplementation(async () => ({}) as any)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v2', user_id: 'user123' } 
    } as any)
    
    expect(pauseSpy).toHaveBeenCalled()
  })
})
