import { RyanlinkManager } from '../src/core/Manager'
import { waitForNode } from './utils'
import { once } from 'node:events'

vi.mock('ws', () => {
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
           }))
         }, 10)
       }, 5)
    }
    send = vi.fn()
    close = vi.fn((code, reason) => { 
      this.readyState = 3
      this.emit('close', code, reason) 
    })
    terminate = vi.fn(() => this.close(1006, 'term'))
    ping = vi.fn(() => this.emit('pong'))
  }
  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  }
})

describe('RyanlinkNode', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    // Mock fetch
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      
      if (path.endsWith('/decodetracks')) return { status: 200, ok: true, json: async () => [{ encoded: 'some-base64', info: { title: 'Decoded' } }] }
      if (path.includes('/decodetrack')) return { status: 200, ok: true, json: async () => ({ encoded: 'some-base64', info: { title: 'Decoded' } }) }
      if (path.includes('/lyrics')) return { status: 200, ok: true, json: async () => ({ text: 'Lyrics Content' }) }
      if (path.includes('/sponsorblock')) return { status: 200, ok: true, json: async () => [{ category: 'sponsor', start: 0, end: 10 }] }
      if (path.includes('/stats')) return { status: 200, ok: true, json: async () => ({ players: 1, playingPlayers: 1, memory: { used: 100, allocated: 200, reservable: 300, free: 100 }, cpu: { cores: 4, audioLoad: 0.1, systemLoad: 0.1 }, uptime: 1000 }) }
      if (path.includes('/version')) return { status: 200, ok: true, text: async () => '4.0.0', json: async () => ({ version: '4.0.0' }) }
      if (path.includes('/connection')) return { status: 200, ok: true, json: async () => ({ systemLoad: 0.1 }) }

      if (path.includes('players')) {
        if (options?.method === 'GET') {
          if (path.endsWith('players')) return { status: 200, ok: true, json: async () => [{ guildId: 'g1', volume: 100 }] }
          return { status: 200, ok: true, json: async () => ({ guildId: 'g1', volume: 100 }) }
        }
        if (options?.method === 'PATCH') return { status: 200, ok: true, json: async () => ({ guildId: 'g1', volume: 50 }) }
        if (options?.method === 'DELETE' || options?.method === 'PUT') return { status: 204, ok: true, json: async () => ({}) }
      }
      if (path.includes('sessions/')) return { status: 200, ok: true, json: async () => ({ resuming: true, timeout: 60 }) }
      if (path.includes('/info')) return { status: 200, ok: true, json: async () => ({ version: { semver: '4.0.0' }, sourceManagers: ['youtube'], plugins: [{ name: 'lavalyrics-plugin' }, { name: 'sponsorblock-plugin' }, { name: 'source-engine' }] }) }
      
      return { status: 404, ok: false, json: async () => ({ error: 'Not Found' }) }
    })

    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local', retryAmount: 2, retryDelay: 10, heartBeatInterval: 0 }],
      client: { id: '123' },
      sendToShard: vi.fn(),
    })
    
    await manager.init({ id: '123' })
    const node = manager.nodeManager.nodes.get('local')!
    await waitForNode(node)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    const node = manager.nodeManager.nodes.get('local')
    if (node) {
      if ((node as any).heartBeatInterval) clearInterval((node as any).heartBeatInterval)
      try { node.destroy(undefined, false) } catch {}
    }
  })

  it('handles basic REST and metrics', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    expect(await node.fetchVersion()).toBe('4.0.0')
    expect(node.getHealthStatus().status).toBe('healthy')
  })

  it('handles trackEnd reason: replaced', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'te1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'u')
    player.queue.current = track

    const promise = once(manager, 'trackEnd')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: 'te1', track, reason: 'replaced' }))
    const [p, t, payload] = await promise
    
    expect(p).toBe(player)
    // @ts-ignore
    expect(payload.reason).toBe('replaced')
  })

  it('handles trackEnd reason: loadFailed', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'te2', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'u')
    player.queue.current = track
    player.queue.add(manager.utils.buildTrack({ encoded: 'e2', info: { title: 'T2' } } as any, 'u'))

    const promise = once(manager, 'trackEnd')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'TrackEndEvent', guildId: 'te2', track, reason: 'loadFailed' }))
    const [p, t, payload] = await promise

    expect(p).toBe(player)
    // @ts-ignore
    expect(payload.reason).toBe('loadFailed')
  })

  it('handles playerUpdate op', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'pu1', voiceChannelId: 'v1' })
    
    // @ts-ignore
    await node.message(JSON.stringify({ 
      op: 'playerUpdate', 
      guildId: 'pu1', 
      state: { position: 1234, connected: true, ping: 50, time: Date.now() } 
    }))
    
    expect(player.lastPosition).toBe(1234)
    expect(player.connected).toBe(true)
  })

  it('handles websocket error and close events', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const reconnectSpy = vi.spyOn(node as any, 'reconnect')
    
    // @ts-ignore
    if (node.socket) {
      // @ts-ignore
      node.socket.emit('error', new Error('test'))
      expect(reconnectSpy).toHaveBeenCalled()
      
      // Node.error calls reconnect or close. Default closeOnError is false.
      // @ts-ignore
      node.socket.emit('close', 1006, 'Abnormal')
      expect(reconnectSpy).toHaveBeenCalledTimes(2)
    }
  })

  it('handles ready op with resumed true', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const resumedSpy = vi.spyOn(manager.nodeManager, 'emit')
    vi.spyOn(node, 'fetchAllPlayers').mockResolvedValue([])

    // @ts-ignore
    await node.message(JSON.stringify({ op: 'ready', sessionId: 'new-sid', resumed: true }))
    expect(node.sessionId).toBe('new-sid')
    expect(resumedSpy).toHaveBeenCalledWith('resumed', node, expect.anything(), [])
  })

  it('handles ready op fetching error', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const resumedSpy = vi.spyOn(manager.nodeManager, 'emit')
    vi.spyOn(node, 'fetchAllPlayers').mockImplementation(() => Promise.reject(new Error('Fetch failed')))

    // @ts-ignore
    await node.message(JSON.stringify({ op: 'ready', sessionId: 'err-sid', resumed: true }))
    expect(resumedSpy).toHaveBeenCalledWith('resumed', node, expect.anything(), [])
  })

  it('handles unknown op', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const errorSpy = vi.spyOn(manager.nodeManager, 'emit')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'unknown' }))
    expect(errorSpy).toHaveBeenCalledWith('error', node, expect.any(Error), expect.anything())
  })

  it('handles LyricsFound and LyricsNotFound events', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'ly1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'u')
    player.queue.current = track

    const foundPromise = once(manager, 'LyricsFound')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'LyricsFound', guildId: 'ly1', track, lines: [] }))
    const [p1] = await foundPromise
    expect(p1).toBe(player)

    const notFoundPromise = once(manager, 'LyricsNotFound')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'LyricsNotFound', guildId: 'ly1', track }))
    const [p2] = await notFoundPromise
    expect(p2).toBe(player)
  })

  it('handles lyrics event without current track in player', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'ly2', voiceChannelId: 'v1' })
    player.queue.current = null

    // Should try to get track from payload
    const trackPayload = { encoded: 'ep', info: { title: 'TP' } }
    const foundPromise = once(manager, 'LyricsFound')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'LyricsFound', guildId: 'ly2', track: trackPayload, lines: [] }))
    const [p] = await foundPromise
    expect(p).toBe(player)
    expect(player.queue.current?.encoded).toBe('ep')
  })

  it('handles TrackStartEvent', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'ts1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'u')
    
    const promise = once(manager, 'trackStart')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'TrackStartEvent', guildId: 'ts1', track }))
    const [p, t] = await promise
    expect(p).toBe(player)
    expect(t.encoded).toBe('e')
  })

  it('handles TrackExceptionEvent', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'tex1', voiceChannelId: 'v1' })
    
    const promise = once(manager, 'trackError')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'TrackExceptionEvent', guildId: 'tex1', track: { encoded: 'e', info: { title: 'T' } }, exception: { message: 'err', severity: 'COMMON', cause: 'none' } }))
    const [p, t, error] = await promise
    expect(p).toBe(player)
    expect(error.exception.message).toBe('err')
  })

  it('handles TrackStuckEvent', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'tst1', voiceChannelId: 'v1' })
    
    const promise = once(manager, 'trackStuck')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'TrackStuckEvent', guildId: 'tst1', track: { encoded: 'e', info: { title: 'T' } }, thresholdMs: 1000 }))
    const [p, t, threshold] = await promise
    expect(p).toBe(player)
    expect(threshold).toBe(1000)
  })

  it('handles WebSocketClosedEvent', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    const player = manager.createPlayer({ guildId: 'wsc1', voiceChannelId: 'v1' })
    
    const promise = once(manager, 'playerDisconnect')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'event', type: 'WebSocketClosedEvent', guildId: 'wsc1', code: 4006, reason: 'Closed', byRemote: true }))
    const [p, code, reason, byRemote] = await promise
    expect(p).toBe(player)
    expect(code).toBe(4006)
  })

  it('handles more REST methods (fetchAllPlayers, fetchStats, fetchInfo)', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    
    const players = await node.fetchAllPlayers()
    expect(Array.isArray(players)).toBe(true)
    
    const stats = await node.fetchStats()
    expect(stats.uptime).toBeDefined()
    
    const info = await node.fetchInfo()
    expect(info.version.semver).toBe('4.0.0')
  })

  it('handles updatePlayer and destroyPlayer', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    
    // updatePlayer
    const updateRes = await node.updatePlayer({ guildId: 'up1', playerOptions: { volume: 50 } })
    expect(updateRes.volume).toBe(50)
    
    // destroyPlayer
    await node.destroyPlayer('up1')
    // No error = success (mock returns 204)
  })
})
