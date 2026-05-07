import { RyanlinkUtils, queueTrackEnd, applyUnresolvedData, AudioTrackSymbol } from '../src/utils/Utils'
import { RyanlinkManager, RyanlinkNode } from '../src'
import { TrackRegistry } from '../src/utils/TrackRegistry'

function makeSetup() {
  const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn() })
  const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set('local', node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local' })
  return { manager, node, player }
}

function makeTrack(id = 'track1', overrides: any = {}) {
  TrackRegistry.clear()
  const t: any = {
    encoded: 'enc_' + id,
    info: {
      identifier: id,
      title: 'Title',
      author: 'Author',
      duration: 60000,
      sourceName: 'youtube',
      isSeekable: true,
      isStream: false,
      isrc: 'ISRC123',
      ...overrides.info,
    },
    pluginInfo: { clientData: {} },
    requester: { id: 'user1' },
    userData: {},
    ...overrides,
  }
  Object.defineProperty(t, AudioTrackSymbol, { configurable: true, value: true })
  return t
}

describe('queueTrackEnd', () => {
  beforeEach(() => TrackRegistry.clear())

  it('shifts next track from queue', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    const t2 = makeTrack('t2')
    player.queue.current = t1
    player.queue.tracks.push(t2)
    const result = await queueTrackEnd(player)
    expect(result).toBe(t2)
    expect(player.queue.current).toBe(t2)
    expect(player.queue.previous[0]).toBe(t1)
  })

  it('adds current to previous', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    player.queue.current = t1
    await queueTrackEnd(player)
    expect(player.queue.previous).toContain(t1)
  })

  it('respects maxPreviousTracks limit', async () => {
    const { player } = makeSetup()
    player.queue.options.maxPreviousTracks = 2
    player.queue.previous = [makeTrack('p1'), makeTrack('p2')]
    player.queue.current = makeTrack('curr')
    await queueTrackEnd(player)
    expect(player.queue.previous.length).toBeLessThanOrEqual(2)
  })

  it('tracks recentHistory', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    player.queue.current = t1
    await queueTrackEnd(player)
    expect(player.recentHistory).toContain('ISRC123')
  })

  it('does not duplicate recentHistory entries', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    player.recentHistory = ['ISRC123']
    player.queue.current = t1
    await queueTrackEnd(player)
    expect(player.recentHistory.filter(x => x === 'ISRC123').length).toBe(1)
  })

  it('respects recentHistoryLimit', async () => {
    const { player } = makeSetup()
    player.recentHistoryLimit = 2
    player.recentHistory = ['a', 'b']
    const t1 = makeTrack('t1')
    player.queue.current = t1
    await queueTrackEnd(player)
    expect(player.recentHistory.length).toBeLessThanOrEqual(2)
  })

  it('pushes current to tracks when repeatMode=queue', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    player.queue.current = t1
    player.repeatMode = 'queue'
    // queue.add requires isTrack check — bypass by pushing directly
    const tracksBefore = player.queue.tracks.length
    await queueTrackEnd(player)
    // When repeatMode=queue, current is pushed to tracks before shifting
    // Since queue was empty, tracks should have t1 pushed then shifted as nextSong
    // The push happens before shift, so current ends up as t1 again
    expect(player.queue.current).toBe(t1)
  })

  it('dontShiftQueue=true sets current to null', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    player.queue.current = t1
    player.queue.tracks.push(makeTrack('t2'))
    const result = await queueTrackEnd(player, true)
    expect(result).toBeNull()
  })

  it('returns null when queue is empty', async () => {
    const { player } = makeSetup()
    player.queue.current = null
    const result = await queueTrackEnd(player)
    expect(result).toBeNull()
  })

  it('skips previousTrack flagged tracks', async () => {
    const { player } = makeSetup()
    const t1 = makeTrack('t1')
    t1.pluginInfo = { clientData: { previousTrack: true } }
    player.queue.current = t1
    await queueTrackEnd(player)
    expect(player.queue.previous).not.toContain(t1)
  })
})

describe('applyUnresolvedData', () => {
  beforeEach(() => TrackRegistry.clear())

  it('returns early when resTrack has no info', async () => {
    const utils = new RyanlinkUtils()
    const result = await applyUnresolvedData(null as any, { info: {} } as any, utils)
    expect(result).toBeUndefined()
  })

  it('returns early when data has no info', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = makeTrack('r1')
    const result = await applyUnresolvedData(resTrack, null as any, utils)
    expect(result).toBeUndefined()
  })

  it('copies uri from unresolved data', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = makeTrack('r1')
    const data = { info: { uri: 'https://example.com/track', title: 'T', author: 'A' }, pluginInfo: {} } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.uri).toBe('https://example.com/track')
  })

  it('applies useUnresolvedData=true overrides', async () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      playerOptions: { useUnresolvedData: true },
    })
    const utils = new RyanlinkUtils(manager)
    const resTrack = makeTrack('r1')
    const data = {
      info: { artworkUrl: 'http://art.url', title: 'New Title', author: 'New Author', uri: null },
      pluginInfo: {},
    } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.title).toBe('New Title')
    expect(resTrack.info.author).toBe('New Author')
    expect(resTrack.info.artworkUrl).toBe('http://art.url')
  })

  it('applies pluginInfo overrides when useUnresolvedData=true', async () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      playerOptions: { useUnresolvedData: true },
    })
    const utils = new RyanlinkUtils(manager)
    const resTrack = makeTrack('r1')
    const data = {
      info: { uri: null },
      pluginInfo: { artworkUrl: 'http://plugin.art', title: 'Plugin Title', author: 'Plugin Author' },
    } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.artworkUrl).toBe('http://plugin.art')
  })

  it('fixes Unknown title from unresolved data', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = makeTrack('r1', { info: { title: 'Unknown title' } })
    const data = { info: { title: 'Real Title', author: 'Author', uri: null }, pluginInfo: {} } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.title).toBe('Real Title')
  })

  it('copies extra info keys from unresolved data', async () => {
    const utils = new RyanlinkUtils()
    const resTrack = makeTrack('r1')
    const data = { info: { customField: 'custom_value', uri: null }, pluginInfo: {} } as any
    await applyUnresolvedData(resTrack, data, utils)
    expect(resTrack.info.customField).toBe('custom_value')
  })
})

describe('RyanlinkUtils - validateQueryString', () => {
  function makeNodeWithInfo(sourceManagers: string[] = ['youtube'], plugins: any[] = []) {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers, plugins }
    return { manager, node, utils: new RyanlinkUtils(manager) }
  }

  it('throws when no node info', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = null
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'hello')).toThrow('No Audio Node was provided')
  })

  it('throws when query is empty', () => {
    const { utils, node } = makeNodeWithInfo()
    expect(() => utils.validateQueryString(node, '  ')).toThrow('Query string is empty')
  })

  it('throws when speak query exceeds 100 chars', () => {
    const { utils, node } = makeNodeWithInfo()
    const longQuery = 'a'.repeat(101)
    expect(() => utils.validateQueryString(node, longQuery, 'speak')).toThrow('limited to 100 characters')
  })

  it('throws when link is blacklisted', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      linksBlacklist: ['badsite.com'],
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://badsite.com/track')).toThrow('blacklisted')
  })

  it('throws when links not allowed', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      linksAllowed: false,
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://youtube.com/watch?v=abc')).toThrow('not allowed')
  })

  it('throws when link not in whitelist', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      linksWhitelist: ['youtube.com'],
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://spotify.com/track/abc')).toThrow("isn't whitelisted")
  })

  it('passes when link is in whitelist', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      linksWhitelist: ['youtube.com'],
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://youtube.com/watch?v=abc')).not.toThrow()
  })

  it('passes for plain text query', () => {
    const { utils, node } = makeNodeWithInfo()
    expect(() => utils.validateQueryString(node, 'hello world')).not.toThrow()
  })

  it('blacklist works with regex', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      linksBlacklist: [/badsite/],
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateQueryString(node, 'https://badsite.com/track')).toThrow('blacklisted')
  })
})

describe('RyanlinkUtils - validateSourceString', () => {
  function makeNodeWithInfo(sourceManagers: string[] = ['youtube'], plugins: any[] = []) {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers, plugins }
    return { manager, node, utils: new RyanlinkUtils(manager) }
  }

  it('throws when no sourceString', () => {
    const { utils, node } = makeNodeWithInfo()
    expect(() => utils.validateSourceString(node, '' as any)).toThrow('No SourceString was provided')
  })

  it('throws when node has no info', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = null
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateSourceString(node, 'ytsearch')).toThrow('not ready yet')
  })

  it('passes when source is supported', () => {
    const { utils, node } = makeNodeWithInfo(['youtube'])
    expect(() => utils.validateSourceString(node, 'ytsearch')).not.toThrow()
  })

  it('throws when source not supported', () => {
    const { utils, node } = makeNodeWithInfo(['youtube'])
    expect(() => utils.validateSourceString(node, 'scsearch')).toThrow()
  })

  it('passes when allowCustomSources=true', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      playerOptions: { allowCustomSources: true },
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: ['youtube'], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateSourceString(node, 'customsource')).not.toThrow()
  })

  it('normalizes source aliases', () => {
    const { utils, node } = makeNodeWithInfo(['soundcloud'])
    expect(() => utils.validateSourceString(node, 'scsearch')).not.toThrow()
  })

  it('skips check when _checkForSources is false', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({
      host: 'localhost', id: 'n1', port: 2333, authorization: 'pw',
      autoChecks: { sourcesValidations: false, pluginValidations: false },
    }, manager.nodeManager)
    // @ts-ignore
    node.info = { sourceManagers: [], plugins: [] }
    const utils = new RyanlinkUtils(manager)
    expect(() => utils.validateSourceString(node, 'anysource')).not.toThrow()
  })
})

describe('RyanlinkUtils - isNode', () => {
  it('returns true for a valid RyanlinkNode', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, manager.nodeManager)
    const utils = new RyanlinkUtils(manager)
    expect(utils.isNode(node)).toBe(true)
  })

  it('returns false for plain object', () => {
    const utils = new RyanlinkUtils()
    expect(utils.isNode({} as any)).toBe(false)
  })
})
