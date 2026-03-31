import { fn } from './mock'
import { Queue, QueueSaver, DefaultQueueStore } from '../src/audio/Queue'
import { AudioTrackSymbol, UnresolvedAudioTrackSymbol } from '../src/utils/Utils'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTrack(id: string, duration = 180000): any {
  const t: any = {
    encoded: `encoded_${id}`,
    info: {
      identifier: id,
      title: `Track ${id}`,
      author: `Artist ${id}`,
      duration,
      uri: `https://example.com/${id}`,
      sourceName: 'youtube',
      isSeekable: true,
      isStream: false,
      artworkUrl: null,
      isrc: null,
    },
    userData: {},
    pluginInfo: {},
    requester: { id: 'user1' },
  }
  Object.defineProperty(t, AudioTrackSymbol, { configurable: true, value: true })
  return t
}

function makeUnresolved(title: string): any {
  const t: any = {
    info: { title, author: 'Unknown' },
    requester: { id: 'user1' },
    resolve: fn(),
  }
  Object.defineProperty(t, UnresolvedAudioTrackSymbol, { configurable: true, value: true })
  return t
}

function makeQueue(guildId = 'guild1') {
  const store = new DefaultQueueStore()
  const saver = new QueueSaver({ maxPreviousTracks: 5, queueStore: store })
  return new Queue(guildId, {}, saver, { maxPreviousTracks: 5, queueStore: store })
}

// ─── DefaultQueueStore ───────────────────────────────────────────────────────

describe('DefaultQueueStore', () => {
  let store: DefaultQueueStore

  beforeEach(() => {
    store = new DefaultQueueStore()
  })

  it('get returns undefined for unknown guild', async () => {
    expect(await store.get('unknown')).toBeUndefined()
  })

  it('set and get round-trip', async () => {
    const data: any = { current: null, previous: [], tracks: [] }
    await store.set('g1', data)
    expect(await store.get('g1')).toEqual(data)
  })

  it('delete removes entry', async () => {
    await store.set('g1', { current: null, previous: [], tracks: [] } as any)
    await store.delete('g1')
    expect(await store.get('g1')).toBeUndefined()
  })

  it('stringify returns stringified value', async () => {
    const val: any = { current: null, previous: [], tracks: [] }
    expect(await store.stringify(val)).toBe(JSON.stringify(val))
  })

  it('parse returns value as-is', async () => {
    const val: any = { current: null, previous: [], tracks: [] }
    expect(await store.parse(val)).toBe(val)
  })
})

// ─── QueueSaver ──────────────────────────────────────────────────────────────

describe('QueueSaver', () => {
  it('uses default maxPreviousTracks of 25 when not specified', () => {
    const saver = new QueueSaver({} as any)
    expect(saver.options.maxPreviousTracks).toBe(25)
  })

  it('uses provided maxPreviousTracks', () => {
    const saver = new QueueSaver({ maxPreviousTracks: 10 } as any)
    expect(saver.options.maxPreviousTracks).toBe(10)
  })

  it('set and get round-trip', async () => {
    const store = new DefaultQueueStore()
    const saver = new QueueSaver({ maxPreviousTracks: 5, queueStore: store })
    const data: any = { current: null, previous: [], tracks: [] }
    await saver.set('g1', data)
    const result = await saver.get('g1')
    expect(result).toEqual(data)
  })
})

// ─── Queue ───────────────────────────────────────────────────────────────────

describe('Queue', () => {
  let queue: Queue

  beforeEach(() => {
    queue = makeQueue()
  })

  // Initial state
  describe('initial state', () => {
    it('starts with empty tracks', () => {
      expect(queue.tracks).toHaveLength(0)
    })

    it('starts with empty previous', () => {
      expect(queue.previous).toHaveLength(0)
    })

    it('starts with null current', () => {
      expect(queue.current).toBeNull()
    })
  })

  // add
  describe('add', () => {
    it('adds a single track', async () => {
      const t = makeTrack('t1')
      await queue.add(t)
      expect(queue.tracks).toHaveLength(1)
      expect(queue.tracks[0].info.identifier).toBe('t1')
    })

    it('adds multiple tracks', async () => {
      await queue.add([makeTrack('a'), makeTrack('b'), makeTrack('c')])
      expect(queue.tracks).toHaveLength(3)
    })

    it('adds at specific index', async () => {
      await queue.add(makeTrack('first'))
      await queue.add(makeTrack('last'))
      await queue.add(makeTrack('middle'), 1)
      expect(queue.tracks[1].info.identifier).toBe('middle')
    })

    it('ignores non-track objects', async () => {
      await queue.add([makeTrack('valid'), { info: {} } as any])
      expect(queue.tracks).toHaveLength(1)
    })

    it('accepts unresolved tracks', async () => {
      await queue.add(makeUnresolved('Unresolved Song'))
      expect(queue.tracks).toHaveLength(1)
    })

    it('returns new track count', async () => {
      const count = await queue.add(makeTrack('x'))
      expect(count).toBe(1)
    })
  })

  // splice
  describe('splice', () => {
    it('removes tracks at index', async () => {
      await queue.add([makeTrack('a'), makeTrack('b'), makeTrack('c')])
      await queue.splice(1, 1)
      expect(queue.tracks).toHaveLength(2)
      expect(queue.tracks[1].info.identifier).toBe('c')
    })

    it('inserts tracks at index', async () => {
      await queue.add([makeTrack('a'), makeTrack('c')])
      await queue.splice(1, 0, makeTrack('b'))
      expect(queue.tracks[1].info.identifier).toBe('b')
    })

    it('returns null for empty queue without tracks', async () => {
      const result = await queue.splice(0, 1)
      expect(result).toBeNull()
    })
  })

  // remove
  describe('remove', () => {
    it('removes by index', async () => {
      await queue.add([makeTrack('a'), makeTrack('b')])
      const result = await queue.remove(0)
      expect(result?.removed[0].info.identifier).toBe('a')
      expect(queue.tracks).toHaveLength(1)
    })

    it('removes by track object', async () => {
      const t = makeTrack('target')
      await queue.add([makeTrack('other'), t])
      const result = await queue.remove(t)
      expect(result?.removed[0].info.identifier).toBe('target')
    })

    it('removes by array of indexes', async () => {
      await queue.add([makeTrack('a'), makeTrack('b'), makeTrack('c')])
      const result = await queue.remove([0, 2])
      expect(result?.removed).toHaveLength(2)
      expect(queue.tracks).toHaveLength(1)
      expect(queue.tracks[0].info.identifier).toBe('b')
    })

    it('returns null for invalid index', async () => {
      await queue.add(makeTrack('a'))
      const result = await queue.remove(99)
      expect(result).toBeNull()
    })

    it('returns null for null input', async () => {
      const result = await queue.remove(null as any)
      expect(result).toBeNull()
    })

    it('returns null for empty array', async () => {
      const result = await queue.remove([])
      expect(result).toBeNull()
    })
  })

  // shuffle
  describe('shuffle', () => {
    it('returns 0 for empty queue', async () => {
      const result = await queue.shuffle()
      expect(result).toBe(0)
    })

    it('returns 1 for single track without shuffling', async () => {
      await queue.add(makeTrack('a'))
      const result = await queue.shuffle()
      expect(result).toBe(1)
    })

    it('shuffles multiple tracks and keeps same count', async () => {
      await queue.add([makeTrack('a'), makeTrack('b'), makeTrack('c'), makeTrack('d')])
      const before = queue.tracks.map((t) => t.info.identifier)
      await queue.shuffle()
      expect(queue.tracks).toHaveLength(4)
      // All original tracks still present
      for (const id of before) {
        expect(queue.tracks.some((t) => t.info.identifier === id)).toBe(true)
      }
    })

    it('swaps two tracks correctly', async () => {
      await queue.add([makeTrack('a'), makeTrack('b')])
      // Run shuffle multiple times to ensure swap happens
      let swapped = false
      for (let i = 0; i < 20; i++) {
        await queue.shuffle()
        if (queue.tracks[0].info.identifier === 'b') {
          swapped = true
          break
        }
      }
      expect(swapped).toBe(true)
    })
  })

  // toJSON
  describe('utils.toJSON', () => {
    it('returns correct structure', async () => {
      const t = makeTrack('t1')
      queue.current = t
      await queue.add(makeTrack('t2'))
      const json = queue.utils.toJSON()
      expect(json).toHaveProperty('current')
      expect(json).toHaveProperty('previous')
      expect(json).toHaveProperty('tracks')
      expect(json.tracks).toHaveLength(1)
    })

    it('trims previous to maxPreviousTracks', () => {
      for (let i = 0; i < 10; i++) queue.previous.push(makeTrack(`p${i}`))
      const json = queue.utils.toJSON()
      expect(json.previous.length).toBeLessThanOrEqual(queue.options.maxPreviousTracks)
    })
  })

  // totalDuration
  describe('utils.totalDuration', () => {
    it('returns 0 for empty queue', () => {
      expect(queue.utils.totalDuration()).toBe(0)
    })

    it('sums track durations including current', async () => {
      queue.current = makeTrack('c', 60000)
      await queue.add([makeTrack('a', 30000), makeTrack('b', 30000)])
      expect(queue.utils.totalDuration()).toBe(120000)
    })
  })

  // filterTracks / filter
  describe('filter / filterTracks', () => {
    beforeEach(async () => {
      await queue.add([makeTrack('a', 60000), makeTrack('b', 120000), makeTrack('c', 180000)])
    })

    it('filters by function predicate', () => {
      const results = queue.filter((t) => (t.info.duration ?? 0) > 100000)
      expect(results).toHaveLength(2)
    })

    it('filters by title object predicate', () => {
      const results = queue.filter({ title: 'Track a' })
      expect(results).toHaveLength(1)
      expect(results[0].track.info.identifier).toBe('a')
    })

    it('filters by duration range', () => {
      const results = queue.filter({ duration: { min: 100000, max: 200000 } })
      expect(results).toHaveLength(2)
    })

    it('returns empty array when nothing matches', () => {
      const results = queue.filter({ title: 'nonexistent' })
      expect(results).toHaveLength(0)
    })
  })

  // find
  describe('find', () => {
    it('returns first match', async () => {
      await queue.add([makeTrack('x'), makeTrack('y')])
      const result = queue.find({ title: 'Track x' })
      expect(result).not.toBeNull()
      expect(result!.track.info.identifier).toBe('x')
    })

    it('returns null when not found', async () => {
      await queue.add(makeTrack('x'))
      expect(queue.find({ title: 'nope' })).toBeNull()
    })
  })

  // sortBy
  describe('sortBy', () => {
    beforeEach(async () => {
      await queue.add([makeTrack('c', 300), makeTrack('a', 100), makeTrack('b', 200)])
    })

    it('sorts by duration ascending', async () => {
      await queue.sortBy('duration', 'asc')
      expect(queue.tracks[0].info.duration).toBe(100)
      expect(queue.tracks[2].info.duration).toBe(300)
    })

    it('sorts by duration descending', async () => {
      await queue.sortBy('duration', 'desc')
      expect(queue.tracks[0].info.duration).toBe(300)
    })

    it('sorts tracks by custom comparator', () => {
      const queue = makeQueue()
      const track1 = makeTrack('B')
      const track2 = makeTrack('A')
      queue.tracks.push(track1, track2)
      
      // toSortedBy returns a NEW array, it doesn't mutate queue.tracks
      const sorted = queue.toSortedBy((a, b) => a.info.title.localeCompare(b.info.title))
      expect(sorted[0].info.title).toBe('Track A')
      expect(sorted[1].info.title).toBe('Track B')
    })

    // ─── Remove ──────────────────────────────────────────────────────────────
    
    it('removes tracks by array of objects (identifier, uri, title, isrc, artworkUrl)', async () => {
      const queue = makeQueue()
      const track1 = makeTrack('id1')
      const track2 = makeTrack('id2')
      const track3 = makeTrack('id3')
      
      queue.tracks.push(track1, track2, track3)
      
      // Remove by various fields in an array
      const result = await queue.remove([
        { info: { identifier: 'id1' } },
        { info: { uri: track2.info.uri } },
        { info: { title: track3.info.title } }
      ] as any)
      
      expect(result?.removed.length).toBe(3)
      expect(queue.tracks.length).toBe(0)
    })

    it('handles tracksRemoved callback in remove', async () => {
      const queue = makeQueue()
      const track = makeTrack('id1')
      queue.tracks.push(track)
      
      let callbackCalled = false
      // @ts-ignore
      ;(queue as any).queueChanges = {
        tracksRemoved: () => { callbackCalled = true }
      }
      
      await queue.remove({ info: { identifier: 'id1' } } as any)
      expect(callbackCalled).toBe(true)
    })

    // ─── Splice ─────────────────────────────────────────────────────────────
    
    it('handles splice with specific index', async () => {
      const queue = makeQueue()
      const track1 = makeTrack('1')
      const track2 = makeTrack('2')
      queue.tracks.push(track1, track2)
      
      const track3 = makeTrack('3')
      await queue.splice(1, 0, track3)
      
      expect(queue.tracks[1].info.identifier).toBe('3')
    })

    // ─── Filter ─────────────────────────────────────────────────────────────

    it('filters tracks by object predicate (title, author, source)', () => {
      const queue = makeQueue()
      const track1 = makeTrack('1')
      const track2 = makeTrack('2')
      track2.info.sourceName = 'spotify'
      queue.tracks.push(track1, track2)
      
      const filtered = queue.utils.filterTracks({ title: track1.info.title })
      expect(filtered.length).toBe(1)
      expect(filtered[0].track.info.title).toBe(track1.info.title)
      
      const sourceFiltered = queue.utils.filterTracks({ sourceName: 'spotify' })
      expect(sourceFiltered.length).toBe(1)
    })
  })

  // toSortedBy
  describe('toSortedBy', () => {
    it('returns sorted copy without mutating original', async () => {
      await queue.add([makeTrack('c', 300), makeTrack('a', 100)])
      const sorted = queue.toSortedBy('duration', 'asc')
      expect(sorted[0].info.duration).toBe(100)
      // original order unchanged
      expect(queue.tracks[0].info.identifier).toBe('c')
    })

    it('sorts by author', async () => {
      await queue.add([makeTrack('z', 100), makeTrack('y', 100)])
      // Artist z vs Artist y (localeCompare)
      const sorted = queue.toSortedBy('author', 'asc')
      expect(sorted[0].info.author).toBe('Artist y')
    })

    it('sorts with a custom function', async () => {
      await queue.add([makeTrack('a', 100), makeTrack('b', 200)])
      const sorted = queue.toSortedBy((a, b) => (b.info.duration || 0) - (a.info.duration || 0))
      expect(sorted[0].info.duration).toBe(200)
    })

    it('returns original array for default case', async () => {
      await queue.add([makeTrack('a'), makeTrack('b')])
      // @ts-ignore
      const sorted = queue.toSortedBy('unknown')
      expect(sorted[0].info.identifier).toBe('a')
    })
  })

  // getTracks
  describe('getTracks', () => {
    it('returns slice of tracks', async () => {
      await queue.add([makeTrack('a'), makeTrack('b'), makeTrack('c')])
      const slice = queue.getTracks(1, 3)
      expect(slice).toHaveLength(2)
      expect(slice[0].info.identifier).toBe('b')
    })
  })

  // shiftPrevious
  describe('shiftPrevious', () => {
    it('returns null when previous is empty', async () => {
      expect(await queue.shiftPrevious()).toBeNull()
    })

    it('removes and returns first previous track', async () => {
      queue.previous.push(makeTrack('p1'), makeTrack('p2'))
      const removed = await queue.shiftPrevious()
      expect(removed?.info.identifier).toBe('p1')
      expect(queue.previous).toHaveLength(1)
    })
  })

  // sync / destroy
  describe('utils.sync / destroy', () => {
    it('syncs and destroys with QueueSaver', async () => {
      const store = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        stringify: (v: any) => v,
        parse: (v: any) => v
      }
      const saver = new QueueSaver({ queueStore: store as any })
      const queue = new Queue('guild-sync', {}, saver)
      
      const mockData = {
        current: { encoded: 'curr', info: { title: 'T' } },
        tracks: [{ encoded: 't1', info: { title: 'T1' } }],
        previous: [{ encoded: 'p1', info: { title: 'P1' } }]
      }
      store.get.mockResolvedValue(mockData)
      
      await queue.utils.sync(true, false)
      expect(queue.current?.encoded).toBe('curr')
      expect(queue.tracks.length).toBe(1)
      
      await queue.utils.destroy()
      expect(store.delete).toHaveBeenCalledWith('guild-sync')
    })
  })
})
