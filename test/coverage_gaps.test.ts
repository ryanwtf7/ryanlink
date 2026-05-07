// Targeted tests for remaining uncovered lines
import { RyanlinkManager, RyanlinkNode } from '../src'
import { RyanlinkUtils, AudioTrackSymbol, UnresolvedAudioTrackSymbol, queueTrackEnd } from '../src/utils/Utils'
import { Queue } from '../src/audio/Queue'
import { TrackRegistry } from '../src/utils/TrackRegistry'

function makeManager(opts: any = {}) {
  return new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn(), ...opts })
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  return node
}

function makeSetup(opts: any = {}) {
  const manager = makeManager(opts)
  const node = makeConnectedNode(manager)
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'n1' })
  return { manager, node, player }
}

// ─── Queue.ts line 54: totalDuration with no current ───────────────────────
describe('Queue - totalDuration branch (line 54)', () => {
  it('totalDuration with no current and no tracks is 0', () => {
    const q = new Queue('g')
    expect(q.totalDuration).toBe(0)
  })

  it('totalDuration with current but no tracks', () => {
    const q = new Queue('g')
    q.current = { encoded: 'c', info: { duration: 500 } } as any
    expect(q.totalDuration).toBe(500)
  })
})

// ─── Queue.ts lines 148-150: addPrevious overflow ──────────────────────────
describe('Queue - addPrevious overflow (lines 148-150)', () => {
  it('pops oldest when exceeding maxPreviousTracks', () => {
    const q = new Queue('g', { maxPreviousTracks: 2 })
    q.addPrevious({ encoded: 'p1', info: {} } as any)
    q.addPrevious({ encoded: 'p2', info: {} } as any)
    q.addPrevious({ encoded: 'p3', info: {} } as any)
    expect(q.previous.length).toBe(2)
    expect(q.previous[0].encoded).toBe('p3')
    expect(q.previous[1].encoded).toBe('p2')
  })
})

// ─── Utils.ts lines 68-69: buildTrack with userData.requester fallback ──────
describe('Utils - buildTrack userData.requester fallback (lines 68-69)', () => {
  it('uses userData.requester when requester is not object', () => {
    TrackRegistry.clear()
    const utils = new RyanlinkUtils()
    const track = utils.buildTrack({
      encoded: 'abc',
      info: { title: 'T', author: 'A', length: 100 },
      userData: { requester: { id: 'fromUserData' } },
    } as any, null)
    expect(track.encoded).toBe('abc')
  })
})

// ─── Utils.ts lines 97-106: buildTrack debug event on error ─────────────────
describe('Utils - buildTrack debug event (lines 97-106)', () => {
  it('emits debug event when enableDebugEvents=true and build fails inside try', () => {
    const manager = makeManager({ advancedOptions: { enableDebugEvents: true } })
    const utils = new RyanlinkUtils(manager)
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    // Pass encoded + info so it enters the try block, but make TrackEntry throw
    // by providing info that causes an internal error — use a getter that throws
    const badInfo = {}
    Object.defineProperty(badInfo, 'title', { get() { throw new Error('boom') }, enumerable: true })
    expect(() => utils.buildTrack({ encoded: 'abc', info: badInfo } as any, {})).toThrow()
    expect(debugListener).toHaveBeenCalled()
  })
})

// ─── Utils.ts lines 122-131: buildUnresolvedTrack with encoded ──────────────
describe('Utils - buildUnresolvedTrack with encoded (lines 122-131)', () => {
  it('builds unresolved track from encoded string', () => {
    const utils = new RyanlinkUtils()
    const track = utils.buildUnresolvedTrack({ encoded: 'myenc123', title: 'T' } as any, { id: 'u' })
    expect(track.encoded).toBe('myenc123')
    // @ts-ignore
    expect(track[UnresolvedAudioTrackSymbol]).toBe(true)
  })

  it('buildUnresolvedTrack with UnresolvedTrack info', () => {
    const utils = new RyanlinkUtils()
    const track = utils.buildUnresolvedTrack({
      info: { title: 'Song', author: 'Artist' },
      resolve: async () => {},
    } as any, { id: 'u' })
    expect(track.info.title).toBe('Song')
  })
})

// ─── Utils.ts lines 176-182: getTransformedRequester with debug event ────────
describe('Utils - getTransformedRequester debug event (lines 176-182)', () => {
  it('emits debug when transformer throws and enableDebugEvents=true', () => {
    const manager = makeManager({
      advancedOptions: { enableDebugEvents: true },
      playerOptions: { requesterTransformer: () => { throw new Error('fail') } },
    })
    const utils = new RyanlinkUtils(manager)
    const debugListener = jest.fn()
    manager.on('debug', debugListener)
    const req = { id: 'u' }
    const result = utils.getTransformedRequester(req)
    expect(result).toBe(req)
    expect(debugListener).toHaveBeenCalled()
  })
})

// ─── Utils.ts lines 200, 205, 210: isNodeOptions optional field validation ──
describe('Utils - isNodeOptions optional field validation (lines 200-210)', () => {
  const utils = new RyanlinkUtils()

  it('rejects invalid secure type', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', secure: 'yes' } as any)).toBe(false)
  })

  it('rejects invalid sessionId type', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', sessionId: 123 } as any)).toBe(false)
  })

  it('rejects invalid id type', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', id: 123 } as any)).toBe(false)
  })

  it('rejects invalid regions type', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', regions: [1, 2] } as any)).toBe(false)
  })

  it('rejects invalid poolOptions type', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', poolOptions: 'bad' } as any)).toBe(false)
  })

  it('rejects invalid retryAmount', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', retryAmount: -1 } as any)).toBe(false)
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', retryAmount: NaN } as any)).toBe(false)
  })

  it('rejects invalid retryDelay', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', retryDelay: -1 } as any)).toBe(false)
  })

  it('rejects invalid requestTimeout', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', requestTimeout: -1 } as any)).toBe(false)
  })
})

// ─── Utils.ts lines 247-260: isUnresolvedTrack branches ─────────────────────
describe('Utils - isUnresolvedTrack branches (lines 247-260)', () => {
  const utils = new RyanlinkUtils()

  it('returns false for null', () => {
    expect(utils.isUnresolvedTrack(null as any)).toBe(false)
  })

  it('returns true via UnresolvedAudioTrackSymbol', () => {
    const t = { [UnresolvedAudioTrackSymbol]: true } as any
    expect(utils.isUnresolvedTrack(t)).toBe(true)
  })

  it('returns true for object with info.title and resolve', () => {
    const t = { info: { title: 'T' }, resolve: async () => {} } as any
    expect(utils.isUnresolvedTrack(t)).toBe(true)
  })

  it('returns true for object with encoded and resolve', () => {
    const t = { encoded: 'abc', resolve: async () => {} } as any
    expect(utils.isUnresolvedTrack(t)).toBe(true)
  })

  it('returns false for object without resolve', () => {
    const t = { info: { title: 'T' } } as any
    expect(utils.isUnresolvedTrack(t)).toBe(false)
  })
})

// ─── Utils.ts lines 272-277: getClosestTrack instance method ────────────────
describe('Utils - getClosestTrack instance method (lines 272-277)', () => {
  it('throws when no player node', async () => {
    const utils = new RyanlinkUtils()
    const unresolvedTrack = utils.buildUnresolvedTrack({ title: 'T' } as any, { id: 'u' })
    const mockPlayer = { node: null, RyanlinkManager: { utils } } as any
    await expect(utils.getClosestTrack(unresolvedTrack, mockPlayer)).rejects.toThrow()
  })
})

// ─── Utils.ts lines 292-297: validateQueryString with no sourceManagers ─────
describe('Utils - validateQueryString no sourceManagers (lines 292-297)', () => {
  it('throws when node has no sourceManagers', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: [], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'hello')).toThrow('no sourceManagers enabled')
  })
})

// ─── Utils.ts lines 316-337: validateQueryString with matchers ──────────────
describe('Utils - validateQueryString with matchers (lines 316-337)', () => {
  it('throws when URL matches unsupported source', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    node.sourceRegistry.registerMatcher('soundcloud', /soundcloud\.com/)
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://soundcloud.com/track/abc')).toThrow("has not 'soundcloud' enabled")
  })

  it('passes when URL matches supported source', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    node.sourceRegistry.registerMatcher('youtube', /youtube\.com/)
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://youtube.com/watch?v=abc')).not.toThrow()
  })

  it('passes when URL matches plugin source', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [{ name: 'spotify-plugin' }] }
    node.sourceRegistry.registerMatcher('spotify', /spotify\.com/)
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://spotify.com/track/abc')).not.toThrow()
  })
})

// ─── Utils.ts lines 356-360: findSourceOfQuery dynamic prefix ───────────────
describe('Utils - findSourceOfQuery dynamic prefix (lines 356-360)', () => {
  it('detects dynamic prefix from node sourceManagers', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['myplatform'] }
    const utils = new RyanlinkUtils(manager)
    const result = utils.findSourceOfQuery('myplatform:some query', node)
    expect(result).toBe('myplatform')
  })

  it('returns undefined when prefix not in sourceManagers', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'] }
    const utils = new RyanlinkUtils(manager)
    const result = utils.findSourceOfQuery('unknown:query', node)
    expect(result).toBeUndefined()
  })
})

// ─── Utils.ts lines 369-372: extractSourceOfQuery with mapping ──────────────
describe('Utils - extractSourceOfQuery with registry mapping (lines 369-372)', () => {
  it('maps source alias to target via registry', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    node.sourceRegistry.registerMapping('yt', 'ytsearch')
    const utils = new RyanlinkUtils(manager)
    const result = utils.transformQuery('yt:hello world', node)
    expect(result.source).toBe('ytsearch')
    expect(result.query).toBe('hello world')
  })
})

// ─── Utils.ts lines 537-549: queueTrackEnd error with autoSkip ──────────────
describe('Utils - queueTrackEnd error handling (lines 537-549)', () => {
  beforeEach(() => TrackRegistry.clear())

  it('emits trackError when unresolved track fails to resolve', async () => {
    const { player, manager } = makeSetup()
    const trackErrorListener = jest.fn()
    manager.on('trackError', trackErrorListener)

    const unresolvedTrack = {
      encoded: undefined,
      info: { title: 'T', author: 'A' },
      resolve: jest.fn().mockRejectedValue(new Error('resolve failed')),
      [UnresolvedAudioTrackSymbol]: true,
    } as any
    Object.defineProperty(unresolvedTrack, UnresolvedAudioTrackSymbol, { value: true, configurable: true })

    player.queue.current = null
    player.queue.tracks.push(unresolvedTrack)
    await queueTrackEnd(player)
    expect(trackErrorListener).toHaveBeenCalled()
  })

  it('emits debug event on resolve error when enableDebugEvents=true', async () => {
    const { player, manager } = makeSetup({ advancedOptions: { enableDebugEvents: true } })
    const debugListener = jest.fn()
    manager.on('debug', debugListener)

    const unresolvedTrack = {
      encoded: undefined,
      info: { title: 'T', author: 'A' },
      resolve: jest.fn().mockRejectedValue(new Error('resolve failed')),
      [UnresolvedAudioTrackSymbol]: true,
    } as any
    Object.defineProperty(unresolvedTrack, UnresolvedAudioTrackSymbol, { value: true, configurable: true })

    player.queue.tracks.push(unresolvedTrack)
    await queueTrackEnd(player)
    expect(debugListener).toHaveBeenCalled()
  })
})

// ─── Utils.ts lines 572-622: validateSourceString alias normalization ────────
describe('Utils - validateSourceString alias normalization (lines 572-622)', () => {
  function makeNodeWithSources(sourceManagers: string[]) {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers, plugins: [] }
    return { manager, node, utils: new RyanlinkUtils(manager) }
  }

  it('normalizes amsearch -> applemusic', () => {
    const { utils, node } = makeNodeWithSources(['applemusic'])
    expect(() => utils.validateSourceString(node, 'amsearch')).not.toThrow()
  })

  it('normalizes ytsearch -> youtube', () => {
    const { utils, node } = makeNodeWithSources(['youtube'])
    expect(() => utils.validateSourceString(node, 'ytsearch')).not.toThrow()
  })

  it('normalizes scsearch -> soundcloud', () => {
    const { utils, node } = makeNodeWithSources(['soundcloud'])
    expect(() => utils.validateSourceString(node, 'scsearch')).not.toThrow()
  })

  it('normalizes spsearch -> spotify', () => {
    const { utils, node } = makeNodeWithSources(['spotify'])
    expect(() => utils.validateSourceString(node, 'spsearch')).not.toThrow()
  })

  it('normalizes dzsearch -> deezer', () => {
    const { utils, node } = makeNodeWithSources(['deezer'])
    expect(() => utils.validateSourceString(node, 'dzsearch')).not.toThrow()
  })

  it('normalizes ymsearch -> yandexmusic', () => {
    const { utils, node } = makeNodeWithSources(['yandexmusic'])
    expect(() => utils.validateSourceString(node, 'ymsearch')).not.toThrow()
  })

  it('normalizes vksearch -> vkmusic', () => {
    const { utils, node } = makeNodeWithSources(['vkmusic'])
    expect(() => utils.validateSourceString(node, 'vksearch')).not.toThrow()
  })

  it('normalizes qbsearch -> qobuz', () => {
    const { utils, node } = makeNodeWithSources(['qobuz'])
    expect(() => utils.validateSourceString(node, 'qbsearch')).not.toThrow()
  })

  it('normalizes pdsearch -> pandora', () => {
    const { utils, node } = makeNodeWithSources(['pandora'])
    expect(() => utils.validateSourceString(node, 'pdsearch')).not.toThrow()
  })

  it('normalizes fttssearch -> flowery-tts', () => {
    const { utils, node } = makeNodeWithSources(['flowery-tts'])
    expect(() => utils.validateSourceString(node, 'fttssearch')).not.toThrow()
  })

  it('passes when source matches via plugin name', () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: [], plugins: [{ name: 'spotify-plugin' }] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateSourceString(node, 'spsearch')).not.toThrow()
  })

  it('passes when source matches via sourceManagers with dash', () => {
    const { utils, node } = makeNodeWithSources(['flowery-tts'])
    expect(() => utils.validateSourceString(node, 'flowery-tts')).not.toThrow()
  })
})

// ─── Filters.ts line 148: set() with null pluginFilters ─────────────────────
describe('Filters - set() pluginFilters null branch (line 148)', () => {
  it('initializes pluginFilters when null', async () => {
    const { player } = makeSetup()
    player.filterManager.data.pluginFilters = null as any
    await player.filterManager.set('myPlugin' as any, { x: 1 } as any, true)
    expect((player.filterManager.data.pluginFilters as any)['myPlugin']).toEqual({ x: 1 })
  })

  it('initializes pluginFilters when undefined', async () => {
    const { player } = makeSetup()
    player.filterManager.data.pluginFilters = undefined as any
    await player.filterManager.set('myPlugin' as any, { x: 1 } as any, true)
    expect((player.filterManager.data.pluginFilters as any)['myPlugin']).toEqual({ x: 1 })
  })
})

// ─── Filters.ts line 207: checkFiltersState with null data ──────────────────
describe('Filters - checkFiltersState with null data (line 207)', () => {
  it('initializes data when null', () => {
    const { player } = makeSetup()
    const fm = player.filterManager
    fm.data = null as any
    fm.checkFiltersState()
    expect(fm.data).toBeDefined()
  })
})

// ─── NodeManager.ts lines 50-62, 67-74, 78-86: connect/disconnect/reconnect ─
describe('NodeManager - connect/disconnect/reconnect with connected nodes', () => {
  it('disconnectAll() disconnects connected nodes without destroying players', async () => {
    const manager = makeManager()
    const node = makeConnectedNode(manager)
    // @ts-ignore
    node.disconnect = jest.fn()
    // @ts-ignore
    node.destroy = jest.fn()
    const count = await manager.nodeManager.disconnectAll(false, false)
    expect(count).toBe(1)
    // @ts-ignore
    expect(node.disconnect).toHaveBeenCalled()
  })

  it('disconnectAll() destroys players when destroyPlayers=true', async () => {
    const manager = makeManager()
    const node = makeConnectedNode(manager)
    // @ts-ignore
    node.destroy = jest.fn()
    const count = await manager.nodeManager.disconnectAll(false, true)
    expect(count).toBe(1)
    // @ts-ignore
    expect(node.destroy).toHaveBeenCalled()
  })

  it('connectAll() connects disconnected nodes', async () => {
    const manager = makeManager()
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    manager.nodeManager.nodes.set('n1', node)
    // @ts-ignore
    node.connect = jest.fn()
    const count = await manager.nodeManager.connectAll()
    expect(count).toBe(1)
    // @ts-ignore
    expect(node.connect).toHaveBeenCalled()
  })

  it('reconnectAll() reconnects all nodes', async () => {
    const manager = makeManager()
    const node = makeConnectedNode(manager)
    // @ts-ignore
    node.destroy = jest.fn()
    // @ts-ignore
    node.connect = jest.fn()
    const count = await manager.nodeManager.reconnectAll()
    expect(count).toBe(1)
    // @ts-ignore
    expect(node.destroy).toHaveBeenCalled()
    // @ts-ignore
    expect(node.connect).toHaveBeenCalled()
  })
})

// ─── NodeManager.ts lines 105,110,115,120,125: leastUsedNodes with no nodes ─
describe('NodeManager - leastUsedNodes all sort types with connected node', () => {
  function makeManagerWithNode() {
    const manager = makeManager()
    const node = makeConnectedNode(manager)
    node.stats.memory.used = 100
    node.stats.cpu.audioLoad = 0.3
    node.stats.cpu.systemLoad = 0.5
    node.calls = 5
    node.stats.playingPlayers = 2
    node.stats.players = 3
    return { manager, node }
  }

  it('leastUsedNodes memory sort', () => {
    const { manager } = makeManagerWithNode()
    expect(manager.nodeManager.leastUsedNodes('memory').length).toBe(1)
  })

  it('leastUsedNodes cpuLavalink sort', () => {
    const { manager } = makeManagerWithNode()
    expect(manager.nodeManager.leastUsedNodes('cpuLavalink').length).toBe(1)
  })

  it('leastUsedNodes cpuSystem sort', () => {
    const { manager } = makeManagerWithNode()
    expect(manager.nodeManager.leastUsedNodes('cpuSystem').length).toBe(1)
  })

  it('leastUsedNodes calls sort', () => {
    const { manager } = makeManagerWithNode()
    expect(manager.nodeManager.leastUsedNodes('calls').length).toBe(1)
  })

  it('leastUsedNodes playingPlayers sort', () => {
    const { manager } = makeManagerWithNode()
    expect(manager.nodeManager.leastUsedNodes('playingPlayers').length).toBe(1)
  })
})
