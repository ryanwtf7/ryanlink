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
import { DestroyReasons, DebugEvents } from '../src/config/Constants'
import { Autoplay } from '../src/audio/Player'
import { RyanlinkNode } from '../src/node/Node'

describe('Player Expanded', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ 
        host: 'localhost', id: 'local', port: 2333, authorization: 'pw',
        autoChecks: { sourcesValidations: true }
      }],
      sendToShard: jest.fn(),
    })
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')! as RyanlinkNode
    node.sessionId = 'sess123'
    node.info = { sourceManagers: ['youtube'], plugins: [] } as any
    // Add minimal socket interface to prevent heartbeat crash
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn(), removeListener: jest.fn() } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles playback control (pause, resume, seek, volume)', async () => {
    const player = manager.createPlayer({ guildId: 'p1', voiceChannelId: 'v1' })
    player.queue.current = { encoded: 'e', info: { isSeekable: true, isStream: false, duration: 10000 } } as any
    LavalinkMock.setResponse('/sessions/sess123/players/p1', {})

    await player.pause()
    expect(player.paused).toBe(true)
    
    await expect(player.pause()).resolves.toBe(player)

    await player.resume()
    expect(player.paused).toBe(false)
    
    await expect(player.resume()).rejects.toThrow("Player isn't paused")

    await player.seek(5000)
    await player.setVolume(50)
    expect(player.volume).toBe(50)
  })

  it('handles search with Bandcamp fallback', async () => {
    const player = manager.createPlayer({ guildId: 'p2', voiceChannelId: 'v1' })
    const node = player.node as any
    
    const globalFetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('bandcamp.com')) {
        return {
          ok: true,
          json: async () => ({ results: [{ type: 't', name: 'Song', band_name: 'Artist', url: 'https://bc.com/1', id: 123, img: 'art' }] })
        } as any
      }
      return { ok: true, status: 200, json: async () => ({}) } as any
    })

    const result = await player.search({ query: 'test', source: 'bandcamp' }, 'user')
    expect(result.tracks[0].info.title).toBe('Song')
    globalFetchSpy.mockRestore()
  })



  it('handles seek errors and clamping', async () => {
    const player = manager.createPlayer({ guildId: 'p4', voiceChannelId: 'v1' })
    player.node.sessionId = 'sess123'
    LavalinkMock.setResponse('/sessions/sess123/players/p4', {})
    
    // Test 1: No track -> returns undefined in code
    player.queue.current = null
    await expect(player.seek(100)).resolves.toBeUndefined()
    
    // Test 2: Not seekable -> throws
    player.queue.current = { encoded: 'e', info: { isSeekable: false, isStream: false } } as any
    await expect(player.seek(100)).rejects.toThrow("not seekable")
    
    // Test 3: Stream -> throws
    player.queue.current = { encoded: 'e', info: { isSeekable: true, isStream: true } } as any
    await expect(player.seek(100)).rejects.toThrow("a stream")

    // Test 4: Clamping
    player.queue.current = { encoded: 'e', info: { isSeekable: true, isStream: false, duration: 1000 } } as any
    await player.seek(2000)
    expect(player.position).toBeGreaterThanOrEqual(1000)
    expect(player.position).toBeLessThan(1050)
  })

  it('handles moveNode() branches', async () => {
    const player = manager.createPlayer({ guildId: 'move1', voiceChannelId: 'v1' })
    
    // Same node early return
    await expect(player.moveNode('local')).resolves.toBe(player)

    // No other nodes available
    await expect(player.moveNode('non-existent')).rejects.toThrow("No nodes are available")
  })

  it('handles Autoplay logic and filtering', async () => {
    const player = manager.createPlayer({ guildId: 'auto1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ 
      encoded: 'id1_encoded',
      info: { 
        identifier: 'id1', 
        sourceName: 'youtube', 
        title: 'Song', 
        author: 'Artist',
        duration: 30000 
      } 
    } as any, 'user')
    
    // Build the candidate pool directly — bypass the multi-source fetch chain
    const candidates = [
      { encoded: 'rel1_e', info: { identifier: 'rel1', title: 'Related', author: 'Artist', duration: 40000, sourceName: 'youtube' } },
      { encoded: 'short_e', info: { identifier: 'short', title: 'Short', author: 'Artist', duration: 5000, sourceName: 'youtube' } }, // filtered: too short
      { encoded: 'id1_e', info: { identifier: 'id1', title: 'Song', author: 'Artist', duration: 30000, sourceName: 'youtube' } }, // filtered: in history (current)
      { encoded: 'skip_e', info: { identifier: 'skip', title: 'Skip THIS', author: 'Artist', duration: 50000, sourceName: 'youtube' } }, // filtered: keyword
    ].map(t => manager.utils.buildTrack(t as any, 'user'))
    
    // Spy on the private fetchCandidates to control the candidate pool precisely
    // @ts-ignore
    jest.spyOn(Autoplay, 'fetchCandidates').mockResolvedValue(candidates)
    
    player.queue.current = track
    
    manager.options.playerOptions.autoplayConfig = { 
      enabled: true, 
      limit: 5,
      minDuration: 20000,
      excludeKeywords: ['SKIP']
    }

    await Autoplay.defaultAutoplay(player, track)
    
    // Only 'Related' should survive filtering (short filtered by minDuration, id1 by history, skip by keyword)
    expect(player.queue.tracks.length).toBe(1)
    expect(player.queue.tracks[0].info.identifier).toBe('rel1')
  })

  it('handles Autoplay search fallback and errors', async () => {
    const localManager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
    })
    await localManager.init({ id: 'bot123' })
    const node = localManager.nodeManager.nodes.get('local')!
    // @ts-ignore
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn(), removeListener: jest.fn() } as any
    // @ts-ignore
    node.sessionId = 'sess123'
    
    const player = localManager.createPlayer({ guildId: 'auto_err', voiceChannelId: 'v1' })
    const track = localManager.utils.buildTrack({ encoded: 'id2_e', info: { identifier: 'id2', sourceName: 'unknown', author: 'Artist', title: 'Original' } } as any, 'user')
    
    jest.spyOn(player, 'search').mockResolvedValue({ 
      loadType: 'search', 
      tracks: [localManager.utils.buildTrack({ encoded: 'art1_e', info: { identifier: 'art1', title: 'Art', author: 'Artist', duration: 30000, sourceName: 'youtube' } } as any, 'user')] 
    } as any)
    
    localManager.options.playerOptions.autoplayConfig = { enabled: true }
    await Autoplay.defaultAutoplay(player, track)
    
    // Autoplay.add is not awaited internally, and it may trigger play() which shifts the queue
    let retries = 10
    while (retries-- > 0 && player.queue.tracks.length === 0 && player.queue.current?.info.identifier !== 'art1') {
      await new Promise(r => setTimeout(r, 100))
    }
    
    expect(player.queue.current?.info.identifier).toBe('art1')
  })

  it('handles Autoplay search errors', async () => {
    const localManager = new RyanlinkManager({
      client: { id: 'error-bot' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
    })
    await localManager.init({ id: 'error-bot' })
    const node = localManager.nodeManager.nodes.get('local')!
    // @ts-ignore
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn(), removeListener: jest.fn() } as any
    // @ts-ignore
    node.sessionId = 'err-sess'
    
    const player = localManager.createPlayer({ guildId: 'auto_fail', voiceChannelId: 'v1' })
    const track = localManager.utils.buildTrack({ encoded: 'id_fail_e', info: { identifier: 'id_fail', sourceName: 'unknown', author: 'Artist', title: 'Fail' } } as any, 'user')
    
    // Spy on fetchCandidates (the actual private method) to simulate a fetch error
    // @ts-ignore
    const fetchSpy = jest.spyOn(Autoplay, 'fetchCandidates').mockRejectedValue(new Error('Fetch failed'))
    const debugSpy = jest.spyOn(localManager, 'emit')
    
    // @ts-ignore
    Autoplay.adding.clear()
    
    await Autoplay.defaultAutoplay(player, track)
    expect(debugSpy).toHaveBeenCalledWith('debug', 'AutoplayError', expect.anything())
    fetchSpy.mockRestore()
  })
})
