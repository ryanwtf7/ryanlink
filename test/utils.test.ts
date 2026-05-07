import { RyanlinkUtils, AudioTrackSymbol, UnresolvedAudioTrackSymbol } from '../src/utils/Utils'
import { RyanlinkManager } from '../src'

describe('Utils', () => {
  let utils: RyanlinkUtils
  let manager: RyanlinkManager

  beforeEach(() => {
    manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    utils = new RyanlinkUtils(manager)
  })

  it('shuffles array', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = utils.shuffle([...arr])
    expect(shuffled.length).toBe(5)
    expect(shuffled.sort()).toEqual(arr.sort())
  })

  it('builds track', () => {
    const raw = { encoded: 'abc', info: { title: 'T', author: 'A', length: 100 } } as any
    const track = utils.buildTrack(raw, { id: 'u' })
    expect(track.encoded).toBe('abc')
    expect(track.info.title).toBe('T')
    // @ts-ignore
    expect(track[AudioTrackSymbol]).toBe(true)
  })

  it('throws on invalid track build', () => {
    expect(() => utils.buildTrack({} as any, null)).toThrow()
  })

  it('builds unresolved track', () => {
    const raw = { title: 'T' } as any
    const track = utils.buildUnresolvedTrack(raw, { id: 'u' })
    expect(track.info.title).toBe('T')
    // @ts-ignore
    expect(track[UnresolvedAudioTrackSymbol]).toBe(true)
  })

  it('type checks', () => {
    const t = { [AudioTrackSymbol]: true } as any
    const ut = { [UnresolvedAudioTrackSymbol]: true } as any
    expect(utils.isTrack(t)).toBe(true)
    expect(utils.isUnresolvedTrack(ut)).toBe(true)
  })

  it('safeStringify handles circular and symbols', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    const str = utils.safeStringify(obj)
    expect(str).toContain('[Circular]')
    // @ts-ignore
    expect(utils.safeStringify({ s: Symbol('test') })).toBe('{}')
  })
})