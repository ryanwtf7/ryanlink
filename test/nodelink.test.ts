import { RyanlinkManager } from '../src/core/Manager'
import { waitForNode } from './utils'
import type { Player } from '../src/audio/Player'
import type { NodeLinkNode } from '../src/node/NodeLink'

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
    send = vi.fn()
    close = vi.fn()
    terminate = vi.fn()
  }
  return {
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
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      if (path.includes('meaning')) return { status: 200, ok: true, json: async () => ({ meaning: 'test' }) }
      if (path.includes('mix')) {
        if (options?.method === 'GET') return { status: 200, ok: true, json: async () => ({ layers: [] }) }
        if (options?.method === 'POST') return { status: 200, ok: true, json: async () => ({ mixId: 'm1' }) }
        return { status: 200, ok: true, json: async () => ({}) }
      }
      if (path.includes('lyrics')) return { status: 200, ok: true, json: async () => ({ text: 'l' }) }
      if (path.includes('chapters')) return { status: 200, ok: true, json: async () => ([]) }
      if (path.includes('connection')) return { status: 200, ok: true, json: async () => ({ metrics: {} }) }
      if (path.includes('trackstream')) return { status: 200, ok: true, json: async () => ({ url: 'stream' }) }
      if (path.includes('loadstream')) return { status: 200, ok: true, json: async () => ({}) }
      if (path.includes('youtube/config')) return { status: 200, ok: true, json: async () => ({ isConfigured: true }) }
      if (path.includes('youtube/oauth')) return { status: 200, ok: true, json: async () => ({ refreshToken: 'r' }) }
      if (path.includes('players')) return { status: 200, ok: true, json: async () => ({}) }
      return { status: 404, ok: false, json: async () => ({}) }
    })

    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local', nodeType: 'NodeLink' }],
      client: { id: '123' },
      sendToShard: vi.fn(),
    })
    
    node = manager.nodeManager.nodes.get('local') as NodeLinkNode
    await node.connect()
    await waitForNode(node)
    
    player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1', node: 'local' })
  })

  it('handles gapless playback methods', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    await node.setNextTrackGapLess(player, track)
    await node.removeNextTrackGapLess(player)
  })

  it('gets meaning of a track', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    const res = await node.getMeaning(track)
    expect(res.meaning).toBe('test')
  })

  it('manages mixer layers', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    const addRes = await node.addMixerLayer(player, track, 50)
    expect(addRes.mixId).toBe('m1')

    const listRes = await node.listMixerLayers(player)
    expect(listRes.layers).toBeDefined()

    await node.updateMixerLayerVolume(player, 'm1', 75)
    await node.removeMixerLayer(player, 'm1')
  })

  it('applies specific filters', async () => {
    await node.specificFilters.echo(player, { delay: 1, decay: 0.5 })
    await node.specificFilters.chorus(player, { rate: 1, depth: 1 })
    await node.specificFilters.compressor(player, { threshold: -20 })
    await node.specificFilters.highPass(player, { frequency: 100 })
    await node.specificFilters.phaser(player, { rate: 1 })
    await node.specificFilters.spatial(player, { x: 1, y: 1, z: 1 })
    await node.specificFilters.resetNodeLinkFilters(player)
  })

  it('fetches lyrics and chapters', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    player.queue.current = track
    const lyrics = await node.nodeLinkLyrics(player)
    expect(lyrics).toBeDefined()

    const chapters = await node.getChapters(player)
    expect(Array.isArray(chapters)).toBe(true)
  })

  it('gets connection metrics and streams', async () => {
    const track = manager.utils.buildTrack({ encoded: 't', info: {} } as any, 'u')
    await node.getConnectionMetrics()
    await node.getDirectStream(track)
    // loadDirectStream returns a mock response
    await node.loadDirectStream(track, 100, 0, {})
  })

  it('handles youtube config and oauth', async () => {
    await node.updateYoutubeConfig('r', 'v')
    await node.getYoutubeConfig(true)
    await node.getYoutubeOAUTH('r')
    await node.updateYoutubeOAUTH('r')
  })

  it('changes audio track language', async () => {
    await node.changeAudioTrackLanguage(player, 'lang-1')
  })
})
