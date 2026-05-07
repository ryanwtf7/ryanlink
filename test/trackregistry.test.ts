import { TrackRegistry, TrackEntry } from '../src/utils/TrackRegistry'

describe('TrackRegistry', () => {
  beforeEach(() => {
    TrackRegistry.clear()
  })

  it('registers a track and returns its id', () => {
    const track = {
      encoded: 'abc123',
      info: { identifier: 'id1', title: 'Test', author: 'Author', duration: 1000, sourceName: 'youtube', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    const id = TrackRegistry.register(track)
    expect(id).toBe('id1')
  })

  it('get() returns registered track data', () => {
    const track = {
      encoded: 'abc123',
      info: { identifier: 'id1', title: 'Test', author: 'Author', duration: 1000, sourceName: 'youtube', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    TrackRegistry.register(track)
    const result = TrackRegistry.get('id1')
    expect(result).toBeDefined()
    expect(result.encoded).toBe('abc123')
    expect(result.info.title).toBe('Test')
  })

  it('get() returns undefined for unknown id', () => {
    expect(TrackRegistry.get('nonexistent')).toBeUndefined()
  })

  it('does not overwrite existing track on re-register', () => {
    const track1 = {
      encoded: 'enc1',
      info: { identifier: 'id1', title: 'Original', author: 'A', duration: 100, sourceName: 'yt', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    const track2 = {
      encoded: 'enc2',
      info: { identifier: 'id1', title: 'Updated', author: 'B', duration: 200, sourceName: 'yt', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    TrackRegistry.register(track1)
    TrackRegistry.register(track2)
    expect(TrackRegistry.get('id1').info.title).toBe('Original')
  })

  it('clear() removes all entries', () => {
    const track = {
      encoded: 'abc',
      info: { identifier: 'id1', title: 'T', author: 'A', duration: 100, sourceName: 'yt', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    TrackRegistry.register(track)
    TrackRegistry.clear()
    expect(TrackRegistry.get('id1')).toBeUndefined()
  })

  it('uses encoded as fallback id when no identifier', () => {
    const track = {
      encoded: 'myencoded',
      info: { title: 'T', author: 'A', duration: 100, sourceName: 'yt', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    const id = TrackRegistry.register(track)
    expect(id).toBe('myencoded')
  })

  it('uses random id when no identifier or encoded', () => {
    const track = {
      info: { title: 'T', author: 'A', duration: 100, sourceName: 'yt', isSeekable: true, isStream: false },
      pluginInfo: {},
    } as any
    const id = TrackRegistry.register(track)
    expect(id).toMatch(/^track-/)
  })
})

describe('TrackEntry', () => {
  beforeEach(() => {
    TrackRegistry.clear()
  })

  const makeTrack = (id = 'entry1') => ({
    encoded: 'enc_' + id,
    info: { identifier: id, title: 'Title', author: 'Author', duration: 3000, sourceName: 'youtube', isSeekable: true, isStream: false },
    pluginInfo: { artworkUrl: 'http://art.url' },
    requester: { id: 'user1' },
    userData: { custom: true },
  } as any)

  it('constructs and exposes encoded', () => {
    const entry = new TrackEntry(makeTrack())
    expect(entry.encoded).toBe('enc_entry1')
  })

  it('exposes info', () => {
    const entry = new TrackEntry(makeTrack())
    expect(entry.info.title).toBe('Title')
    expect(entry.info.author).toBe('Author')
  })

  it('exposes pluginInfo', () => {
    const entry = new TrackEntry(makeTrack())
    expect(entry.pluginInfo.artworkUrl).toBe('http://art.url')
  })

  it('exposes requester', () => {
    const entry = new TrackEntry(makeTrack())
    expect(entry.requester).toEqual({ id: 'user1' })
  })

  it('exposes userData', () => {
    const entry = new TrackEntry(makeTrack())
    expect(entry.userData).toEqual({ custom: true })
  })

  it('toJSON() returns full track object', () => {
    const entry = new TrackEntry(makeTrack())
    const json = entry.toJSON()
    expect(json.encoded).toBe('enc_entry1')
    expect(json.info.title).toBe('Title')
    expect(json.pluginInfo).toBeDefined()
    expect(json.requester).toEqual({ id: 'user1' })
    expect(json.userData).toEqual({ custom: true })
  })

  it('returns empty info when track not in registry', () => {
    const entry = new TrackEntry(makeTrack('gone'))
    TrackRegistry.clear()
    expect(entry.info).toEqual({})
    expect(entry.encoded).toBeUndefined()
    expect(entry.pluginInfo).toEqual({})
  })
})
