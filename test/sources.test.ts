import { SourceRegistry, SourceMappings, BuiltinSources, LinkMatchers } from '../src/node/Sources'

describe('SourceRegistry', () => {
  let registry: SourceRegistry

  beforeEach(() => {
    registry = new SourceRegistry()
  })

  it('instantiates with empty maps', () => {
    expect(registry.mappings.size).toBe(0)
    expect(registry.matchers.size).toBe(0)
    expect(registry.plugins.size).toBe(0)
  })

  it('registerMapping() stores alias -> target', () => {
    registry.registerMapping('yt', 'ytsearch')
    expect(registry.getMapping('yt')).toBe('ytsearch')
  })

  it('registerMapping() is case-insensitive', () => {
    registry.registerMapping('YT', 'ytsearch')
    expect(registry.getMapping('yt')).toBe('ytsearch')
    expect(registry.getMapping('YT')).toBe('ytsearch')
  })

  it('getMapping() returns undefined for unknown alias', () => {
    expect(registry.getMapping('unknown')).toBeUndefined()
  })

  it('registerMatcher() stores name -> regex', () => {
    const regex = /youtube\.com/
    registry.registerMatcher('youtube', regex)
    expect(registry.getAllMatchers()['youtube']).toBe(regex)
  })

  it('registerPlugin() stores name -> identifier', () => {
    registry.registerPlugin('lavasrc', 'lavasrc-plugin')
    expect(registry.getAllPlugins()['lavasrc']).toBe('lavasrc-plugin')
  })

  it('getAllMappings() returns all mappings as object', () => {
    registry.registerMapping('sc', 'scsearch')
    registry.registerMapping('sp', 'spsearch')
    const all = registry.getAllMappings()
    expect(all['sc']).toBe('scsearch')
    expect(all['sp']).toBe('spsearch')
  })

  it('getAllMatchers() returns all matchers as object', () => {
    const r1 = /youtube/
    const r2 = /spotify/
    registry.registerMatcher('yt', r1)
    registry.registerMatcher('sp', r2)
    const all = registry.getAllMatchers()
    expect(all['yt']).toBe(r1)
    expect(all['sp']).toBe(r2)
  })

  it('getAllPlugins() returns all plugins as object', () => {
    registry.registerPlugin('search', 'lavasearch-plugin')
    const all = registry.getAllPlugins()
    expect(all['search']).toBe('lavasearch-plugin')
  })

  it('multiple mappings can be registered', () => {
    registry.registerMapping('a', 'alpha')
    registry.registerMapping('b', 'beta')
    registry.registerMapping('c', 'gamma')
    expect(Object.keys(registry.getAllMappings()).length).toBe(3)
  })
})

describe('Deprecated exports', () => {
  it('SourceMappings is an object', () => {
    expect(typeof SourceMappings).toBe('object')
  })

  it('BuiltinSources is an object', () => {
    expect(typeof BuiltinSources).toBe('object')
  })

  it('LinkMatchers is an object', () => {
    expect(typeof LinkMatchers).toBe('object')
  })
})
