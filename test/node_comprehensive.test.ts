import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RyanlinkNode } from '../src/node/Node'
import { DestroyReasons, DisconnectReasons } from '../src/config/Constants'

describe('RyanlinkNode Comprehensive', () => {
  let manager: RyanlinkManager
  let node: RyanlinkNode

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: vi.fn(),
    })
    await manager.init({ id: 'bot123' })
    node = manager.nodeManager.nodes.get('local')! as RyanlinkNode
    node.sessionId = 'sess123'
    // @ts-ignore
    node.socket = { readyState: 1, send: vi.fn(), close: vi.fn() }
    
    node.info = { 
      version: { semver: '4.0.0' },
      sourceManagers: ['youtube'],
      filters: ['volume'],
      plugins: [{ name: 'sponsorblock-plugin', version: '1.0' }]
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles WebSocket "ready" message', async () => {
    const rawMessage = JSON.stringify({ op: 'ready', sessionId: 'new-sess', resumed: false })
    // @ts-ignore
    node.message({ data: rawMessage })
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
    node.message({ data: rawMessage })
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
    node.message({ data: rawMessage })
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
    LavalinkMock.setResponse('/version', { _status: 500, data: 'Error' })
    await expect(node.fetchVersion()).rejects.toThrow(/status 500/)
    
    LavalinkMock.setResponse('/stats', { _status: 404, data: 'Error' })
    await expect(node.fetchStats()).rejects.toThrow(/status 404/)
  })

  it('handles queueEnd logic via track event', async () => {
    const player = manager.createPlayer({ guildId: 'qe1', voiceChannelId: 'v1' })
    // Mock autoplay function to avoid network hits
    manager.options.playerOptions.onEmptyQueue.autoPlayFunction = vi.fn()
    
    const rawMessage = JSON.stringify({
      op: 'event',
      type: 'TrackEndEvent',
      guildId: 'qe1',
      track: { encoded: 'e', info: { title: 'T' } },
      reason: 'finished'
    })
    
    // @ts-ignore
    await node.message({ data: rawMessage })
    expect(manager.options.playerOptions.onEmptyQueue.autoPlayFunction).toHaveBeenCalled()
  })

  it('handles Lyrics events', async () => {
    const player = manager.createPlayer({ guildId: 'lyrics1', voiceChannelId: 'v1' })
    const track = { encoded: 'e', info: { title: 'T' } }
    
    const events: ('LyricsLine' | 'LyricsFound' | 'LyricsNotFound')[] = ['LyricsLine', 'LyricsFound', 'LyricsNotFound']
    
    for (const type of events) {
      let emitted = false
      manager.on(type, () => emitted = true)
      
      const rawMessage = JSON.stringify({
        op: 'event',
        type: type,
        guildId: 'lyrics1',
        track: track,
        line: { text: 'test' }
      })
      
      // @ts-ignore
      await node.message({ data: rawMessage })
      expect(emitted, `Expected ${type} to be emitted`).toBe(true)
    }
  })

  it('handles queue empty destruction logic', async () => {
    vi.useFakeTimers()
    manager.options.playerOptions.onEmptyQueue.destroyAfterMs = 1000
    const player = manager.createPlayer({ guildId: 'empty1', voiceChannelId: 'v1' })
    const destroySpy = vi.spyOn(player, 'destroy').mockResolvedValue(true as any)
    
    const rawMessage = JSON.stringify({
      op: 'event',
      type: 'TrackEndEvent',
      guildId: 'empty1',
      track: { encoded: 'e' },
      reason: 'finished'
    })
    
    // @ts-ignore
    await node.message({ data: rawMessage })
    
    vi.advanceTimersByTime(1500)
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.QueueEmpty)
    vi.useRealTimers()
  })

  it('handles SponsorBlock chapter events', async () => {
    const player = manager.createPlayer({ guildId: 'sb_chapters', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 'e', info: { title: 'T' } } as any, 'user')
    
    for (const type of ['ChaptersLoaded', 'ChapterStarted']) {
      let emitted = false
      manager.on(type as any, () => emitted = true)
      
      const rawMessage = JSON.stringify({
        op: 'event',
        type: type === 'ChaptersLoaded' ? 'SponsorBlockChaptersLoaded' : 'SponsorBlockChapterStarted',
        guildId: 'sb_chapters',
        track: track,
        chapters: []
      })
      
      // @ts-ignore
      await node.message({ data: rawMessage })
      expect(emitted, `Expected ${type} to be emitted`).toBe(true)
    }
  })

  it('handles queueEnd autoplay spam limiter', async () => {
    const player = manager.createPlayer({ guildId: 'qe_spam', voiceChannelId: 'v1' })
    const autoPlaySpy = vi.fn()
    manager.options.playerOptions.onEmptyQueue.autoPlayFunction = autoPlaySpy
    manager.options.playerOptions.minAutoPlayMs = 5000
    
    const triggerQueueEnd = async () => {
      const rawMessage = JSON.stringify({
        op: 'event',
        type: 'TrackEndEvent',
        guildId: 'qe_spam',
        track: manager.utils.buildTrack({ encoded: 'e' } as any, 'user'),
        reason: 'finished'
      })
      // @ts-ignore
      await node.message({ data: rawMessage })
    }

    // First call success
    await triggerQueueEnd()
    expect(autoPlaySpy).toHaveBeenCalledTimes(1)

    // Second call immediate (should trigger limiter)
    await triggerQueueEnd()
    expect(autoPlaySpy).toHaveBeenCalledTimes(1) // Still 1

    // Advance time and call again
    vi.useFakeTimers()
    vi.advanceTimersByTime(6000)
    await triggerQueueEnd()
    // Wait for the async part if any, but since we are using await node.message, it should be fine.
    // However, autoplay is async and we don't await the spy.
    expect(autoPlaySpy).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
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
      type: 'LyricsLine',
      guildId: 'lyrics_fallback',
      track: { encoded: 'fallback_track', info: { title: 'Resolved' } },
      line: { text: 'test' }
    })
    
    // @ts-ignore
    await node.message({ data: rawMessage })
    expect(player.queue.current?.info?.title).toBe('Resolved')
    expect(emitted).toBe(true)
  })
})
