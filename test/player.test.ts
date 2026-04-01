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

describe('Player', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    LavalinkMock.setResponse('/info', {
      version: { semver: '4.0.0' },
      sourceManagers: ['youtube', 'spotify', 'soundcloud', 'bandcamp'],
      filters: ['volume', 'timescale', 'equalizer'],
      plugins: [{ name: 'sponsorblock-plugin', version: '1.0' }]
    })

    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local' }],
      client: { id: '123' },
      sendToShard: jest.fn(),
    })
    await manager.init({ id: '123' })
    const node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'mock-session'
    // @ts-ignore
    // @ts-ignore
    node.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
    // Mock the info to pass pre-checks
    node.info = { 
      sourceManagers: ['ytsearch', 'youtube', 'spotify', 'soundcloud'], 
      filters: ['volume', 'timescale', 'equalizer'], 
      version: { major: 4 }, 
      plugins: [{ name: 'sponsorblock-plugin', version: '1.0' }] 
    } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('checks playback methods', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/g1', { guildId: 'g1' })
    
    // @ts-ignore
    await player.play({ clientTrack: { encoded: 'e', info: { title: 'T' } } as any })
    await player.pause()
    await player.resume().catch(() => {})
    // @ts-ignore
    player.queue.current.info.isSeekable = true
    // @ts-ignore
    player.queue.current.info.isStream = false
    await player.seek(100)
    await player.setVolume(50)
    // No 'stop' method in Player.ts, using destroy(false) to simulate stopping without disconnecting
    await player.destroy('finished', false)
  })

  it('handles player events', async () => {
    const player = manager.createPlayer({ guildId: 'ev1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'u')
    
    // @ts-ignore
    player.RyanlinkManager.emit('trackStart', player, track, { op: 'event', type: 'TrackStartEvent', guildId: 'ev1', track: track.encoded })
    // @ts-ignore
    player.RyanlinkManager.emit('trackEnd', player, track, { op: 'event', type: 'TrackEndEvent', guildId: 'ev1', track: track.encoded, reason: 'finished' })
    // @ts-ignore
    player.RyanlinkManager.emit('trackError', player, track, { op: 'event', type: 'TrackExceptionEvent', guildId: 'ev1', track: track.encoded, exception: { severity: 'COMMON', message: 'err', cause: 'none', causeStackTrace: '' } })
    // @ts-ignore
    player.RyanlinkManager.emit('trackStuck', player, track, { op: 'event', type: 'TrackStuckEvent', guildId: 'ev1', track: track.encoded, thresholdMs: 1000 })
    
    // playerDisconnect only takes two arguments in ManagerEvents
    player.RyanlinkManager.emit('playerDisconnect', player, 'v1')
  })

  it('handles sponsorblock methods', async () => {
    const player = manager.createPlayer({ guildId: 'sb1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/sb1/sponsorblock', [])
    await player.setSponsorBlock(['sponsor'])
    expect(await player.getSponsorBlock()).toBeDefined()
    await player.deleteSponsorBlock()
  })

  // ─── Autoplay ─────────────────────────────────────────────────────────────
  
  it('handles autoplay logic (Spotify & YouTube recommendations)', async () => {
    const { Autoplay } = await import('../src/audio/Player')
    const player = manager.createPlayer({ guildId: 'ap1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/ap1', {})
    
    // Set permissive config
    manager.options.playerOptions.autoplayConfig = {
      enabled: true,
      limit: 5,
      minDuration: 0,
      maxDuration: 9000000,
      excludeKeywords: []
    }
    
    const track = manager.utils.buildTrack({ 
      encoded: 'e1', 
      info: { title: 'T', author: 'A', identifier: 'i1', sourceName: 'spotify' } 
    } as any, 'u')

    const searchSpy = jest.spyOn(player, 'search').mockImplementation(async (query) => {
      const q = typeof query === 'string' ? query : query.query
      if (typeof q === 'string' && q.startsWith('sprec:')) {
        return { 
          loadType: 'search', 
          tracks: [{ encoded: 'esp', info: { title: 'Sp', author: 'Asp', identifier: 's1', duration: 100000, isSeekable: true, isStream: false } }] 
        } as any
      }
      return { 
        loadType: 'playlist', 
        tracks: [{ encoded: 'eyt', info: { title: 'Yt', author: 'Ayt', identifier: 'y2', duration: 100000, isSeekable: true, isStream: false } }] 
      } as any
    })

    // @ts-ignore
    await Autoplay.defaultAutoplay(player, track)
    expect(searchSpy).toHaveBeenCalled()
    expect(player.queue.current || player.queue.tracks.length > 0).toBeTruthy()
  })

  // ─── Filters Reset Logic ──────────────────────────────────────────────────
  
  it('resets nightcore/vaporwave when timescale changes manually', async () => {
    const player = manager.createPlayer({ guildId: 'fr1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/mock-session/players/fr1', {})
    
    await player.filterManager.toggleNightcore()
    expect(player.filterManager.filters.nightcore).toBe(true)
    
    await player.filterManager.setPitch(1.2)
    expect(player.filterManager.filters.nightcore).toBe(false)
  })

  it('handles additional filters (lowPass, tremolo, karaoke)', async () => {
    const player = manager.createPlayer({ guildId: 'af1', voiceChannelId: 'v1' })
    const node = player.node as any
    // Ensure filters are in the mock info to pass the check
    if (!node.info.filters.includes('lowPass')) node.info.filters.push('lowPass', 'tremolo', 'karaoke')
    
    LavalinkMock.setResponse('/sessions/mock-session/players/af1', {})
    
    await player.filterManager.toggleLowPass(10)
    expect(player.filterManager.filters.lowPass).toBe(true)
    
    await player.filterManager.toggleTremolo(4, 0.8)
    expect(player.filterManager.filters.tremolo).toBe(true)
    
    await player.filterManager.toggleKaraoke(1, 1, 220, 100)
    expect(player.filterManager.filters.karaoke).toBe(true)
  })

  // ─── moveNode and changeNode Error Handling ──────────────────────────────
  
  it('throws Error when moveNode has no target nodes', async () => {
    const player = manager.createPlayer({ guildId: 'mv1', voiceChannelId: 'v1' })
    // Ensure leastUsedNodes branch is hit and fails due to no other nodes
    await expect(player.moveNode()).rejects.toThrow(/No nodes are available/)
  })

  it('handles changeNode execution failures', async () => {
    const player = manager.createPlayer({ guildId: 'cn1', voiceChannelId: 'v1' })
    // Set dummy voice data to bypass "Voice Data is missing" check
    player.voice = { sessionId: 's', endpoint: 'e', token: 't' }
    
    // Ensure the node has some mock info to pass the initial source check
    const badNode = { 
      id: 'bad', 
      options: { id: 'bad' }, 
      connected: true,
      info: { sourceManagers: ['ytsearch', 'youtube', 'spotify'] }
    } as any
    // This will fail because badNode.updatePlayer is not a function
    await expect(player.changeNode(badNode)).rejects.toThrow('Failed to change the node')
  })

  // ─── Extra Autoplay Logic (Duration Limits & Errors) ────────────────────
  
  it('filters recommendations by duration limits', async () => {
    const { Autoplay } = await import('../src/audio/Player')
    const player = manager.createPlayer({ guildId: 'ad1', voiceChannelId: 'v1' })
    manager.options.playerOptions.autoplayConfig = {
      enabled: true,
      minDuration: 500000, // Very high min duration
      maxDuration: 1000000,
      excludeKeywords: []
    }
    
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T', author: 'A', sourceName: 'youtube' } } as any, 'u')
    jest.spyOn(player, 'search').mockResolvedValue({ 
      loadType: 'playlist', 
      tracks: [{ encoded: 'e_too_short', info: { duration: 100000, title: 'S', author: 'A' } }] 
    } as any)

    // @ts-ignore
    await Autoplay.defaultAutoplay(player, track)
    expect(player.queue.tracks.length).toBe(0) // Should be filtered out
  })

  it('emits debug event on autoplay errors', async () => {
    const { Autoplay } = await import('../src/audio/Player')
    const player = manager.createPlayer({ guildId: 'ae1', voiceChannelId: 'v1' })
    manager.options.playerOptions.autoplayConfig.enabled = true
    
    let debugEmitted = false
    player.RyanlinkManager.on('debug', (event) => {
      if (String(event) === 'AutoplayError') debugEmitted = true
    })

    // Force error in fetchCandidates
    jest.spyOn(Autoplay as any, 'fetchCandidates').mockImplementation(() => {
      throw new Error('Forced Autoplay failure')
    })

    const track = manager.utils.buildTrack({ encoded: 'e', info: { sourceName: 'youtube' } } as any, 'u')
    // @ts-ignore
    await Autoplay.defaultAutoplay(player, track)
    
    expect(debugEmitted).toBe(true)
  })

  // ─── Change Node Sources check ────────────────────────────────────────────

  it('checks sources when changing node', async () => {
    const node2 = manager.nodeManager.createNode({ host: 'other2', port: 2333, authorization: 'pw', id: 'other2' })
    node2.sessionId = 'other2-session'
    // @ts-ignore
    // @ts-ignore
    node2.socket = { readyState: 1, on: jest.fn(), send: jest.fn(), close: jest.fn(), removeAllListeners: jest.fn() } as any
    // Enable 'youtube' specifically to bypass the 'ytsearch' check in validateSourceString
    node2.info = { sourceManagers: ['soundcloud', 'youtube'], filters: ['volume'], version: { major: 4 }, plugins: [] } as any

    const player = manager.createPlayer({ guildId: 'ch2', voiceChannelId: 'v1' })
    player.queue.current = manager.utils.buildTrack({ encoded: 'en', info: { sourceName: 'bandcamp' } } as any, 'u')
    
    await expect(player.changeNode('other2', true)).rejects.toThrow(/Sources missing for Node other2: bandcamp/)
  })
})
