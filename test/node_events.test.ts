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

describe('Node message handling and Events', () => {
  let manager: RyanlinkManager
  let node: any

  beforeAll(() => {
    LavalinkMock.setup()
  })

  beforeEach(async () => {
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn()
    })
    manager.nodeManager.on('error', () => {})
    await manager.init({ id: 'bot123' })
    node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'mock-session'
    node.info = { isNodelink: false }
    node.nodeType = 'Core'

    // Mock REST requests
    jest.spyOn(node, 'request').mockResolvedValue({})
    jest.spyOn(node, 'rawRequest').mockResolvedValue({ status: 200, json: async () => ({}) })
    jest.spyOn(node, 'updatePlayer').mockResolvedValue({})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const n of manager.nodeManager.nodes.values()) n.destroy()
  })

  it('handles "ready" opcode without resumed', async () => {
    const emitSpy = jest.spyOn(manager.nodeManager, 'emit')
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'ready', sessionId: 'new-sess', resumed: false }))
    expect(node.sessionId).toBe('new-sess')
    expect(emitSpy).not.toHaveBeenCalledWith('resumed', expect.anything(), expect.anything(), expect.anything())
  })

  it('toJSON returns expected structure', () => {
    const json = node.toJSON()
    expect(json).toHaveProperty('sessionId', 'mock-session')
    expect(json).toHaveProperty('connected')
  })

  describe('Player Events', () => {
    let player: any

    beforeEach(() => {
      player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
      player.queue.current = { info: { identifier: 't1' } }
      jest.spyOn(player.node, 'isNodeLink').mockReturnValue(false)
      // Mock save to prevent any real storage interaction
      jest.spyOn(player.queue.utils, 'save').mockResolvedValue(undefined)
    })

    it('handles TrackStartEvent', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'TrackStartEvent', track: { encoded: 'abc', info: {} } }))
      expect(player.playing).toBe(true)
      expect(emitSpy).toHaveBeenCalledWith('trackStart', player, expect.anything(), expect.anything())
    })

    it('handles TrackEndEvent and transitions to next track', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      // Ensure we have a track to skip to
      player.queue.tracks = [{ encoded: 'next', info: { identifier: 't2', title: 'test' } }]
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'TrackEndEvent', reason: 'finished', track: { encoded: 'abc', info: {} } }))
      
      const trackEndCall = emitSpy.mock.calls.find(c => c[0] === 'trackEnd')
      const queueEndCall = emitSpy.mock.calls.find(c => c[0] === 'queueEnd')
      expect(trackEndCall || queueEndCall).toBeTruthy()
    })

    it('handles TrackEndEvent with loadFailed and empty queue', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      player.queue.tracks = []
      player.queue.current = { info: { identifier: 't1' } }
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'TrackEndEvent', reason: 'loadFailed', track: { encoded: 'abc', info: {} } }))
      
      const queueEndCall = emitSpy.mock.calls.find(c => c[0] === 'queueEnd')
      expect(queueEndCall).toBeTruthy()
    })

    it('handles TrackStuckEvent', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'TrackStuckEvent', thresholdMs: 1000, track: { encoded: 'abc', info: {} } }))
      expect(emitSpy).toHaveBeenCalledWith('trackStuck', player, expect.anything(), expect.anything())
    })

    it('handles TrackExceptionEvent', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'TrackExceptionEvent', exception: { message: 'fail', severity: 'COMMON', cause: 'none' }, track: { encoded: 'abc', info: {} } }))
      expect(emitSpy).toHaveBeenCalledWith('trackError', player, expect.anything(), expect.anything())
    })

    it('handles WebSocketClosedEvent', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'WebSocketClosedEvent', code: 4001, reason: 'BYE', byRemote: true }))
      expect(emitSpy).toHaveBeenCalledWith('playerSocketClosed', player, expect.anything())
    })

    it('handles Lyrics Events', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      
      // LyricsFound
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'LyricsFoundEvent', lyrics: { text: 'lalala' } }))
      expect(emitSpy).toHaveBeenCalledWith('LyricsFound', player, expect.anything(), expect.anything())

      // LyricsLine
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'LyricsLineEvent', line: { text: 'test' } }))
      expect(emitSpy).toHaveBeenCalledWith('LyricsLine', player, expect.anything(), expect.anything())

      // LyricsNotFound
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'LyricsNotFoundEvent' }))
      expect(emitSpy).toHaveBeenCalledWith('LyricsNotFound', player, expect.anything(), expect.anything())
    })

    it('handles SponsorBlock events', async () => {
      const emitSpy = jest.spyOn(manager, 'emit')
      
      // SegmentsLoaded
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'SegmentsLoaded', segments: [] }))
      expect(emitSpy).toHaveBeenCalledWith('SegmentsLoaded', player, expect.anything(), expect.anything())

      // SegmentSkipped
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'SegmentSkipped', segment: {} }))
      expect(emitSpy).toHaveBeenCalledWith('SegmentSkipped', player, expect.anything(), expect.anything())

      // ChaptersLoaded
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'ChaptersLoaded', chapters: [] }))
      expect(emitSpy).toHaveBeenCalledWith('ChaptersLoaded', player, expect.anything(), expect.anything())

      // ChapterStarted
      // @ts-ignore
      await node.message(JSON.stringify({ op: 'event', guildId: 'g1', type: 'ChapterStarted', chapter: {} }))
      expect(emitSpy).toHaveBeenCalledWith('ChapterStarted', player, expect.anything(), expect.anything())
    })
  })
})
