import { Queue } from '../src/audio/Queue'
import { AudioQueueSymbol } from '../src/utils/Utils'

describe('Queue', () => {
  let queue: Queue

  beforeEach(() => {
    queue = new Queue('guild1', { maxPreviousTracks: 5 })
  })

  it('instantiates correctly', () => {
    expect(queue).toBeDefined()
    expect(queue.tracks).toEqual([])
    expect(queue.previous).toEqual([])
    expect(queue.current).toBeNull()
    expect(queue.options.maxPreviousTracks).toBe(5)
    // @ts-ignore
    expect(queue[AudioQueueSymbol]).toBe(true)
  })

  it('returns correct size, first and last', () => {
    expect(queue.size).toBe(0)
    expect(queue.first).toBeNull()
    expect(queue.last).toBeNull()

    const t1 = { encoded: 't1', info: { title: 'T1', duration: 100 } } as any
    const t2 = { encoded: 't2', info: { title: 'T2', duration: 200 } } as any
    queue.add([t1, t2])

    expect(queue.size).toBe(2)
    expect(queue.first).toBe(t1)
    expect(queue.last).toBe(t2)
  })

  it('calculates totalDuration', () => {
    expect(queue.totalDuration).toBe(0)
    queue.current = { encoded: 'curr', info: { duration: 1000 } } as any
    queue.add([{ encoded: 't1', info: { duration: 100 } } as any])
    expect(queue.totalDuration).toBe(1100)
  })

  it('adds tracks correctly (single, array, index)', () => {
    const t1 = { encoded: 't1', info: { title: 'T1' } } as any
    const t2 = { encoded: 't2', info: { title: 'T2' } } as any
    
    expect(queue.add(t1)).toBe(1)
    expect(queue.add([t2])).toBe(2)
    
    const t3 = { encoded: 't3', info: { title: 'T3' } } as any
    queue.add(t3, 1)
    expect(queue.tracks[1]).toBe(t3)
    
    // Invalid tracks
    expect(queue.add({} as any)).toBe(3) // Wait, isTrack check might fail
  })

  it('removes tracks correctly', () => {
    queue.add([{ encoded: 't1', info: {} } as any, { encoded: 't2', info: {} } as any])
    const removed = queue.remove(0, 1)
    expect(removed.length).toBe(1)
    expect(removed[0].encoded).toBe('t1')
    expect(queue.tracks.length).toBe(1)
  })

  it('clears correctly', () => {
    queue.add({ encoded: 't1', info: {} } as any)
    queue.previous.push({ encoded: 'p1', info: {} } as any)
    
    queue.clear(true)
    expect(queue.tracks.length).toBe(0)
    expect(queue.previous.length).toBe(0)
  })

  it('shuffles correctly', () => {
    queue.add([{ encoded: 't1', info: {} } as any, { encoded: 't2', info: {} } as any, { encoded: 't3', info: {} } as any])
    const size = queue.shuffle()
    expect(size).toBe(3)
    // Single track shuffle
    queue.clear()
    queue.add({ encoded: 't1', info: {} } as any)
    expect(queue.shuffle()).toBe(1)
  })

  it('moves tracks correctly', () => {
    queue.add([{ encoded: 't1', info: {} } as any, { encoded: 't2', info: {} } as any])
    expect(queue.move(0, 1)).toBe(true)
    expect(queue.tracks[1].encoded).toBe('t1')
    expect(queue.move(0, 99)).toBe(false)
  })

  it('skips to correctly', () => {
    const t1 = { encoded: 't1', info: { duration: 100 } } as any
    const t2 = { encoded: 't2', info: { duration: 200 } } as any
    queue.add([t1, t2])
    queue.current = { encoded: 'curr', info: {} } as any
    
    const next = queue.skipTo(1)
    expect(next).toBe(t2)
    expect(queue.current).toBe(t2)
    expect(queue.previous[0].encoded).toBe('curr')
    
    expect(queue.skipTo(99)).toBeNull()
  })

  it('handles previous tracks limit', () => {
    queue = new Queue('g', { maxPreviousTracks: 2 })
    queue.addPrevious({ encoded: 'p1', info: {} } as any)
    queue.addPrevious({ encoded: 'p2', info: {} } as any)
    queue.addPrevious({ encoded: 'p3', info: {} } as any)
    expect(queue.previous.length).toBe(2)
    expect(queue.previous[0].encoded).toBe('p3')
  })

  it('toJSON returns correct structure', () => {
    const json = queue.toJSON()
    expect(json).toHaveProperty('tracks')
    expect(json).toHaveProperty('current')
    expect(json).toHaveProperty('previous')
    expect(json).toHaveProperty('volume')
  })

  it('find, filter, map, some, every works', () => {
    queue.add([{ encoded: 't1', info: { title: 'A' } } as any, { encoded: 't2', info: { title: 'B' } } as any])
    expect(queue.find(t => t.info.title === 'A')).toBeDefined()
    expect(queue.filter(t => t.info.title === 'A').length).toBe(1)
    expect(queue.map(t => t.info.title)).toEqual(['A', 'B'])
    expect(queue.some(t => t.info.title === 'A')).toBe(true)
    expect(queue.every(t => t.info.title === 'A')).toBe(false)
  })
})