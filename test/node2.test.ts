import { RyanlinkManager, RyanlinkNode } from '../src'
import { NodeLinkNode } from '../src/node/NodeLink'

function makeManager() {
  return new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn().mockResolvedValue(undefined) })
}

function makeNode(manager: RyanlinkManager, id = 'n1') {
  return new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = makeNode(manager, id)
  // @ts-ignore
  node.socket = { readyState: 1, close: jest.fn(), removeAllListeners: jest.fn(), terminate: jest.fn() }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  return node
}

describe('RyanlinkNode - constructor', () => {
  it('instantiates with defaults', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node.id).toBe('n1')
    expect(node.nodeType).toBe('Core')
    expect(node.isAlive).toBe(false)
    expect(node.calls).toBe(0)
  })

  it('throws on invalid options', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({} as any, m.nodeManager)).toThrow()
  })

  it('throws when secure=true and port!=443', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', port: 2333, authorization: 'pw', secure: true } as any, m.nodeManager)).toThrow()
  })

  it('id falls back to host:port when no id', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'myhost', port: 9999, authorization: 'pw' } as any, m.nodeManager)
    expect(node.id).toBe('myhost:9999')
  })

  it('lowercases regions', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw', regions: ['US', 'EU'] } as any, m.nodeManager)
    expect(node.options.regions).toEqual(['us', 'eu'])
  })
})

describe('RyanlinkNode - connection status', () => {
  it('connected returns falsy when no socket', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node.connected).toBeFalsy()
  })

  it('connected returns true when socket is OPEN', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    expect(node.connected).toBe(true)
  })

  it('connectionStatus throws when no socket', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(() => node.connectionStatus).toThrow()
  })

  it('connectionStatus returns OPEN', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    expect(node.connectionStatus).toBe('OPEN')
  })

  it('connectionStatus returns CLOSED', () => {
    const m = makeManager()
    const node = makeNode(m)
    // @ts-ignore
    node.socket = { readyState: 3 }
    expect(node.connectionStatus).toBe('CLOSED')
  })

  it('connectionStatus returns CONNECTING', () => {
    const m = makeManager()
    const node = makeNode(m)
    // @ts-ignore
    node.socket = { readyState: 0 }
    expect(node.connectionStatus).toBe('CONNECTING')
  })

  it('connectionStatus returns CLOSING', () => {
    const m = makeManager()
    const node = makeNode(m)
    // @ts-ignore
    node.socket = { readyState: 2 }
    expect(node.connectionStatus).toBe('CLOSING')
  })
})

describe('RyanlinkNode - stats', () => {
  it('stats has default values', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node.stats.players).toBe(0)
    expect(node.stats.playingPlayers).toBe(0)
    expect(node.stats.uptime).toBe(0)
  })

  it('weightedScore returns Infinity when not connected', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node.weightedScore).toBe(Infinity)
  })

  it('weightedScore computes when connected', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.stats.cpu.systemLoad = 0.5
    node.stats.memory.used = 100
    node.stats.memory.allocated = 1000
    node.stats.players = 10
    expect(typeof node.weightedScore).toBe('number')
    expect(node.weightedScore).not.toBe(Infinity)
  })

  it('heartBeatPing returns difference', () => {
    const m = makeManager()
    const node = makeNode(m)
    // @ts-ignore
    node.heartBeatPingTimestamp = 1000
    // @ts-ignore
    node.heartBeatPongTimestamp = 1050
    expect(node.heartBeatPing).toBe(50)
  })
})

describe('RyanlinkNode - checks', () => {
  it('_checkForSources returns true by default', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node._checkForSources).toBe(true)
  })

  it('_checkForPlugins returns false for NodeLink type', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw', nodeType: 'NodeLink' } as any, m.nodeManager)
    expect(node._checkForPlugins).toBe(false)
  })

  it('isNodeLink() returns false for Core node', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(node.isNodeLink()).toBe(false)
  })
})

describe('RyanlinkNode - disconnect', () => {
  it('disconnect() does nothing when not connected', () => {
    const m = makeManager()
    const node = makeNode(m)
    expect(() => node.disconnect()).not.toThrow()
  })

  it('disconnect() closes socket when connected', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.disconnect()
    expect(node.connected).toBeFalsy()
  })
})

describe('RyanlinkNode - destroy', () => {
  it('destroy() with no players closes socket', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.destroy()
    // @ts-ignore
    expect(node.socket).toBeNull()
  })

  it('destroy() emits nodeDisconnect', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const listener = jest.fn()
    m.nodeManager.on('nodeDisconnect', listener)
    node.destroy()
    expect(listener).toHaveBeenCalled()
  })

  it('destroy() with deleteNode=false does not remove from nodes', () => {
    const m = makeManager()
    const node = makeConnectedNode(m, 'keep')
    node.destroy(undefined, false)
    expect(m.nodeManager.nodes.has('keep')).toBe(true)
  })
})

describe('RyanlinkNode - request/session errors', () => {
  it('request() throws when not connected', async () => {
    const m = makeManager()
    const node = makeNode(m)
    await expect(node.request('/test')).rejects.toThrow()
  })

  it('updatePlayer() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.updatePlayer({ guildId: 'g', playerOptions: {} })).rejects.toThrow()
  })

  it('destroyPlayer() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.destroyPlayer('g')).rejects.toThrow()
  })

  it('fetchAllPlayers() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.fetchAllPlayers()).rejects.toThrow()
  })

  it('fetchPlayer() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.fetchPlayer('g')).rejects.toThrow()
  })

  it('updateSession() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.updateSession()).rejects.toThrow()
  })

  it('decode.singleTrack() throws without encoded', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    await expect(node.decode.singleTrack('', {})).rejects.toThrow()
  })

  it('decode.multipleTracks() throws with empty array', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    await expect(node.decode.multipleTracks([], {})).rejects.toThrow()
  })

  it('decode.multipleTracks() throws with non-array', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    await expect(node.decode.multipleTracks('bad' as any, {})).rejects.toThrow()
  })

  it('lyrics.get() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.lyrics.get({ encoded: 'abc', info: {} } as any)).rejects.toThrow()
  })

  it('lyrics.getCurrent() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.lyrics.getCurrent('g')).rejects.toThrow()
  })

  it('lyrics.subscribe() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.lyrics.subscribe('g')).rejects.toThrow()
  })

  it('lyrics.unsubscribe() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.lyrics.unsubscribe('g')).rejects.toThrow()
  })
})

describe('NodeLinkNode', () => {
  it('instantiates as NodeLink type', () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    expect(node.nodeType).toBe('NodeLink')
  })

  it('isNodeLink() returns true', () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    expect(node.isNodeLink()).toBe(true)
  })

  it('methods throw without sessionId', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = null
    const mockPlayer = { guildId: 'g', queue: { tracks: [{ encoded: 'abc' }], current: null }, position: 0 } as any

    await expect(node.setNextTrackGapLess(mockPlayer)).rejects.toThrow()
    await expect(node.removeNextTrackGapLess(mockPlayer)).rejects.toThrow()
    await expect(node.getMeaning({ encoded: 'abc' } as any)).rejects.toThrow()
    await expect(node.addMixerLayer(mockPlayer, { encoded: 'abc' } as any, 100)).rejects.toThrow()
    await expect(node.listMixerLayers(mockPlayer)).rejects.toThrow()
    await expect(node.updateMixerLayerVolume(mockPlayer, 'mix1', 50)).rejects.toThrow()
    await expect(node.removeMixerLayer(mockPlayer, 'mix1')).rejects.toThrow()
    await expect(node.loadLyrics({ encoded: 'abc' } as any)).rejects.toThrow()
    await expect(node.loadChapters({ encoded: 'abc' } as any)).rejects.toThrow()
    await expect(node.nodeLinkLyrics(mockPlayer)).rejects.toThrow()
    await expect(node.subscribeLyricsNodeLink(mockPlayer)).rejects.toThrow()
    await expect(node.unsubscribeLyricsNodeLink(mockPlayer)).rejects.toThrow()
    await expect(node.getChapters(mockPlayer)).rejects.toThrow()
    await expect(node.getYoutubeConfig()).rejects.toThrow()
    await expect(node.getYoutubeOAUTH('token')).rejects.toThrow()
    await expect(node.updateYoutubeOAUTH('token')).rejects.toThrow()
    await expect(node.updateYoutubeConfig()).rejects.toThrow()
    await expect(node.setFading(mockPlayer, {} as any)).rejects.toThrow()
    await expect(node.changeAudioTrackLanguage(mockPlayer, 'en')).rejects.toThrow()
  })

  it('getMeaning() throws when no encoded track', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    await expect(node.getMeaning({} as any)).rejects.toThrow('No track provided')
  })

  it('loadLyrics() throws when no encoded track', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    await expect(node.loadLyrics({} as any)).rejects.toThrow('No track provided')
  })

  it('loadChapters() throws when no encoded track', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    await expect(node.loadChapters({} as any)).rejects.toThrow('No track provided')
  })

  it('getDirectStream() throws when no encoded', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    await expect(node.getDirectStream({} as any)).rejects.toThrow('No encoded track provided')
  })

  it('loadDirectStream() throws when no encoded', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    await expect(node.loadDirectStream({} as any)).rejects.toThrow('No encoded track provided')
  })

  it('nodeLinkLyrics() throws when no track and no current', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    const mockPlayer = { guildId: 'g', queue: { current: null } } as any
    await expect(node.nodeLinkLyrics(mockPlayer)).rejects.toThrow('No track provided')
  })

  it('getChapters() throws when no track and no current', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    const mockPlayer = { guildId: 'g', queue: { current: null } } as any
    await expect(node.getChapters(mockPlayer)).rejects.toThrow('No track provided')
  })

  it('setNextTrackGapLess() throws when no track in queue', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.sessionId = 'sess'
    // @ts-ignore
    node.request = jest.fn().mockResolvedValue({})
    const mockPlayer = { guildId: 'g', queue: { tracks: [] } } as any
    await expect(node.setNextTrackGapLess(mockPlayer)).rejects.toThrow('No track provided')
  })

  it('specificFilters.echo() sets echo filter', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    m.nodeManager.nodes.set('nl1', node)
    // @ts-ignore
    node.updatePlayer = jest.fn().mockResolvedValue({})
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'nl1' })
    const echoOpts = { delay: 0.5, feedback: 0.3, mix: 0.5 }
    await node.specificFilters.echo(player, echoOpts)
    expect(player.filterManager.data.echo).toEqual(echoOpts)
  })

  it('specificFilters.echo() disables echo filter', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    m.nodeManager.nodes.set('nl1', node)
    // @ts-ignore
    node.updatePlayer = jest.fn().mockResolvedValue({})
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'nl1' })
    player.filterManager.data.echo = { delay: 0.5, feedback: 0.3, mix: 0.5 } as any
    await node.specificFilters.echo(player, {} as any, true)
    expect(player.filterManager.data.echo).toBeUndefined()
  })

  it('specificFilters.resetNodeLinkFilters() clears all nodelink filters', async () => {
    const m = makeManager()
    const node = new NodeLinkNode({ host: 'localhost', id: 'nl1', port: 2333, authorization: 'pw', nodeType: 'NodeLink' }, m.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    m.nodeManager.nodes.set('nl1', node)
    // @ts-ignore
    node.updatePlayer = jest.fn().mockResolvedValue({})
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'nl1' })
    player.filterManager.data.echo = { delay: 0.5 } as any
    player.filterManager.data.chorus = { rate: 1 } as any
    const result = await node.specificFilters.resetNodeLinkFilters(player)
    expect(result).toBe(true)
    expect(player.filterManager.data.echo).toBeUndefined()
    expect(player.filterManager.data.chorus).toBeUndefined()
  })
})
