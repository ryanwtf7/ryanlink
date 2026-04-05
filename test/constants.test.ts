import {
  DebugEvents,
  DestroyReasons,
  DisconnectReasons,
  validSponsorBlocks,
  audioOutputsData,
  EQList,
  RecommendationsStrings,
  NodeLinkExclusiveEvents,
} from '../src/config/Constants'

describe('Constants', () => {
  describe('DebugEvents enum', () => {
    it('has all expected keys as string values', () => {
      expect(DebugEvents.SetSponsorBlock).toBe('SetSponsorBlock')
      expect(DebugEvents.DeleteSponsorBlock).toBe('DeleteSponsorBlock')
      expect(DebugEvents.PlayerAutoReconnect).toBe('PlayerAutoReconnect')
      expect(DebugEvents.FailedToConnectToNodes).toBe('FailedToConnectToNodes')
      expect(DebugEvents.BuildTrackError).toBe('BuildTrackError')
    })

    it('has no duplicate values', () => {
      const values = Object.values(DebugEvents)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('DestroyReasons enum', () => {
    it('has all expected keys', () => {
      expect(DestroyReasons.QueueEmpty).toBe('QueueEmpty')
      expect(DestroyReasons.NodeDestroy).toBe('NodeDestroy')
      expect(DestroyReasons.Disconnected).toBe('Disconnected')
      expect(DestroyReasons.ChannelDeleted).toBe('ChannelDeleted')
    })

    it('has no duplicate values', () => {
      const values = Object.values(DestroyReasons)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('DisconnectReasons enum', () => {
    it('has expected keys', () => {
      expect(DisconnectReasons.Disconnected).toBe('Disconnected')
      expect(DisconnectReasons.DisconnectAllNodes).toBe('DisconnectAllNodes')
    })
  })

  describe('validSponsorBlocks', () => {
    it('is an array of strings', () => {
      expect(Array.isArray(validSponsorBlocks)).toBe(true)
      expect(validSponsorBlocks.every((v) => typeof v === 'string')).toBe(true)
    })

    it('contains expected values', () => {
      expect(validSponsorBlocks).toContain('sponsor')
      expect(validSponsorBlocks).toContain('selfpromo')
      expect(validSponsorBlocks).toContain('interaction')
      expect(validSponsorBlocks).toContain('intro')
      expect(validSponsorBlocks).toContain('outro')
      expect(validSponsorBlocks).toContain('preview')
      expect(validSponsorBlocks).toContain('music_offtopic')
      expect(validSponsorBlocks).toContain('filler')
      expect(validSponsorBlocks).toContain('poi_highlight')
    })

    it('has 9 entries', () => {
      expect(validSponsorBlocks).toHaveLength(9)
    })
  })

  describe('audioOutputsData', () => {
    it('has all four output types', () => {
      expect(audioOutputsData).toHaveProperty('mono')
      expect(audioOutputsData).toHaveProperty('stereo')
      expect(audioOutputsData).toHaveProperty('left')
      expect(audioOutputsData).toHaveProperty('right')
    })

    it('stereo has correct channel mix values', () => {
      expect(audioOutputsData.stereo.leftToLeft).toBe(1)
      expect(audioOutputsData.stereo.rightToRight).toBe(1)
      expect(audioOutputsData.stereo.leftToRight).toBe(0)
      expect(audioOutputsData.stereo.rightToLeft).toBe(0)
    })

    it('mono has equal channel mix values', () => {
      expect(audioOutputsData.mono.leftToLeft).toBe(0.5)
      expect(audioOutputsData.mono.leftToRight).toBe(0.5)
      expect(audioOutputsData.mono.rightToLeft).toBe(0.5)
      expect(audioOutputsData.mono.rightToRight).toBe(0.5)
    })

    it('left output routes left channel only', () => {
      expect(audioOutputsData.left.leftToLeft).toBe(1)
      expect(audioOutputsData.left.rightToLeft).toBe(1)
      expect(audioOutputsData.left.leftToRight).toBe(0)
      expect(audioOutputsData.left.rightToRight).toBe(0)
    })

    it('right output routes right channel only', () => {
      expect(audioOutputsData.right.leftToRight).toBe(1)
      expect(audioOutputsData.right.rightToRight).toBe(1)
      expect(audioOutputsData.right.leftToLeft).toBe(0)
      expect(audioOutputsData.right.rightToLeft).toBe(0)
    })
  })

  describe('EQList', () => {
    const presets = [
      'BassboostEarrape',
      'BassboostHigh',
      'BassboostMedium',
      'BassboostLow',
      'BetterMusic',
      'Rock',
      'Classic',
      'Pop',
      'Electronic',
      'FullSound',
      'Gaming',
    ]

    it.each(presets)('%s preset exists and has band/gain entries', (preset) => {
      const bands = EQList[preset as keyof typeof EQList]
      expect(Array.isArray(bands)).toBe(true)
      expect(bands.length).toBeGreaterThan(0)
      for (const band of bands) {
        expect(typeof band.band).toBe('number')
        expect(typeof band.gain).toBe('number')
      }
    })

    it('all presets have band numbers starting from 0', () => {
      for (const preset of presets) {
        const bands = EQList[preset as keyof typeof EQList]
        expect(bands[0].band).toBe(0)
      }
    })

    it('gain values are within valid lavalink range (-1.0 to 1.0)', () => {
      for (const preset of presets) {
        const bands = EQList[preset as keyof typeof EQList]
        for (const band of bands) {
          expect(band.gain).toBeGreaterThanOrEqual(-1.0)
          expect(band.gain).toBeLessThanOrEqual(1.0)
        }
      }
    })
  })

  describe('RecommendationsStrings', () => {
    it('highCPULoad returns formatted string', () => {
      const result = RecommendationsStrings.highCPULoad(0.75)
      expect(typeof result).toBe('string')
      expect(result).toContain('75.0%')
    })

    it('highSystemLoad returns formatted string', () => {
      const result = RecommendationsStrings.highSystemLoad(0.9)
      expect(typeof result).toBe('string')
      expect(result).toContain('90.0%')
    })

    it('highMemoryUsage returns formatted string', () => {
      const result = RecommendationsStrings.highMemoryUsage(85.5)
      expect(typeof result).toBe('string')
      expect(result).toContain('85.5%')
    })

    it('frameDeficit returns formatted string', () => {
      const result = RecommendationsStrings.frameDeficit(200)
      expect(typeof result).toBe('string')
      expect(result).toContain('200')
    })

    it('highLatency returns formatted string', () => {
      const result = RecommendationsStrings.highLatency(300)
      expect(typeof result).toBe('string')
      expect(result).toContain('300ms')
    })

    it('highPlayercount returns formatted string', () => {
      const result = RecommendationsStrings.highPlayercount(500)
      expect(typeof result).toBe('string')
      expect(result).toContain('500')
    })

    it('static strings are non-empty', () => {
      expect(RecommendationsStrings.nodeRestart.length).toBeGreaterThan(0)
      expect(RecommendationsStrings.nodeOffline.length).toBeGreaterThan(0)
      expect(RecommendationsStrings.checkConnectivity.length).toBeGreaterThan(0)
    })
  })

  describe('NodeLinkExclusiveEvents', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(NodeLinkExclusiveEvents)).toBe(true)
      expect(NodeLinkExclusiveEvents.length).toBeGreaterThan(0)
    })

    it('contains expected event types', () => {
      expect(NodeLinkExclusiveEvents).toContain('PlayerCreatedEvent')
      expect(NodeLinkExclusiveEvents).toContain('PlayerDestroyedEvent')
      expect(NodeLinkExclusiveEvents).toContain('LyricsFoundEvent')
    })
  })
})
