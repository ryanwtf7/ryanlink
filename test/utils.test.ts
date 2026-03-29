import { fn } from './mock'
import {
  RyanlinkUtils,
  MiniMap,
  AudioTrackSymbol,
  UnresolvedAudioTrackSymbol,
  AudioQueueSymbol,
  AudioNodeSymbol,
  parseConnectionUrl,
  safeStringify,
} from '../src/utils/Utils'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTrack(overrides: Record<string, any> = {}) {
  const t: any = {
    encoded: 'base64encodedtrack==',
    info: {
      identifier: 'abc123',
      title: 'Test Track',
      author: 'Test Author',
      duration: 180000,
      artworkUrl: 'https://example.com/art.jpg',
      uri: 'https://youtube.com/watch?v=abc123',
      sourceName: 'youtube',
      isSeekable: true,
      isStream: false,
      isrc: null,
    },
    userData: {},
    pluginInfo: {},
    requester: { id: 'user1' },
    ...overrides,
  }
  Object.defineProperty(t, AudioTrackSymbol, { configurable: true, value: true })
  return t
}

function makeUnresolvedTrack(overrides: Record<string, any> = {}) {
  const t: any = {
    info: { title: 'Unresolved Track', author: 'Someone' },
    requester: { id: 'user1' },
    resolve: fn(),
    ...overrides,
  }
  Object.defineProperty(t, UnresolvedAudioTrackSymbol, { configurable: true, value: true })
  return t
}

// ─── safeStringify ──────────────────────────────────────────────────────────

describe('safeStringify', () => {
  it('serialises plain objects', () => {
    expect(safeStringify({ a: 1 })).toBe('{"a":1}')
  })

  it('handles null', () => {
    expect(safeStringify(null)).toBe('null')
  })

  it('handles arrays', () => {
    expect(safeStringify([1, 2, 3])).toBe('[1,2,3]')
  })

  it('handles circular references gracefully', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    expect(() => safeStringify(obj)).not.toThrow()
  })

  it('respects indent parameter', () => {
    const result = safeStringify({ a: 1 }, 2)
    expect(result).toContain('\n')
  })
})

// ─── parseConnectionUrl ────────────────────────────────────────────────────

describe('parseConnectionUrl', () => {
  it('parses a ryanlink:// URL correctly', () => {
    const result = parseConnectionUrl('ryanlink://myid:mypassword@localhost:2333')
    expect(result.authorization).toBe('mypassword')
    expect(result.host).toBe('localhost')
    expect(result.port).toBe(2333)
    expect(result.nodeType).toBe('Core')
    expect(result.id).toBe('myid')
  })

  it('parses a nodelink:// URL correctly', () => {
    const result = parseConnectionUrl('nodelink://myid:pass@127.0.0.1:8080')
    expect(result.nodeType).toBe('NodeLink')
    expect(result.host).toBe('127.0.0.1')
    expect(result.port).toBe(8080)
  })

  it('throws on invalid protocol', () => {
    expect(() => parseConnectionUrl('http://user:pass@host:1234')).toThrow()
  })
})

// ─── MiniMap ─────────────────────────────────────────────────────────────────

describe('MiniMap', () => {
  it('extends Map', () => {
    const m = new MiniMap<string, number>()
    expect(m instanceof Map).toBe(true)
  })

  it('set and get work', () => {
    const m = new MiniMap<string, number>([['a', 1]])
    expect(m.get('a')).toBe(1)
  })

  it('filter returns matching entries', () => {
    const m = new MiniMap<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const filtered = m.filter((v) => v > 1)
    expect(filtered.size).toBe(2)
    expect(filtered.has('a')).toBe(false)
    expect(filtered.has('b')).toBe(true)
  })

  it('filter returns empty MiniMap when nothing matches', () => {
    const m = new MiniMap<string, number>([['a', 1]])
    const filtered = m.filter((v) => v > 100)
    expect(filtered.size).toBe(0)
  })

  it('map transforms values', () => {
    const m = new MiniMap<string, number>([
      ['a', 1],
      ['b', 2],
    ])
    const result = m.map((v) => v * 2)
    expect(result).toEqual([2, 4])
  })

  it('toJSON returns entries array', () => {
    const m = new MiniMap<string, number>([['x', 10]])
    const json = m.toJSON()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0]).toEqual(['x', 10])
  })
})

// ─── RyanlinkUtils ────────────────────────────────────────────────────────────

describe('RyanlinkUtils', () => {
  let utils: RyanlinkUtils

  beforeEach(() => {
    utils = new RyanlinkUtils()
  })

  // isTrack
  describe('isTrack', () => {
    it('returns true for a valid track with TrackSymbol', () => {
      expect(utils.isTrack(makeTrack())).toBe(true)
    })

    it('returns true for a plain track object without symbol', () => {
      const t: any = {
        encoded: 'abc==',
        info: { title: 'T' },
      }
      expect(utils.isTrack(t)).toBe(true)
    })

    it('returns false for null', () => {
      expect(utils.isTrack(null as any)).toBe(false)
    })

    it('returns false for unresolved track', () => {
      expect(utils.isTrack(makeUnresolvedTrack())).toBe(false)
    })

    it('returns false for object without encoded', () => {
      expect(utils.isTrack({ info: { title: 'x' } } as any)).toBe(false)
    })
  })

  // isUnresolvedTrack
  describe('isUnresolvedTrack', () => {
    it('returns true for unresolved track with symbol', () => {
      expect(utils.isUnresolvedTrack(makeUnresolvedTrack())).toBe(true)
    })

    it('returns false for a resolved track', () => {
      expect(utils.isUnresolvedTrack(makeTrack())).toBe(false)
    })

    it('returns false for null', () => {
      expect(utils.isUnresolvedTrack(null as any)).toBe(false)
    })
  })

  // isUnresolvedTrackQuery
  describe('isUnresolvedTrackQuery', () => {
    it('returns true for object with title but no info', () => {
      expect(utils.isUnresolvedTrackQuery({ title: 'Song' } as any)).toBe(true)
    })

    it('returns false for object with info', () => {
      expect(utils.isUnresolvedTrackQuery({ info: { title: 'Song' } } as any)).toBe(false)
    })
  })

  // isNotBrokenTrack
  describe('isNotBrokenTrack', () => {
    it('returns true for a valid track with sufficient duration', () => {
      const t = makeTrack()
      expect(utils.isNotBrokenTrack(t, 1000)).toBe(true)
    })

    it('returns false for track with duration below minimum', () => {
      const t = makeTrack({ info: { ...makeTrack().info, duration: 100 } })
      expect(utils.isNotBrokenTrack(t, 29000)).toBe(false)
    })

    it('returns false for track with NaN duration', () => {
      const t = makeTrack({ info: { ...makeTrack().info, duration: NaN } })
      expect(utils.isNotBrokenTrack(t)).toBe(false)
    })
  })

  // buildTrack
  describe('buildTrack', () => {
    it('builds a track from LavalinkTrack data', () => {
      const data: any = {
        encoded: 'base64==',
        info: {
          identifier: 'id1',
          title: 'My Song',
          author: 'Artist',
          length: 200000,
          artworkUrl: null,
          uri: 'https://example.com',
          sourceName: 'youtube',
          isSeekable: true,
          isStream: false,
          isrc: null,
        },
        userData: {},
        pluginInfo: {},
      }
      const track = utils.buildTrack(data, { id: 'user1' })
      expect(track.encoded).toBe('base64==')
      expect(track.info.title).toBe('My Song')
      expect(track.info.duration).toBe(200000)
    })

    it('throws if encoded is missing', () => {
      expect(() => utils.buildTrack({ info: {} } as any, null)).toThrow()
    })

    it('throws if info is missing', () => {
      expect(() => utils.buildTrack({ encoded: 'abc==' } as any, null)).toThrow()
    })
  })

  // buildUnresolvedTrack
  describe('buildUnresolvedTrack', () => {
    it('builds an unresolved track from query', () => {
      const t = utils.buildUnresolvedTrack({ title: 'Song', author: 'Artist' } as any, { id: 'u1' })
      expect(utils.isUnresolvedTrack(t)).toBe(true)
      expect(typeof t.resolve).toBe('function')
    })

    it('throws if query is undefined', () => {
      expect(() => utils.buildUnresolvedTrack(undefined as any, null)).toThrow()
    })
  })

  // isNodeOptions
  describe('isNodeOptions', () => {
    it('returns true for valid node options', () => {
      expect(utils.isNodeOptions({ host: 'localhost', port: 2333, authorization: 'youshallnotpass' })).toBe(true)
    })

    it('returns false if host is missing', () => {
      expect(utils.isNodeOptions({ port: 2333, authorization: 'pass' } as any)).toBe(false)
    })

    it('returns false if port is out of range', () => {
      expect(utils.isNodeOptions({ host: 'localhost', port: 99999, authorization: 'pass' })).toBe(false)
    })

    it('returns false if authorization is empty', () => {
      expect(utils.isNodeOptions({ host: 'localhost', port: 2333, authorization: '' })).toBe(false)
    })

    it('returns false for null', () => {
      expect(utils.isNodeOptions(null as any)).toBe(false)
    })

    it('returns false for array', () => {
      expect(utils.isNodeOptions([] as any)).toBe(false)
    })
  })

  // findSourceOfQuery
  describe('findSourceOfQuery', () => {
    it('detects ytsearch prefix', () => {
      const result = utils.findSourceOfQuery('ytsearch:my song')
      expect(result).toBe('ytsearch')
    })

    it('detects scsearch prefix', () => {
      const result = utils.findSourceOfQuery('scsearch:my song')
      expect(result).toBe('scsearch')
    })

    it('returns null for plain query', () => {
      expect(utils.findSourceOfQuery('just a song name')).toBeNull()
    })

    it('returns null for http/https (not a source prefix)', () => {
      expect(utils.findSourceOfQuery('https://youtube.com/watch?v=abc')).toBeNull()
    })
  })

  // transformQuery
  describe('transformQuery', () => {
    it('handles string query', () => {
      const result = utils.transformQuery('my song')
      expect(result.query).toBe('my song')
    })

    it('handles object query with source', () => {
      const result = utils.transformQuery({ query: 'my song', source: 'scsearch' as any })
      expect(result.query).toBe('my song')
    })

    it('strips source prefix from string query', () => {
      const result = utils.transformQuery('ytsearch:my song')
      expect(result.query).toBe('my song')
      expect(result.source).toBe('ytsearch')
    })
  })

  // Symbols
  describe('Symbols', () => {
    it('TrackSymbol is a Symbol', () => {
      expect(typeof AudioTrackSymbol).toBe('symbol')
    })

    it('UnresolvedTrackSymbol is a Symbol', () => {
      expect(typeof UnresolvedAudioTrackSymbol).toBe('symbol')
    })

    it('QueueSymbol is a Symbol', () => {
      expect(typeof AudioQueueSymbol).toBe('symbol')
    })

    it('NodeSymbol is a Symbol', () => {
      expect(typeof AudioNodeSymbol).toBe('symbol')
    })

    it('all symbols are unique', () => {
      const syms = [AudioTrackSymbol, UnresolvedAudioTrackSymbol, AudioQueueSymbol, AudioNodeSymbol]
      expect(new Set(syms).size).toBe(4)
    })
  })
})
