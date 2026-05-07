import { FilterManager } from '../src/audio/Filters'
import { RyanlinkManager, RyanlinkNode } from '../src'
import { Player } from '../src/audio/Player'

function makePlayer() {
  const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
  const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set('local', node)
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local' })
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  return { player, node, manager }
}

describe('FilterManager', () => {
  let player: Player
  let fm: FilterManager

  beforeEach(() => {
    const setup = makePlayer()
    player = setup.player
    fm = player.filterManager
  })

  it('instantiates with defaults', () => {
    expect(fm).toBeDefined()
    expect(fm.filters.nightcore).toBe(false)
    expect(fm.filters.vaporwave).toBe(false)
    expect(fm.equalizerBands).toEqual([])
  })

  it('player getter returns the player', () => {
    expect(fm.player).toBe(player)
  })

  it('get() returns filter value', () => {
    fm.data.volume = 0.5
    expect(fm.get('volume')).toBe(0.5)
  })

  it('get() returns plugin filter value', () => {
    fm.data.pluginFilters = { myPlugin: { foo: 'bar' } } as any
    expect(fm.get('myPlugin' as any)).toEqual({ foo: 'bar' })
  })

  it('set() sets a filter and applies', async () => {
    await fm.set('volume', 0.8)
    expect(fm.data.volume).toBe(0.8)
  })

  it('set() sets a plugin filter', async () => {
    await fm.set('myPlugin' as any, { x: 1 } as any, true)
    expect((fm.data.pluginFilters as any)['myPlugin']).toEqual({ x: 1 })
  })

  it('remove() removes a filter', async () => {
    fm.data.volume = 0.5
    await fm.remove('volume')
    expect(fm.data.volume).toBeUndefined()
  })

  it('remove() removes a plugin filter', async () => {
    fm.data.pluginFilters = { myPlugin: { x: 1 } } as any
    await fm.remove('myPlugin')
    expect((fm.data.pluginFilters as any)['myPlugin']).toBeUndefined()
  })

  it('override() replaces all filters', async () => {
    const newFilters = { volume: 0.3 } as any
    await fm.override(newFilters)
    expect(fm.data).toBe(newFilters)
  })

  it('setVolume() sets volume filter', async () => {
    await fm.setVolume(0.5)
    expect(fm.data.volume).toBe(0.5)
    expect(fm.filters.volume).toBe(true)
  })

  it('setVolume() with 1 disables volume filter', async () => {
    await fm.setVolume(1)
    expect(fm.filters.volume).toBe(false)
  })

  it('setSpeed() sets timescale speed', async () => {
    await fm.setSpeed(1.5)
    expect(fm.data.timescale.speed).toBe(1.5)
  })

  it('setPitch() sets timescale pitch', async () => {
    await fm.setPitch(1.3)
    expect(fm.data.timescale.pitch).toBe(1.3)
  })

  it('toggleNightcore() enables nightcore', async () => {
    await fm.toggleNightcore()
    expect(fm.filters.nightcore).toBe(true)
    expect(fm.data.timescale.speed).toBe(1.1)
    expect(fm.data.timescale.pitch).toBe(1.2)
    expect(fm.filters.vaporwave).toBe(false)
  })

  it('toggleNightcore() disables nightcore on second call', async () => {
    await fm.toggleNightcore()
    await fm.toggleNightcore()
    expect(fm.filters.nightcore).toBe(false)
    expect(fm.data.timescale.speed).toBe(1)
    expect(fm.data.timescale.pitch).toBe(1)
  })

  it('toggleVaporwave() enables vaporwave', async () => {
    await fm.toggleVaporwave()
    expect(fm.filters.vaporwave).toBe(true)
    expect(fm.data.timescale.speed).toBe(0.85)
    expect(fm.data.timescale.pitch).toBe(0.8)
    expect(fm.filters.nightcore).toBe(false)
  })

  it('toggleVaporwave() disables vaporwave on second call', async () => {
    await fm.toggleVaporwave()
    await fm.toggleVaporwave()
    expect(fm.filters.vaporwave).toBe(false)
    expect(fm.data.timescale.speed).toBe(1)
  })

  it('setEQ() sets equalizer bands', async () => {
    const bands = [{ band: 0, gain: 0.5 }]
    await fm.setEQ(bands)
    expect(fm.equalizerBands).toEqual(bands)
  })

  it('resetFilters() resets to defaults', async () => {
    await fm.setSpeed(2)
    await fm.resetFilters()
    expect(fm.data.timescale.speed).toBe(1)
    expect(fm.equalizerBands).toEqual([])
  })

  it('clear() resets filters', async () => {
    await fm.setSpeed(2)
    await fm.clear()
    expect(fm.data.timescale.speed).toBe(1)
  })

  it('setPreset() Clear resets filters', async () => {
    await fm.setSpeed(2)
    await fm.setPreset('Clear')
    expect(fm.data.timescale.speed).toBe(1)
  })

  it('setPreset() Nightcore enables nightcore', async () => {
    await fm.setPreset('Nightcore')
    expect(fm.filters.nightcore).toBe(true)
  })

  it('setPreset() Vaporwave enables vaporwave', async () => {
    await fm.setPreset('Vaporwave')
    expect(fm.filters.vaporwave).toBe(true)
  })

  it('setPreset() with EQ preset sets bands', async () => {
    await fm.setPreset('BassboostHigh')
    expect(fm.equalizerBands.length).toBeGreaterThan(0)
  })

  it('setPreset() with unknown preset does nothing', async () => {
    const result = await fm.setPreset('UnknownPreset' as any)
    expect(result).toBe(fm)
  })

  it('checkFiltersState() detects rotation', () => {
    fm.data.rotation = { rotationHz: 5 }
    fm.checkFiltersState()
    expect(fm.filters.rotation).toBe(true)
  })

  it('checkFiltersState() detects vibrato', () => {
    fm.data.vibrato = { frequency: 2, depth: 0 }
    fm.checkFiltersState()
    expect(fm.filters.vibrato).toBe(true)
  })

  it('checkFiltersState() detects tremolo', () => {
    fm.data.tremolo = { frequency: 0, depth: 3 }
    fm.checkFiltersState()
    expect(fm.filters.tremolo).toBe(true)
  })

  it('checkFiltersState() detects distortion', () => {
    fm.data.distortion = { sinOffset: 2, sinScale: 1, cosOffset: 0, cosScale: 1, tanOffset: 0, tanScale: 1, offset: 0, scale: 1 }
    fm.checkFiltersState()
    expect(fm.filters.distortion).toBe(true)
  })

  it('checkFiltersState() detects lowPass', () => {
    fm.data.lowPass = { smoothing: 20 }
    fm.checkFiltersState()
    expect(fm.filters.lowPass).toBe(true)
  })

  it('checkFiltersState() detects karaoke', () => {
    fm.data.karaoke = { level: 1, monoLevel: 0, filterBand: 0, filterWidth: 0 }
    fm.checkFiltersState()
    expect(fm.filters.karaoke).toBe(true)
  })

  it('applyPlayerFilters() skips timescale when all values are 1', async () => {
    fm.data.timescale = { speed: 1, pitch: 1, rate: 1 }
    await fm.applyPlayerFilters()
    // @ts-ignore
    const calls = (player.node.updatePlayer as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall.playerOptions.filters.timescale).toBeUndefined()
  })

  it('applyPlayerFilters() includes equalizer when bands set', async () => {
    fm.equalizerBands = [{ band: 0, gain: 0.5 }]
    await fm.applyPlayerFilters()
    // @ts-ignore
    const calls = (player.node.updatePlayer as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall.playerOptions.filters.equalizer).toEqual([{ band: 0, gain: 0.5 }])
  })

  it('EQList is accessible', () => {
    expect(FilterManager.EQList).toBeDefined()
    expect(typeof FilterManager.EQList).toBe('object')
  })
})
