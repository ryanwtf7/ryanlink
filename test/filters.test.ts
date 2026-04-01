import { FilterManager } from '../src/audio/Filters'
import { EQList, audioOutputsData } from '../src/config/Constants'

// ─── mock player ─────────────────────────────────────────────────────────────

function makePlayer(nodeOverrides: Record<string, any> = {}): any {
  const player: any = {
    guildId: 'guild1',
    position: 0,
    ping: { node: 0, ws: 0 },
    queue: { current: null },
    options: { instaUpdateFiltersFix: false },
    syncState: jest.fn(),
    node: {
      sessionId: 'session123',
      _checkForSources: false,
      _checkForPlugins: false,
      info: {
        filters: ['volume', 'equalizer', 'timescale', 'tremolo', 'vibrato', 'rotation', 'karaoke', 'lowPass', 'channelMix', 'echo', 'reverb'],
        plugins: [],
      },
      updatePlayer: jest.fn(() => Promise.resolve({})),
      isNodeLink: jest.fn(() => false),
      ...nodeOverrides,
    },
  }
  return player
}

// ─── FilterManager ───────────────────────────────────────────────────────────

describe('FilterManager', () => {
  let player: any
  let fm: FilterManager

  beforeEach(() => {
    player = makePlayer()
    fm = new FilterManager(player)
    player.filterManager = fm
  })

  describe('constructor', () => {
    it('initialises with stereo audio output', () => {
      expect(fm.filters.audioOutput).toBe('stereo')
    })

    it('initialises all boolean filters as false', () => {
      const boolFilters = ['volume', 'vaporwave', 'custom', 'nightcore', 'rotation', 'karaoke', 'tremolo', 'vibrato', 'lowPass']
      for (const f of boolFilters) {
        expect((fm.filters as any)[f]).toBe(false)
      }
    })

    it('initialises equalizerBands as empty array', () => {
      expect(fm.equalizerBands).toHaveLength(0)
    })

    it('initialises filterUpdatedState as false', () => {
      expect(fm.filterUpdatedState).toBe(false)
    })

    it('has EQList static property', () => {
      expect(FilterManager.EQList).toBe(EQList)
    })
  })

  describe('checkFiltersState', () => {
    it('returns true', () => {
      expect(fm.checkFiltersState()).toBe(true)
    })

    it('detects rotation when rotationHz is non-zero', () => {
      fm.data.rotation = { rotationHz: 0.5 }
      fm.checkFiltersState()
      expect(fm.filters.rotation).toBe(true)
    })

    it('detects no rotation when rotationHz is 0', () => {
      fm.data.rotation = { rotationHz: 0 }
      fm.checkFiltersState()
      expect(fm.filters.rotation).toBe(false)
    })

    it('detects tremolo when frequency is non-zero', () => {
      fm.data.tremolo = { frequency: 4, depth: 0 }
      fm.checkFiltersState()
      expect(fm.filters.tremolo).toBe(true)
    })

    it('detects vibrato when depth is non-zero', () => {
      fm.data.vibrato = { frequency: 0, depth: 0.5 }
      fm.checkFiltersState()
      expect(fm.filters.vibrato).toBe(true)
    })

    it('detects lowPass when smoothing is non-zero', () => {
      fm.data.lowPass = { smoothing: 20 }
      fm.checkFiltersState()
      expect(fm.filters.lowPass).toBe(true)
    })

    it('detects karaoke when any value is non-zero', () => {
      fm.data.karaoke = { level: 1, monoLevel: 0, filterBand: 0, filterWidth: 0 }
      fm.checkFiltersState()
      expect(fm.filters.karaoke).toBe(true)
    })

    it('detects nodeLinkEcho when delay is non-zero', () => {
      fm.data.echo = { delay: 0.5, feedback: 0, mix: 0 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkEcho).toBe(true)
    })

    it('detects nodeLinkChorus when rate is non-zero', () => {
      fm.data.chorus = { rate: 1, depth: 0, delay: 0, mix: 0, feedback: 0 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkChorus).toBe(true)
    })

    it('detects nodeLinkCompressor when any value is valid', () => {
      fm.data.compressor = { threshold: -20, ratio: 4, attack: 0.005, release: 0.1, gain: 0 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkCompressor).toBe(true)
    })

    it('detects nodeLinkHighPass when smoothing is non-zero', () => {
      fm.data.highPass = { smoothing: 100 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkHighPass).toBe(true)
    })

    it('detects nodeLinkPhaser when stages is non-zero', () => {
      fm.data.phaser = { stages: 4, rate: 0.5, depth: 0.5, feedback: 0.5, mix: 0.5, minFrequency: 100, maxFrequency: 1000 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkPhaser).toBe(true)
    })

    it('detects nodeLinkSpatial when any value is non-zero', () => {
      fm.data.spatial = { depth: 1, rate: 0.2 }
      fm.checkFiltersState()
      expect(fm.filters.nodeLinkSpatial).toBe(true)
    })
  })

  describe('isCustomFilterActive', () => {
    it('returns false when timescale is default', () => {
      fm.data.timescale = { speed: 1, pitch: 1, rate: 1 }
      expect(fm.isCustomFilterActive()).toBe(false)
    })

    it('returns true when speed is non-default', () => {
      fm.data.timescale = { speed: 1.5, pitch: 1, rate: 1 }
      expect(fm.isCustomFilterActive()).toBe(true)
    })

    it('returns false when nightcore is active', () => {
      fm.filters.nightcore = true
      fm.data.timescale = { speed: 1.3, pitch: 1.3, rate: 1 }
      expect(fm.isCustomFilterActive()).toBe(false)
    })
  })

  describe('setVolume', () => {
    it('throws for volume below 0', async () => {
      await expect(fm.setVolume(-1)).rejects.toThrow()
    })

    it('throws for volume above 5', async () => {
      await expect(fm.setVolume(6)).rejects.toThrow()
    })

    it('sets volume filter active when not 1', async () => {
      await fm.setVolume(0.5)
      expect(fm.filters.volume).toBe(true)
      expect(fm.data.volume).toBe(0.5)
    })

    it('sets volume filter inactive when 1', async () => {
      await fm.setVolume(1)
      expect(fm.filters.volume).toBe(false)
    })
  })

  describe('setAudioOutput', () => {
    it('throws for invalid audio type', async () => {
      await expect(fm.setAudioOutput('invalid' as any)).rejects.toThrow()
    })

    it('sets mono output', async () => {
      await fm.setAudioOutput('mono')
      expect(fm.filters.audioOutput).toBe('mono')
      expect(fm.data.channelMix).toEqual(audioOutputsData.mono)
    })

    it('sets left output', async () => {
      await fm.setAudioOutput('left')
      expect(fm.filters.audioOutput).toBe('left')
    })
  })

  describe('toggleRotation', () => {
    it('enables rotation', async () => {
      await fm.toggleRotation(0.2)
      expect(fm.filters.rotation).toBe(true)
      expect(fm.data.rotation?.rotationHz).toBe(0.2)
    })

    it('disables rotation on second call', async () => {
      await fm.toggleRotation(0.2)
      await fm.toggleRotation(0.2)
      expect(fm.filters.rotation).toBe(false)
    })
  })

  describe('toggleVibrato', () => {
    it('enables vibrato', async () => {
      await fm.toggleVibrato(10, 1)
      expect(fm.filters.vibrato).toBe(true)
    })

    it('disables vibrato on second call', async () => {
      await fm.toggleVibrato()
      await fm.toggleVibrato()
      expect(fm.filters.vibrato).toBe(false)
    })
  })

  describe('toggleTremolo', () => {
    it('enables tremolo', async () => {
      await fm.toggleTremolo(4, 0.8)
      expect(fm.filters.tremolo).toBe(true)
    })

    it('disables tremolo on second call', async () => {
      await fm.toggleTremolo()
      await fm.toggleTremolo()
      expect(fm.filters.tremolo).toBe(false)
    })
  })

  describe('toggleLowPass', () => {
    it('enables lowPass', async () => {
      await fm.toggleLowPass(20)
      expect(fm.filters.lowPass).toBe(true)
      expect(fm.data.lowPass?.smoothing).toBe(20)
    })

    it('disables lowPass on second call', async () => {
      await fm.toggleLowPass()
      await fm.toggleLowPass()
      expect(fm.filters.lowPass).toBe(false)
    })
  })

  describe('toggleNightcore', () => {
    it('enables nightcore', async () => {
      await fm.toggleNightcore()
      expect(fm.filters.nightcore).toBe(true)
      expect(fm.filters.vaporwave).toBe(false)
      expect(fm.filters.custom).toBe(false)
    })

    it('disables nightcore on second call', async () => {
      await fm.toggleNightcore()
      await fm.toggleNightcore()
      expect(fm.filters.nightcore).toBe(false)
    })

    it('disables vaporwave when nightcore is enabled', async () => {
      fm.filters.vaporwave = true
      await fm.toggleNightcore()
      expect(fm.filters.vaporwave).toBe(false)
    })
  })

  describe('toggleVaporwave', () => {
    it('enables vaporwave', async () => {
      await fm.toggleVaporwave()
      expect(fm.filters.vaporwave).toBe(true)
      expect(fm.filters.nightcore).toBe(false)
    })

    it('disables vaporwave on second call', async () => {
      await fm.toggleVaporwave()
      await fm.toggleVaporwave()
      expect(fm.filters.vaporwave).toBe(false)
    })
  })

  describe('toggleKaraoke', () => {
    it('enables karaoke', async () => {
      await fm.toggleKaraoke()
      expect(fm.filters.karaoke).toBe(true)
    })

    it('disables karaoke on second call', async () => {
      await fm.toggleKaraoke()
      await fm.toggleKaraoke()
      expect(fm.filters.karaoke).toBe(false)
    })
  })

  describe('toggleDistortion', () => {
    it('enables distortion', async () => {
      await fm.toggleDistortion(0.5, 0.5)
      expect(fm.filters.distortion).toBe(true)
      expect(fm.data.distortion?.sinOffset).toBe(0.5)
    })

    it('disables distortion on second call', async () => {
      await fm.toggleDistortion()
      await fm.toggleDistortion()
      expect(fm.filters.distortion).toBe(false)
    })
  })

  describe('setEQ', () => {
    it('sets equalizer bands', async () => {
      await fm.setEQ([
        { band: 0, gain: 0.5 },
        { band: 1, gain: 0.3 },
      ])
      expect(fm.equalizerBands[0]).toEqual({ band: 0, gain: 0.5 })
      expect(fm.equalizerBands[1]).toEqual({ band: 1, gain: 0.3 })
    })

    it('accepts single band object', async () => {
      await fm.setEQ({ band: 5, gain: 0.2 })
      expect(fm.equalizerBands[5]).toEqual({ band: 5, gain: 0.2 })
    })

    it('throws for invalid band format', async () => {
      await expect(fm.setEQ([] as any)).rejects.toThrow()
    })

    it('throws for band missing gain', async () => {
      await expect(fm.setEQ([{ band: 0 } as any])).rejects.toThrow()
    })

    it('handles transition between EQ bands', async () => {
      const applySpy = jest.spyOn(fm as any, 'applyPlayerFilters')
      await fm.setEQ([{ band: 0, gain: 1.0 }], 100)
      
      expect(applySpy).toHaveBeenCalled()
      expect(fm.equalizerBands[0].gain).toBe(1.0)
    })
  })

  describe('setEQPreset', () => {
    it('applies BassboostHigh preset', async () => {
      await fm.setEQPreset('BassboostHigh')
      expect(fm.equalizerBands.length).toBeGreaterThan(0)
    })

    it('applies Rock preset', async () => {
      await fm.setEQPreset('Rock')
      expect(fm.equalizerBands[0].gain).toBeCloseTo(0.3)
    })
  })

  describe('setPreset', () => {
    it('applies Vaporwave preset', async () => {
      await fm.setPreset('Vaporwave')
      expect(fm.filters.vaporwave).toBe(true)
      expect(fm.data.timescale?.speed).toBe(0.85)
    })

    it('applies Nightcore preset', async () => {
      await fm.setPreset('Nightcore')
      expect(fm.filters.nightcore).toBe(true)
    })

    it('applies 8D preset', async () => {
      await fm.setPreset('8D')
      expect(fm.data.rotation?.rotationHz).toBe(0.2)
    })

    it('clears all filters with Clear preset', async () => {
      fm.filters.nightcore = true
      await fm.setPreset('Clear')
      expect(fm.filters.nightcore).toBe(false)
    })
  })

  describe('clearEQ', () => {
    it('sets all 15 bands to 0 gain', async () => {
      await fm.setEQ([{ band: 0, gain: 0.5 }])
      await fm.clearEQ()
      expect(fm.equalizerBands).toHaveLength(15)
      for (const band of fm.equalizerBands) {
        expect(band.gain).toBe(0)
      }
    })
  })

  describe('resetFilters', () => {
    it('resets all filters to default', async () => {
      fm.filters.nightcore = true
      fm.filters.rotation = true
      fm.filters.audioOutput = 'mono'
      await fm.resetFilters()
      expect(fm.filters.nightcore).toBe(false)
      expect(fm.filters.rotation).toBe(false)
      expect(fm.filters.audioOutput).toBe('stereo')
    })

    it('returns FilterManager instance', async () => {
      const result = await fm.resetFilters()
      expect(result).toBe(fm)
    })
  })

  describe('setSpeed / setPitch / setRate', () => {
    it('setSpeed updates timescale speed', async () => {
      await fm.setSpeed(1.5)
      expect(fm.data.timescale?.speed).toBe(1.5)
      expect(fm.filters.nightcore).toBe(false)
    })

    it('setPitch updates timescale pitch', async () => {
      await fm.setPitch(1.2)
      expect(fm.data.timescale?.pitch).toBe(1.2)
    })

    it('setRate updates timescale rate', async () => {
      await fm.setRate(0.9)
      expect(fm.data.timescale?.rate).toBe(0.9)
    })

    it('setSpeed disables nightcore', async () => {
      fm.filters.nightcore = true
      await fm.setSpeed(1.5)
      expect(fm.filters.nightcore).toBe(false)
    })
  })

  describe('dspxPlugin', () => {
    beforeEach(() => {
      player.node.info.plugins = [{ name: 'lavadspx-plugin' }]
      player.node.info.filters = ['low-pass', 'high-pass', 'normalization', 'echo']
    })

    it('toggles lowPass', async () => {
      await fm.dspxPlugin.toggleLowPass(1.5, 100)
      expect(fm.filters.dspxPlugin.lowPass).toBe(true)
      expect((fm.data.pluginFilters as any)['low-pass'].boostFactor).toBe(1.5)
      await fm.dspxPlugin.toggleLowPass()
      expect(fm.filters.dspxPlugin.lowPass).toBe(false)
    })

    it('toggles highPass', async () => {
      await fm.dspxPlugin.toggleHighPass(2.0, 150)
      expect(fm.filters.dspxPlugin.highPass).toBe(true)
      await fm.dspxPlugin.toggleHighPass()
      expect(fm.filters.dspxPlugin.highPass).toBe(false)
    })

    it('toggles normalization', async () => {
      await fm.dspxPlugin.toggleNormalization(0.8, false)
      expect(fm.filters.dspxPlugin.normalization).toBe(true)
      await fm.dspxPlugin.toggleNormalization()
      expect(fm.filters.dspxPlugin.normalization).toBe(false)
    })

    it('toggles echo', async () => {
      await fm.dspxPlugin.toggleEcho(0.6, 0.7)
      expect(fm.filters.dspxPlugin.echo).toBe(true)
      await fm.dspxPlugin.toggleEcho()
      expect(fm.filters.dspxPlugin.echo).toBe(false)
    })
  })

  describe('coreFilterPlugin', () => {
    beforeEach(() => {
      player.node.info.plugins = [{ name: 'filter-engine' }]
      player.node.info.filters = ['echo', 'reverb']
    })

    it('toggles echo', async () => {
      await fm.coreFilterPlugin.toggleEcho(5, 0.9)
      expect(fm.filters.coreFilterPlugin.echo).toBe(true)
      await fm.coreFilterPlugin.toggleEcho()
      expect(fm.filters.coreFilterPlugin.echo).toBe(false)
    })

    it('toggles reverb', async () => {
      await fm.coreFilterPlugin.toggleReverb([0.1], [0.5])
      expect(fm.filters.coreFilterPlugin.reverb).toBe(true)
      await fm.coreFilterPlugin.toggleReverb()
      expect(fm.filters.coreFilterPlugin.reverb).toBe(false)
    })
  })
})
