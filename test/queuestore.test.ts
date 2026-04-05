import { MemoryQueueStore, LocalDiskQueueStore, RedisQueueStore } from '../src/audio/QueueStore'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

describe('MemoryQueueStore', () => {
  let store: MemoryQueueStore
  beforeEach(() => { store = new MemoryQueueStore() })

  it('basic operations', async () => {
    await store.set('g1', 'data1')
    expect(await store.get('g1')).toBe('data1')
    expect(await store.keys()).toContain('g1')
    await store.delete('g1')
    expect(await store.get('g1')).toBeUndefined()
  })

  it('stringify/parse', async () => {
    const obj = { current: null, previous: [], tracks: [] }
    // @ts-ignore
    const str = await store.stringify(obj)
    expect(str).toBe(JSON.stringify(obj))
    expect(await store.stringify('raw')).toBe('raw')
    
    expect(await store.parse(str)).toEqual(obj)
    expect(await store.parse('raw')).toEqual({}) // Invalid JSON returns empty obj
    expect(await store.parse(undefined)).toEqual({})
  })
})

describe('LocalDiskQueueStore', () => {
  const tmpDir = join(__dirname, '.tmp-queues')
  let store: LocalDiskQueueStore

  beforeAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
  })

  beforeEach(() => { 
    store = new LocalDiskQueueStore(tmpDir) 
  })

  afterAll(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('basic operations', async () => {
    await store.set('g1', 'data1')
    expect(await store.get('g1')).toBe('data1')
    expect(await store.keys()).toContain('g1')
    await store.delete('g1')
    expect(await store.get('g1')).toBeUndefined()
  })

  it('keys returns empty for non-existent path', async () => {
    const freshStore = new LocalDiskQueueStore(join(tmpDir, 'none'))
    rmSync(join(tmpDir, 'none'), { recursive: true, force: true })
    expect(await freshStore.keys()).toEqual([])
  })

  it('stringify/parse', async () => {
    const obj = { current: null, previous: [], tracks: [] }
    // @ts-ignore
    expect(await store.stringify(obj)).toBe(JSON.stringify(obj))
    expect(await store.parse(JSON.stringify(obj))).toEqual(obj)
    expect(await store.parse(undefined)).toEqual({})
    expect(await store.parse('invalid')).toEqual({})
  })
})

describe('RedisQueueStore', () => {
  let mockRedis: any
  let store: RedisQueueStore

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    }
    store = new RedisQueueStore(mockRedis)
  })

  it('basic operations', async () => {
    mockRedis.get.mockResolvedValue('data1')
    expect(await store.get('g1')).toBe('data1')
    expect(mockRedis.get).toHaveBeenCalledWith('ryanlink:queue:g1')

    await store.set('g1', 'data1')
    expect(mockRedis.set).toHaveBeenCalledWith('ryanlink:queue:g1', 'data1')

    await store.delete('g1')
    expect(mockRedis.del).toHaveBeenCalledWith('ryanlink:queue:g1')
  })

  it('keys mapping', async () => {
    mockRedis.keys.mockResolvedValue(['ryanlink:queue:g1', 'ryanlink:queue:g2'])
    const keys = await store.keys()
    expect(keys).toEqual(['g1', 'g2'])
  })

  it('stringify/parse', async () => {
    const obj = { current: null, previous: [], tracks: [] }
    // @ts-ignore
    expect(await store.stringify(obj)).toBe(JSON.stringify(obj))
    expect(await store.parse(JSON.stringify(obj))).toEqual(obj)
    expect(await store.parse(undefined)).toEqual({})
  })
})
