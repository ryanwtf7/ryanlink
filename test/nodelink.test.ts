import { RyanlinkManager } from '../src/core/Manager'
import { waitForNode } from './utils'
import type { Player } from '../src/audio/Player'
import type { NodeLinkNode } from '../src/node/NodeLink'

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
            sessionId: '123',
            resumed: false,
            info: {
              version: { semver: '4.0.0' },
              sourceManagers: ['youtube'],
              plugins: []
            }
          }))
        }, 10)
      }, 5)
    }
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
  }
  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  }
})

describe('NodeLinkNode', () => {
  let manager: RyanlinkManager
  let node: NodeLinkNode
  let player: Player

  beforeEach(async () => {
    // Mock fetch
    globalThis.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      const urlObj = new URL(url)
      const path = urlObj.pathname

      const createResponse = (data: any, status = 200) => ({
        status,
        ok: status < 400,
        json: async () => data,
        text: async () => typeof data === 'string' ? data : JSON.stringify(data),
      })

      if (path.includes('info')) return createResponse({ version: { semver: '4.0.0' }, sourceManagers: ['youtube'], plugins: [], isNodelink: true })
      if (path.includes('version')) return createResponse('4.0.0')
      if (path.includes('meaning')) return createResponse({ loadType: 'meaning', data: { title: 'test', description: 'desc', paragraphs: [], url: 'u', provider: 'p', type: 't' } })
      if (path.includes('mix')) {
        if (options?.method === 'GET') return createResponse({ mixes: [] })
        if (options?.method === 'POST') return createResponse({ id: 'm1', track: { encoded: 'e' }, volume: 0.5 })
        return createResponse({})
      }
      if (path.includes('loadlyrics') || (path.includes('lyrics') && options?.method === 'GET')) return createResponse({ loadType: 'synced', data: { synced: true, lang: 'en', source: 's', lines: [] } })
      if (path.includes('loadchapters') || (path.includes('chapters') && options?.method === 'GET')) return createResponse([])
      if (path.includes('connection')) return createResponse({ status: 'ok', metrics: {} })
      if (path.includes('trackstream')) return createResponse({ url: 'stream' })
      if (path.includes('loadstream')) return createResponse({ response: {} })
      if (path.includes('youtube/config')) return createResponse({ isConfigured: true })
      if (path.includes('youtube/oauth')) return createResponse({ access_token: 't', expires_in: 3600, scope: 's', token_type: 't' })
      if (path.includes('encodetrack')) return createResponse({ encoded: 'enc' })
      if (path.includes('encodedtracks')) return createResponse({ encodedTracks: ['enc'] })
      if (path.includes('workers')) return createResponse({ workers: [] })
      if (path.includes('stats')) return createResponse({ detailedStats: {} })
      if (path.includes('players')) return createResponse({})

      return createResponse({}, 404)
    })

    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local', nodeType: 'NodeLink' }],
      client: { id: '123' },
      sendToShard: jest.fn(),
    })

    node = manager.nodeManager.nodes.get('local') as NodeLinkNode
    await node.connect()
    await waitForNode(node)

    player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1', node: 'local' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('handles gapless playback methods', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    await node.setNextTrackGapLess(player, track)
    expect(await node.removeNextTrackGapLess(player)).toBe(true)
  })

  it('gets meaning of a track', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    const res = await node.getMeaning(track)
    expect(res.data.title).toBe('test')
  })

  it('manages mixer layers', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    const addRes = await node.addMixerLayer(player, track, 50)
    expect(addRes.id).toBe('m1')

    const listRes = await node.listMixerLayers(player)
    expect(listRes.mixes).toBeDefined()

    expect(await node.updateMixerLayerVolume(player, 'm1', 75)).toBe(true)
    expect(await node.removeMixerLayer(player, 'm1')).toBe(true)
  })

  it('applies specific filters', async () => {
    await node.specificFilters.echo(player, { delay: 1, feedback: 0.5 })
    await node.specificFilters.chorus(player, { rate: 1, depth: 1 })
    await node.specificFilters.compressor(player, { threshold: -20 })
    await node.specificFilters.highPass(player, { smoothing: 100 })
    await node.specificFilters.phaser(player, { rate: 1 })
    await node.specificFilters.spatial(player, { depth: 1, rate: 1 })
    expect(await node.specificFilters.resetNodeLinkFilters(player)).toBe(true)
  })

  it('fetches lyrics and chapters (standard and NodeLink specific)', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    player.queue.current = track

    expect(await node.loadLyrics(track)).toBeDefined()
    expect(await node.loadChapters(track)).toBeDefined()

    const lyrics = await node.nodeLinkLyrics(player)
    expect(lyrics).toBeDefined()

    const chapters = await node.getChapters(player)
    expect(Array.isArray(chapters)).toBe(true)

    await node.subscribeLyricsNodeLink(player, true)
    await node.unsubscribeLyricsNodeLink(player)
  })

  it('gets connection metrics and streams (GET and POST)', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    await node.getConnectionMetrics()
    await node.getDirectStream(track)
    
    // GET loadstream
    await node.loadDirectStream(track, 100, 0, {})
    
    // POST loadstream
    await node.loadDirectStreamPost(track, 100, 0, {})
  })

  it('handles track encoding', async () => {
    expect(await node.encodeTrack({ title: 'test' })).toBeDefined()
    expect(await node.encodeTracks([{ title: 'test' }])).toBeDefined()
  })

  it('handles worker management', async () => {
    expect(await node.getWorkers()).toBeDefined()
    await node.patchWorker('123', { id: 1 })
  })

  it('handles youtube config and oauth', async () => {
    await node.updateYoutubeConfig('r', 'v')
    await node.getYoutubeConfig(true)
    await node.getYoutubeOAUTH('r')
    await node.updateYoutubeOAUTH('r')
  })

  it('handles fading and player language', async () => {
    await node.setFading(player, { enabled: true, trackStart: { duration: 1000 } })
    await node.changeAudioTrackLanguage(player, 'lang-1')
  })

  it('handles extended stats and info', async () => {
    expect(await node.getDetailedStats()).toBeDefined()
    expect(await node.getNodeLinkInfo()).toBeDefined()
  })
})
