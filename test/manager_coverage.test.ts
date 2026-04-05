import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'

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

describe('Manager Coverage Expansion', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn()
    })
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'mock-session'
    node.info = { sourceManagers: ['youtube'], plugins: [], filters: ['volume', 'timescale'] } as any
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles search with invalid parameters', async () => {
    // @ts-ignore
    await expect(manager.search(null)).rejects.toThrow()
  })

  it('handles search errors from node', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    jest.spyOn(node, 'request').mockRejectedValue(new Error('Search Fail'))
    
    await expect(manager.search('test')).rejects.toThrow('Search Fail')
  })

  it('handles empty search results', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    jest.spyOn(node, 'request').mockResolvedValue({ loadType: 'empty', data: [] })
    
    const result = await manager.search('test')
    expect(result.loadType).toBe('empty')
  })

  it('handles plugins and search logic with specific source', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const requestSpy = jest.spyOn(node, 'request').mockResolvedValue({ loadType: 'search', data: [{ encoded: 'abc', info: { title: 'T' } }] })
    
    await manager.search({ query: 'test', source: 'youtube' })
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('ytsearch'), expect.any(Function))
  })

  it('checks for plugins and sources correctly', () => {
    const node = manager.nodeManager.nodes.get('local')!
    node.info = { sourceManagers: ['youtube'], plugins: [{ name: 'spotify-plugin' }] } as any
    expect(manager.utils.validateSourceString(node, 'youtube')).toBeUndefined()
    expect(manager.utils.validateSourceString(node, 'spotify')).toBeUndefined() // supported by spotify-plugin mock
    expect(() => manager.utils.validateSourceString(node, 'unknown' as any)).toThrow()
  })

  it('handles player destruction from manager', async () => {
    const player = manager.createPlayer({ guildId: 'd1', voiceChannelId: 'v1' })
    expect(manager.players.has('d1')).toBe(true)
    
    await player.destroy()
    expect(manager.players.has('d1')).toBe(false)
  })

  it('handles mute/deaf changes in provideVoiceUpdate', async () => {
    const player = manager.createPlayer({ guildId: 'mv1', voiceChannelId: 'v1' })
    const emitSpy = jest.spyOn(manager, 'emit')
    
    await manager.provideVoiceUpdate({
        t: 'VOICE_STATE_UPDATE',
        d: {
            guild_id: 'mv1',
            user_id: 'bot123',
            channel_id: 'v1',
            self_mute: true,
            self_deaf: true,
            session_id: 'sess'
        }
    } as any)
    
    expect(emitSpy).toHaveBeenCalledWith('playerMuteChange', expect.anything(), true, false)
    expect(emitSpy).toHaveBeenCalledWith('playerDeafChange', expect.anything(), true, false)
  })
})
