import {
  RyanlinkUtils,
  MiniMap,
  parseConnectionUrl,
  safeStringify,
  AudioTrackSymbol,
  UnresolvedAudioTrackSymbol,
} from '../src/utils/Utils'
import { RyanlinkManager } from '../src'

function makeManager() {
  return new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
}

describe('parseConnectionUrl', () => {
  it('parses ryanlink:// url', () => {
    const result = parseConnectionUrl('ryanlink://myid:mypass@localhost:2333')
    expect(result.nodeType).toBe('Core')
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(2333)
    expect(result.authorization).toBe('mypass')
    expect(result.id).toBe('myid')
  })

  it('parses nodelink:// url', () => {
    const result = parseConnectionUrl('nodelink://myid:mypass@localhost:2333')
    expect(result.nodeType).toBe('NodeLink')
  })

  it('throws on invalid protocol', () => {
    expect(() => parseConnectionUrl('http://localhost:2333')).toThrow()
  })
})

describe('safeStringify (module-level)', () => {
  it('handles circular references', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    const str = safeStringify(obj)
    expect(str).toContain('[Circular]')
  })

  it('handles symbols', () => {
    const obj = { s: Symbol('test') }
    expect(safeStringify(obj)).toBe('{}')
  })

  it('handles functions', () => {
    const obj = { fn: () => {} }
    expect(safeStringify(obj)).toBe('{}')
  })

  it('handles bigint', () => {
    const obj = { n: BigInt(42) }
    const str = safeStringify(obj)
    expect(str).toContain('42')
  })

  it('handles padding', () => {
    const str = safeStringify({ a: 1 }, 2)
    expect(str).toContain('\n')
  })

  it('handles null', () => {
    expect(safeStringify(null)).toBe('null')
  })
})

describe('RyanlinkUtils', () => {
  let utils: RyanlinkUtils
  let manager: RyanlinkManager

  beforeEach(() => {
    manager = makeManager()
    utils = new RyanlinkUtils(manager)
  })

  it('RyanlinkManager getter returns manager', () => {
    expect(utils.RyanlinkManager).toBe(manager)
  })

  it('RyanlinkManager getter returns undefined when no manager', () => {
    const u = new RyanlinkUtils()
    expect(u.RyanlinkManager).toBeUndefined()
  })

  it('buildPluginInfo() merges pluginInfo', () => {
    const data = { pluginInfo: { artworkUrl: 'http://art' } }
    const result = utils.buildPluginInfo(data, { client: 'test' })
    expect(result.artworkUrl).toBe('http://art')
    expect(result.clientData).toEqual({ client: 'test' })
  })

  it('buildPluginInfo() uses plugin fallback', () => {
    const data = { plugin: { title: 'T' } }
    const result = utils.buildPluginInfo(data)
    expect(result.title).toBe('T')
  })

  it('isNodeOptions() validates correct options', () => {
    expect(utils.isNodeOptions({ host: 'localhost', port: 2333, authorization: 'pw' } as any)).toBe(true)
  })

  it('isNodeOptions() rejects missing host', () => {
    expect(utils.isNodeOptions({ port: 2333, authorization: 'pw' } as any)).toBe(false)
  })

  it('isNodeOptions() rejects invalid port', () => {
    expect(utils.isNodeOptions({ host: 'localhost', port: -1, authorization: 'pw' } as any)).toBe(false)
    expect(utils.isNodeOptions({ host: 'localhost', port: 99999, authorization: 'pw' } as any)).toBe(false)
    expect(utils.isNodeOptions({ host: 'localhost', port: NaN, authorization: 'pw' } as any)).toBe(false)
  })

  it('isNodeOptions() rejects missing authorization', () => {
    expect(utils.isNodeOptions({ host: 'localhost', port: 2333 } as any)).toBe(false)
  })

  it('isNodeOptions() rejects null/array/non-object', () => {
    expect(utils.isNodeOptions(null as any)).toBe(false)
    expect(utils.isNodeOptions([] as any)).toBe(false)
    expect(utils.isNodeOptions('str' as any)).toBe(false)
  })

  it('isNodeOptions() validates optional fields', () => {
    expect(utils.isNodeOptions({ host: 'h', port: 80, authorization: 'pw', secure: true, id: 'myid', regions: ['us'] } as any)).toBe(true)
  })

  it('isNotBrokenTrack() returns false for short track', () => {
    const t = { [AudioTrackSymbol]: true, info: { duration: 1000 } } as any
    expect(utils.isNotBrokenTrack(t)).toBe(false)
  })

  it('isNotBrokenTrack() returns false for NaN duration', () => {
    const t = { [AudioTrackSymbol]: true, info: { duration: NaN } } as any
    expect(utils.isNotBrokenTrack(t)).toBe(false)
  })

  it('isNotBrokenTrack() returns true for valid track', () => {
    const t = { [AudioTrackSymbol]: true, encoded: 'abc', info: { duration: 60000 } } as any
    expect(utils.isNotBrokenTrack(t)).toBe(true)
  })

  it('isUnresolvedTrackQuery() returns true for query object', () => {
    expect(utils.isUnresolvedTrackQuery({ title: 'Test' } as any)).toBe(true)
  })

  it('isUnresolvedTrackQuery() returns false for non-query', () => {
    expect(utils.isUnresolvedTrackQuery({ info: {} } as any)).toBe(false)
  })

  it('typedLowerCase() lowercases strings', () => {
    expect(utils.typedLowerCase('HELLO')).toBe('hello')
  })

  it('typedLowerCase() returns non-strings as-is', () => {
    expect(utils.typedLowerCase(42)).toBe(42)
    expect(utils.typedLowerCase(null)).toBe(null)
  })

  it('getTransformedRequester() returns requester as-is without transformer', () => {
    const req = { id: 'user1' }
    expect(utils.getTransformedRequester(req)).toBe(req)
  })

  it('getTransformedRequester() applies transformer', () => {
    const m = new RyanlinkManager({
      nodes: [],
      client: { id: '1' },
      sendToShard: () => {},
      playerOptions: { requesterTransformer: (r: any) => ({ transformed: r.id }) },
    })
    const u = new RyanlinkUtils(m)
    expect(u.getTransformedRequester({ id: 'user1' })).toEqual({ transformed: 'user1' })
  })

  it('getTransformedRequester() handles transformer error', () => {
    const m = new RyanlinkManager({
      nodes: [],
      client: { id: '1' },
      sendToShard: () => {},
      playerOptions: { requesterTransformer: () => { throw new Error('fail') } },
    })
    const u = new RyanlinkUtils(m)
    const req = { id: 'user1' }
    expect(u.getTransformedRequester(req)).toBe(req)
  })

  it('isNode() returns false for null', () => {
    expect(utils.isNode(null as any)).toBe(false)
  })

  it('isNode() returns false for plain object', () => {
    expect(utils.isNode({} as any)).toBe(false)
  })

  it('findSourceOfQuery() returns undefined for plain query', () => {
    expect(utils.findSourceOfQuery('hello world')).toBeUndefined()
  })

  it('findSourceOfQuery() detects registered source prefix', () => {
    const { RyanlinkNode } = require('../src/node/Node')
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }, m.nodeManager)
    node.sourceRegistry.registerMapping('yt', 'ytsearch')
    const result = utils.findSourceOfQuery('yt:hello', node)
    expect(result).toBe('yt')
  })

  it('transformQuery() handles string query', () => {
    const result = utils.transformQuery('hello world')
    expect(result.query).toBe('hello world')
    expect(result.source).toBeDefined()
  })

  it('transformQuery() handles object query', () => {
    const result = utils.transformQuery({ query: 'test', source: 'ytsearch' })
    expect(result.query).toBe('test')
  })

  it('transformAudioSearchQuery() handles string query', () => {
    const result = utils.transformAudioSearchQuery('hello')
    expect(result.query).toBe('hello')
    expect(Array.isArray(result.types)).toBe(true)
  })

  it('transformAudioSearchQuery() handles object query with types', () => {
    const result = utils.transformAudioSearchQuery({ query: 'test', types: ['track', 'album'] })
    expect(result.types).toContain('track')
    expect(result.types).toContain('album')
  })

  it('safeStringify() instance method works', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    const str = utils.safeStringify(obj)
    expect(str).toContain('[Circular]')
  })

  it('buildUnresolvedTrack() throws on undefined query', () => {
    expect(() => utils.buildUnresolvedTrack(undefined as any, {})).toThrow()
  })

  it('buildUnresolvedTrack() builds from title query', () => {
    const track = utils.buildUnresolvedTrack({ title: 'My Song' } as any, { id: 'u' })
    expect(track.info.title).toBe('My Song')
    // @ts-ignore
    expect(track[UnresolvedAudioTrackSymbol]).toBe(true)
  })
})

describe('MiniMap', () => {
  it('constructs with initial data', () => {
    const map = new MiniMap([['a', 1], ['b', 2]])
    expect(map.size).toBe(2)
    expect(map.get('a')).toBe(1)
  })

  it('filter() returns filtered MiniMap', () => {
    const map = new MiniMap([['a', 1], ['b', 2], ['c', 3]])
    const filtered = map.filter((v) => v > 1)
    expect(filtered.size).toBe(2)
    expect(filtered.has('a')).toBe(false)
    expect(filtered.has('b')).toBe(true)
  })

  it('filter() with thisArg', () => {
    const map = new MiniMap([['a', 1], ['b', 2]])
    const ctx = { min: 1 }
    const filtered = map.filter(function(v) { return v > (this as any).min }, ctx)
    expect(filtered.size).toBe(1)
  })

  it('map() transforms values', () => {
    const map = new MiniMap([['a', 1], ['b', 2]])
    const result = map.map((v) => v * 10)
    expect(result).toEqual([10, 20])
  })

  it('map() with thisArg', () => {
    const map = new MiniMap([['a', 1]])
    const ctx = { mult: 5 }
    const result = map.map(function(v) { return v * (this as any).mult }, ctx)
    expect(result).toEqual([5])
  })

  it('toJSON() returns entries array', () => {
    const map = new MiniMap([['a', 1], ['b', 2]])
    const json = map.toJSON()
    expect(json).toEqual([['a', 1], ['b', 2]])
  })

  it('empty MiniMap filter returns empty', () => {
    const map = new MiniMap<string, number>()
    expect(map.filter(() => true).size).toBe(0)
  })

  it('empty MiniMap map returns empty array', () => {
    const map = new MiniMap<string, number>()
    expect(map.map((v) => v)).toEqual([])
  })
})
