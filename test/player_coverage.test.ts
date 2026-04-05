import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { DestroyReasons, DebugEvents } from '../src/config/Constants'
import { RyanlinkNode } from '../src/node/Node'

jest.mock('ws', () => {
  const { EventEmitter } = require('node:events')
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1
    public static CLOSED = 3
    public readyState = 1
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
    ping = jest.fn()
  }
  return { __esModule: true, default: MockWebSocket, WebSocket: MockWebSocket }
})

describe('Player Coverage Expansion', () => {
  let manager: RyanlinkManager
  let node: RyanlinkNode

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn()
    })
    await manager.init({ id: 'bot123' })
    node = manager.nodeManager.nodes.get('local')! as RyanlinkNode
    node.sessionId = 'mock-session'
    node.info = { filters: ['volume', 'timescale'], sourceManagers: ['youtube'], plugins: [] } as any
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles metadata operations (setData, getData, clearData)', () => {
    const player = manager.createPlayer({ guildId: 'd1', voiceChannelId: 'v1' })
    player.setData('key1', 'val1')
    expect(player.getData('key1')).toBe('val1')
    player.clearData()
    expect(player.getData('key1')).toBeUndefined()
  })

  it('handles voice updates (setVoiceChannel) and disconnect', async () => {
    const player = manager.createPlayer({ guildId: 'v1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/v1', {})
    
    await player.setVoiceChannel({
      voiceChannelId: 'v2',
      selfDeaf: true
    })
    expect(player.voiceChannelId).toBe('v2')

    await player.disconnect()
    expect(player.voiceChannelId).toBeNull()
  })

  it('handles destroy with different reasons and flags', async () => {
    const player = manager.createPlayer({ guildId: 'des1', voiceChannelId: 'v1' })
    const emitSpy = jest.spyOn(manager, 'emit')
    
    await player.destroy(DestroyReasons.Disconnected, false)
    expect(emitSpy).toHaveBeenCalledWith('playerDestroy', player, DestroyReasons.Disconnected)
  })

  it('handles ping calculations', () => {
    const player = manager.createPlayer({ guildId: 'p1', voiceChannelId: 'v1' })
    player.ping.ws = 50
    expect(player.ping.ws).toBe(50)
  })

  it('toJSON returns full structure', () => {
    const player = manager.createPlayer({ guildId: 'j1', voiceChannelId: 'v1' })
    const json = player.toJSON()
    expect(json).toHaveProperty('guildId', 'j1')
    expect(json).toHaveProperty('voiceChannelId', 'v1')
  })

  it('handles filter interaction via filterManager', async () => {
    const player = manager.createPlayer({ guildId: 'f1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/f1', {})
    
    await player.filterManager.setSpeed(1.2)
    expect(player.filterManager.data.timescale?.speed).toBe(1.2)
  })

  it('handles playback failure branches (Paused/Seek error)', async () => {
    const player = manager.createPlayer({ guildId: 'e1', voiceChannelId: 'v1' })
    jest.spyOn(node, 'updatePlayer').mockRejectedValue(new Error('REST Fail'))
    
    await expect(player.pause()).rejects.toThrow('REST Fail')
    
    player.queue.current = { encoded: 'abc', info: { isSeekable: true, isStream: false, duration: 1000 } } as any
    await expect(player.seek(100)).rejects.toThrow('REST Fail')
  })

  it('handles autoResume', async () => {
    const player = manager.createPlayer({ guildId: 'ar1', voiceChannelId: 'v1' })
    // @ts-ignore
    jest.spyOn(player.queue.utils, 'sync').mockResolvedValue({})
    jest.spyOn(player, 'play').mockResolvedValue(player)
    
    await expect(player.autoResume()).resolves.toBe(player)
  })
})
