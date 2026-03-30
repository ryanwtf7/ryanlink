import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { DestroyReasons } from '../src/config/Constants'

vi.mock('ws', () => {
  const { EventEmitter } = require('node:events')
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1
    public static CLOSED = 3
    public readyState = 1
    constructor() {
       super()
    }
    send = vi.fn()
    close = vi.fn()
    terminate = vi.fn()
  }
  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  }
})

describe('RyanlinkManager', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    LavalinkMock.setResponse('/info', {
      version: { semver: '4.0.0' },
      sourceManagers: ['youtube'],
      filters: ['volume'],
      plugins: [],
    })
    
    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local' }],
      client: { id: '123' },
      sendToShard: vi.fn(),
      playerOptions: {
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false
        }
      }
    })
    const node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'mock-session'
    // @ts-ignore
    node.socket = { readyState: 1, send: vi.fn(), close: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn(), emit: vi.fn() }
    manager.initiated = true
  })

  it('initializes and manages players', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    expect(manager.getPlayer('g1')).toBe(player)
    await manager.destroyPlayer('g1')
    expect(manager.getPlayer('g1')).toBeUndefined()
  })

  it('handles CHANNEL_DELETE voice update', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const destroySpy = vi.spyOn(player, 'destroy').mockResolvedValue(undefined as any)
    
    await manager.provideVoiceUpdate({ t: 'CHANNEL_DELETE', d: { guild_id: 'g1', id: 'vc1' } })
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.ChannelDeleted)
  })

  it('handles VOICE_SERVER_UPDATE', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    player.voice.sessionId = 's1' 
    player.voice.channelId = 'vc1' // MUST be set
    const node = player.node!
    const updateSpy = vi.spyOn(node, 'updatePlayer').mockResolvedValue({} as any)

    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    })

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      guildId: 'g1',
      playerOptions: {
        voice: expect.objectContaining({
          token: 't1',
          endpoint: 'e1'
        })
      }
    }))
  })

  it('handles VOICE_STATE_UPDATE (user join/leave)', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    
    const joinSpy = vi.fn()
    manager.on('playerVoiceJoin', joinSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc1', user_id: '456', session_id: 's2' } 
    })
    expect(joinSpy).toHaveBeenCalledWith(player, '456')

    const leaveSpy = vi.fn()
    manager.on('playerVoiceLeave', leaveSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc2', user_id: '456', session_id: 's2' } 
    })
    expect(leaveSpy).toHaveBeenCalledWith(player, '456')
  })

  it('handles VOICE_STATE_UPDATE (self move)', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const moveSpy = vi.fn()
    manager.on('playerMove', moveSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc2', user_id: '123', session_id: 's1' } 
    })
    expect(moveSpy).toHaveBeenCalledWith(player, 'vc1', 'vc2')
    expect(player.voiceChannelId).toBe('vc2')
  })

  it('handles mute/deaf changes', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const muteSpy = vi.fn()
    manager.on('playerMuteChange', muteSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc1', user_id: '123', self_mute: true, mute: false, session_id: 's1' } 
    })
    expect(muteSpy).toHaveBeenCalled()
  })

  it('handles autoReconnect on disconnect', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    vi.spyOn(player, 'play').mockResolvedValue(player as any)
    const connectSpy = vi.spyOn(player, 'connect').mockResolvedValue(true as any)
    
    // Disconnect packet
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: null, user_id: '123', session_id: 's1' } 
    })
    
    expect(connectSpy).toHaveBeenCalled()
  })

  it('handles invalid voice updates gracefully', async () => {
    await manager.provideVoiceUpdate({} as any)
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'unknown' } })
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1' } } as any)
  })
})
