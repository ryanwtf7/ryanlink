import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { RyanlinkNode } from '../src/node/Node'
import { DestroyReasons, DisconnectReasons } from '../src/config/Constants'

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

describe('RyanlinkNode Comprehensive', () => {
  let manager: RyanlinkManager
  let node: RyanlinkNode

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
    })
    manager.nodeManager.on('error', () => {}) // Prevent test runner crashes from unhandled errors
    await manager.init({ id: 'bot123' })
    node = manager.nodeManager.nodes.get('local')! as RyanlinkNode
    node.sessionId = 'sess123'
    // @ts-ignore
    node.socket = { readyState: 1, send: jest.fn(), close: jest.fn(), on: jest.fn(), removeListener: jest.fn() }
    
    node.info = { 
      version: { semver: '4.0.0' },
      sourceManagers: ['youtube'],
      filters: ['volume'],
      plugins: [{ name: 'sponsorblock-plugin', version: '1.0' }]
    } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles WebSocket "ready" message', async () => {
    const rawMessage = JSON.stringify({ op: 'ready', sessionId: 'new-sess', resumed: false })
    // @ts-ignore
    await node.message(rawMessage)
    expect(node.sessionId).toBe('new-sess')
  })

  it('handles WebSocket "playerUpdate" message', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const rawMessage = JSON.stringify({ 
      op: 'playerUpdate', 
      guildId: 'g1', 
      state: { position: 1000, time: Date.now(), connected: true, ping: 50 } 
    })
    // @ts-ignore
    await node.message(rawMessage)
    expect(player.position).toBeGreaterThan(0)
  })

  it('handles WebSocket "stats" message', async () => {
    const rawMessage = JSON.stringify({ 
      op: 'stats', 
      players: 10, 
      playingPlayers: 5, 
      uptime: 1000,
      memory: { free: 1, used: 2, reservable: 3, allocated: 4 },
      cpu: { cores: 8, systemLoad: 0.1, lavalinkLoad: 0.05 },
      frameStats: { sent: 1, nulled: 0, deficit: 0 }
    })
    // @ts-ignore
    await node.message(rawMessage)
    expect(node.stats.players).toBe(10)
  })

  it('handles SponsorBlock methods (Success)', async () => {
    const player = manager.createPlayer({ guildId: 'sb1', voiceChannelId: 'v1' })
    LavalinkMock.setResponse('/sessions/sess123/players/sb1/sponsorblock/categories', [])
    
    await node.setSponsorBlock(player, ['sponsor'])
    expect(player.getData('internal_sponsorBlockCategories')).toContain('sponsor')
    
    await node.getSponsorBlock(player)
    await node.deleteSponsorBlock(player)
    expect(player.getData('internal_sponsorBlockCategories')).toEqual([])
  })

  it('handles SponsorBlock (Missing Plugin)', async () => {
    const player = manager.createPlayer({ guildId: 'sb2', voiceChannelId: 'v1' })
    node.info.plugins = [] // Remove plugin
    
    await expect(node.setSponsorBlock(player, ['sponsor'])).rejects.toThrow(/there is no sponsorblock-plugin/)
    await expect(node.getSponsorBlock(player)).rejects.toThrow(/there is no sponsorblock-plugin/)
    await expect(node.deleteSponsorBlock(player)).rejects.toThrow(/there is no sponsorblock-plugin/)
  })

  it('handles REST administrative methods', async () => {
    LavalinkMock.setResponse('/sessions/sess123', { timeout: 60 })
    await node.updateSession(true, 60)
    
    LavalinkMock.setResponse('/sessions/sess123/players/g1', { guildId: 'g1' })
    await node.fetchPlayer('g1')
    
    LavalinkMock.setResponse('/sessions/sess123/players/g1', { _status: 204 })
    await node.destroyPlayer('g1')
  })

  it('handles REST error paths', async () => {
    LavalinkMock.setResponse('version', { _status: 500, data: 'Error' })
    await expect(node.fetchVersion()).rejects.toThrow(/status 500/)
    
    LavalinkMock.setResponse('stats', { _status: 404, data: 'Error' })
    await expect(node.fetchStats()).rejects.toThrow(/status 404/)
  })

  it('handles queueEnd logic via track event', async () => {
    const player = manager.createPlayer({ guildId: 'qe1', voiceChannelId: 'v1' })
    // Mock autoplay function to avoid network hits
    manager.options.playerOptions.onEmptyQueue.autoPlayFunction = jest.fn()
    
    const rawMessage = JSON.stringify({
      op: 'event',
      type: 'TrackEndEvent',
      guildId: 'qe1',
      track: { encoded: 'e', info: { title: 'T' } },
      reason: 'finished'
    })
    
    // @ts-ignore
    await node.message(rawMessage)
    expect(manager.options.playerOptions.onEmptyQueue.autoPlayFunction).toHaveBeenCalled()
  })

  it('handles Lyrics events', async () => {
    const player = manager.createPlayer({ guildId: 'lyrics1', voiceChannelId: 'v1' })
    const track = { encoded: 'e', info: { title: 'T' } }
    player.queue.current = manager.utils.buildTrack(track as any, 'user')
    const events = ['LyricsLine', 'LyricsFound', 'LyricsNotFound'] as const
    
    for (const type of events) {
      let emitted = false
      manager.on(type, () => emitted = true)
      
      const rawMessage = JSON.stringify({
        op: 'event',
        type: `${type}Event`,
        guildId: 'lyrics1',
        track: track,
        line: { text: 'test' }
      })
      
      // @ts-ignore
      await node.message(rawMessage)
      expect(emitted).toBe(true)
    }
  })

  it('handles queue empty destruction logic', async () => {
    manager.options.playerOptions.onEmptyQueue.destroyAfterMs = 0
    const player = manager.createPlayer({ guildId: 'empty1', voiceChannelId: 'v1' })
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(true as any)
    
    const rawMessage = JSON.stringify({
      op: 'event',
      type: 'TrackEndEvent',
      guildId: 'empty1',
      track: { encoded: 'e', info: { title: 'T' } },
      reason: 'finished'
    })
    
    // @ts-ignore
    await node.message(rawMessage)
    await new Promise(r => setTimeout(r, 10))
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.QueueEmpty)
  })

  it('handles SponsorBlock chapter events', async () => {
    const player = manager.createPlayer({ guildId: 'sb_chapters', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'user')
    player.queue.current = track
    
    for (const type of ['ChaptersLoaded', 'ChapterStarted']) {
      let emitted = false
      manager.on(type as any, () => emitted = true)
      
      const rawMessage = JSON.stringify({
        op: 'event',
        type: type,
        guildId: 'sb_chapters',
        track: track,
        chapters: []
      })
      
      // @ts-ignore
      await node.message(rawMessage)
      await new Promise(r => setTimeout(r, 10))
      expect(emitted).toBe(true)
    }
  })

  it('handles queueEnd autoplay spam limiter', async () => {
    const player = manager.createPlayer({ guildId: 'qe_spam', voiceChannelId: 'v1' })
    const autoPlaySpy = jest.fn()
    manager.options.playerOptions.onEmptyQueue.autoPlayFunction = autoPlaySpy
    manager.options.playerOptions.minAutoPlayMs = 5000
    
    const triggerQueueEnd = async () => {
      const rawMessage = JSON.stringify({
        op: 'event',
        type: 'TrackEndEvent',
        guildId: 'qe_spam',
        track: manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'user'),
        reason: 'finished'
      })
      // @ts-ignore
      await node.message(rawMessage)
      await new Promise(r => setTimeout(r, 10))
    }

    // First call success
    await triggerQueueEnd()
    expect(autoPlaySpy).toHaveBeenCalledTimes(1)

    // Second call immediate (should trigger limiter because offset implies minimal duration passed)
    await triggerQueueEnd()
    expect(autoPlaySpy).toHaveBeenCalledTimes(1) // Still 1

    // Advance time and call again
    player.setData('internal_previousautoplay', Date.now() - 6000)
    await triggerQueueEnd()
    
    expect(autoPlaySpy).toHaveBeenCalledTimes(2)
  })

  it('handles Lyrics event fallback resolution', async () => {
    const player = manager.createPlayer({ guildId: 'lyrics_fallback', voiceChannelId: 'v1' })
    // No current track
    player.queue.current = null
    
    let emitted = false
    manager.on('LyricsLine', () => emitted = true)
    
    // Mock getTrackOfPayload via internal node method or by providing right payload
    const rawMessage = JSON.stringify({
      op: 'event',
      type: 'LyricsLineEvent',
      guildId: 'lyrics_fallback',
      track: { encoded: 'fallback_track', info: { title: 'Resolved' } },
      line: { text: 'test' }
    })
    
    // @ts-ignore
    await node.message(rawMessage)
    await new Promise(r => setTimeout(r, 10))
    expect(player.queue.current?.info?.title).toBe('Resolved')
    expect(emitted).toBe(true)
  })
})
