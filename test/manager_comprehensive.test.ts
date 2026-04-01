import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { DestroyReasons, DebugEvents } from '../src/config/Constants'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

jest.mock('ws', () => {
  const { EventEmitter } = require('node:events')
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1
    public static CLOSED = 3
    public readyState = 0
    constructor(public url: string, public options: any) {
       super()
       this.readyState = 1
       process.nextTick(() => {
         this.emit('open')
         this.emit('message', JSON.stringify({ 
           op: 'ready', 
           sessionId: 'mock-session', 
           resumed: false,
           info: {
             version: { semver: '4.0.0' },
             plugins: []
           }
         }))
       })
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
    OPEN: 1,
    CLOSED: 3,
  }
})

describe('RyanlinkManager Comprehensive', () => {
  let manager: RyanlinkManager

  beforeEach(() => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
      playerOptions: {
        onDisconnect: {
          autoReconnect: true,
          autoReconnectOnlyWithTracks: true,
          destroyPlayer: false
        }
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('init() handles node connection failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const MockNode = Array.from(manager.nodeManager.nodes.values())[0]
    jest.spyOn(MockNode, 'connect').mockImplementation(() => Promise.reject(new Error('Connect failed')))
    manager.nodeManager.on('error', () => {}) // Prevent unhandled error event crash
    await manager.init({ id: 'bot123' })
    expect(errorSpy).toHaveBeenCalled()
    expect(manager.initiated).toBe(false)
  })

  it('provideVoiceUpdate() handles uninitiated manager', async () => {
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: {} } as any)
    expect(debugSpy).toHaveBeenCalledWith('log', expect.anything(), expect.objectContaining({ message: expect.stringContaining('initated') }))
  })

  it('provideVoiceUpdate() handles missing session/channel ID', async () => {
    await manager.init({ id: 'bot123' })
    await wait(10)
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const debugSpy = jest.spyOn(manager as any, '_debugNoAudio')

    // Missing token/session_id
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('error', expect.anything(), expect.objectContaining({ message: expect.stringContaining('token') }), expect.anything())

    // Missing session_id for VOICE_SERVER_UPDATE
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('error', expect.anything(), expect.objectContaining({ message: expect.stringContaining('sessionId') }), expect.anything())
  })

  it('provideVoiceUpdate() handles autoPauseOnMute logic', async () => {
    await manager.init({ id: 'bot123' })
    await wait(10)
    const player = manager.createPlayer({ guildId: 'pause1', voiceChannelId: 'v1' })
    player.options.autoPauseOnMute = true
    const pauseSpy = jest.spyOn(player, 'pause').mockImplementation(async () => ({}) as any)
    const resumeSpy = jest.spyOn(player, 'resume').mockImplementation(async () => ({}) as any)

    // Mute on
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'pause1', channel_id: 'v1', user_id: 'bot123', session_id: 's1', self_mute: true } 
    } as any)
    expect(pauseSpy).toHaveBeenCalled()

    // Mute off
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'pause1', channel_id: 'v1', user_id: 'bot123', session_id: 's1', self_mute: false } 
    } as any)
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('provideVoiceUpdate() handles autoReconnect track dependency', async () => {
    await manager.init({ id: 'bot123' })
    await wait(10)
    const player = manager.createPlayer({ guildId: 'recon1', voiceChannelId: 'v1' })
    const connectSpy = jest.spyOn(player, 'connect').mockResolvedValue(player as any)
    
    // Disconnect without tracks (should not reconnect due to autoReconnectOnlyWithTracks: true)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'recon1', channel_id: null, user_id: 'bot123', session_id: 's1' } 
    } as any)
    expect(connectSpy).not.toHaveBeenCalled()

    // Add track and disconnect (should reconnect)
    await player.queue.add(manager.utils.buildTrack({ encoded: 'e2', info: { title: 'T2' } } as any, 'u'))
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'recon1', channel_id: null, user_id: 'bot123', session_id: 's1' } 
    } as any)
    expect(connectSpy).toHaveBeenCalled()
  })

  it('provideVoiceUpdate() handles playerVoiceJoin/Leave', async () => {
    await manager.init({ id: 'bot123' })
    await wait(10)
    const player = manager.createPlayer({ guildId: 'voice1', voiceChannelId: 'v1' })
    const emitSpy = jest.spyOn(manager, 'emit')

    // Join
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'voice1', channel_id: 'v1', user_id: 'other_user', session_id: 's1' } 
    } as any)
    expect(emitSpy).toHaveBeenCalledWith('playerVoiceJoin', player, 'other_user')

    // Leave
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'voice1', channel_id: 'v2', user_id: 'other_user', session_id: 's1' } 
    } as any)
    expect(emitSpy).toHaveBeenCalledWith('playerVoiceLeave', player, 'other_user')
  })
})
