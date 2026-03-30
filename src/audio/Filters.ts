import { audioOutputsData, EQList } from '../config/Constants'
import type { Player } from './Player'
import type { AudioOutputs, EQBand, FilterData, AudioFilters, PlayerFilters, TimescaleFilter } from '../types/Filters'
import { safeStringify } from '../utils/Utils'

const DEFAULT_FILTER_DATAS: FilterData = {
  volume: 1,
  lowPass: {
    smoothing: 0,
  },
  karaoke: {
    level: 0,
    monoLevel: 0,
    filterBand: 0,
    filterWidth: 0,
  },
  timescale: {
    speed: 1,
    pitch: 1,
    rate: 1,
  },
  rotation: {
    rotationHz: 0,
  },
  tremolo: {
    frequency: 0,
    depth: 0,
  },
  vibrato: {
    frequency: 0,
    depth: 0,
  },
  channelMix: audioOutputsData.stereo,

  echo: {
    delay: 0,
    feedback: 0,
    mix: 0,
  },
  chorus: {
    rate: 0,
    depth: 0,
    delay: 0,
    mix: 0,
    feedback: 0,
  },
  compressor: {
    threshold: 0,
    ratio: 1,
    attack: 0,
    release: 0,
    gain: 0,
  },
  highPass: {
    smoothing: 0,
  },
  phaser: {
    stages: 0,
    rate: 0,
    depth: 0,
    feedback: 0,
    mix: 0,
    minFrequency: 0,
    maxFrequency: 0,
  },
  spatial: {
    depth: 0,
    rate: 0,
  },

  pluginFilters: {
    'filter-engine': {
      echo: {
        delay: 0,
        decay: 0,
      },
      reverb: {
        delays: [],
        gains: [],
      },
    },
    'high-pass': {},
    'low-pass': {},
    normalization: {},
    echo: {},
  },
}
export class FilterManager {
  public static EQList = EQList

  public equalizerBands: EQBand[] = []

  public filterUpdatedState: boolean = false

  public filters: PlayerFilters = {
    volume: false,
    vaporwave: false,
    custom: false,
    nightcore: false,
    rotation: false,
    karaoke: false,
    tremolo: false,
    vibrato: false,
    lowPass: false,
    nodeLinkEcho: false,
    nodeLinkChorus: false,
    nodeLinkCompressor: false,
    nodeLinkHighPass: false,
    nodeLinkPhaser: false,
    nodeLinkSpatial: false,
    coreFilterPlugin: {
      echo: false,
      reverb: false,
    },
    dspxPlugin: {
      lowPass: false,
      highPass: false,
      normalization: false,
      echo: false,
    },
    audioOutput: 'stereo',
  }

  public data: FilterData = structuredClone(DEFAULT_FILTER_DATAS)

  public player: Player

  constructor(player: Player) {
    this.player = player
  }

  async applyPlayerFilters(): Promise<void> {
    const sendData = { ...this.data } as AudioFilters & { equalizer: EQBand[] }
    this.checkFiltersState()

    if (!this.filters.volume) delete sendData.volume
    if (!this.filters.tremolo) delete sendData.tremolo
    if (!this.filters.vibrato) delete sendData.vibrato

    if (!this.filters.coreFilterPlugin.echo) delete sendData.pluginFilters?.['filter-engine']?.echo
    if (!this.filters.coreFilterPlugin.reverb) delete sendData.pluginFilters?.['filter-engine']?.reverb

    if (!this.filters.dspxPlugin.echo) delete sendData.pluginFilters?.echo
    if (!this.filters.dspxPlugin.normalization) delete sendData.pluginFilters?.normalization
    if (!this.filters.dspxPlugin.highPass) delete sendData.pluginFilters?.['high-pass']
    if (!this.filters.dspxPlugin.lowPass) delete sendData.pluginFilters?.['low-pass']

    if (sendData.pluginFilters?.['filter-engine'] && Object.values(sendData.pluginFilters?.['filter-engine']).length === 0)
      delete sendData.pluginFilters['filter-engine']
    if (sendData.pluginFilters && Object.values(sendData.pluginFilters).length === 0) delete sendData.pluginFilters
    if (!this.filters.lowPass) delete sendData.lowPass
    if (!this.filters.karaoke) delete sendData.karaoke
    if (!this.filters.rotation) delete sendData.rotation
    if (this.filters.audioOutput === 'stereo') delete sendData.channelMix

    if (!this.filters.nodeLinkEcho) delete sendData.echo
    if (!this.filters.nodeLinkChorus) delete sendData.chorus
    if (!this.filters.nodeLinkCompressor) delete sendData.compressor
    if (!this.filters.nodeLinkHighPass) delete sendData.highPass
    if (!this.filters.nodeLinkPhaser) delete sendData.phaser
    if (!this.filters.nodeLinkSpatial) delete sendData.spatial

    if (Object.values(this.data.timescale ?? {}).every((v) => v === 1)) delete sendData.timescale

    if (!this.player.node.sessionId) throw new Error('The Lavalink-Node is either not ready or not up to date')

    sendData.equalizer = [...this.equalizerBands]
    if (sendData.equalizer.length === 0) delete sendData.equalizer

    for (const key of Object.keys(sendData)) {
      if (key === 'pluginFilters') {
      } else if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.(key)) delete sendData[key]
    }

    const now = performance.now()

    if (this.player.options.instaFixFilter === true) this.filterUpdatedState = true

    this.player.syncState()

    await this.player.node.updatePlayer({
      guildId: this.player.guildId,
      playerOptions: {
        filters: sendData,
      },
    })

    this.player.ping.node = Math.round((performance.now() - now) / 10) / 100
    return
  }

  private privateNot0(value: number | undefined, numToCheckAgains: number = 0): boolean {
    return typeof value === 'number' && value !== numToCheckAgains
  }

  private getAudioFilters(): AudioFilters['pluginFilters']['filter-engine'] {
    return (
      this.data.pluginFilters?.['filter-engine'] || {
        echo: {
          decay: this.data.pluginFilters?.echo?.decay && !this.data.pluginFilters?.echo?.echoLength ? this.data.pluginFilters?.echo?.decay : 0,
          delay: (this.data.pluginFilters?.echo as { decay: number; delay: number })?.delay || 0,
        },
        reverb: {
          gains: [],
          delays: [],
          ...(this.data.pluginFilters as { reverb: { gains: number[]; delays: number[] } })?.reverb,
        },
      }
    )
  }

  checkFiltersState(oldFilterTimescale?: Partial<TimescaleFilter>): boolean {
    this.data = this.data ?? {}

    this.filters.rotation = this.privateNot0(this.data.rotation?.rotationHz)
    this.filters.vibrato = this.privateNot0(this.data.vibrato?.frequency) || this.privateNot0(this.data.vibrato?.depth)
    this.filters.tremolo = this.privateNot0(this.data.tremolo?.frequency) || this.privateNot0(this.data.tremolo?.depth)

    const audioFilterData = this.getAudioFilters()
    this.filters.coreFilterPlugin = {
      echo: this.privateNot0(audioFilterData?.echo?.decay) || this.privateNot0(audioFilterData?.echo?.delay),
      reverb: this.privateNot0(audioFilterData?.reverb?.delays?.length) || this.privateNot0(audioFilterData?.reverb?.gains?.length),
    }
    this.filters.dspxPlugin = {
      lowPass: Object.values(this.data.pluginFilters?.['low-pass'] || {})?.length > 0,
      highPass: Object.values(this.data.pluginFilters?.['high-pass'] || {})?.length > 0,
      normalization: Object.values(this.data.pluginFilters?.normalization || {})?.length > 0,
      echo:
        Object.values(this.data.pluginFilters?.echo || {})?.length > 0 &&
        typeof (this.data.pluginFilters?.echo as { decay: number; delay: number })?.delay === 'undefined',
    }
    this.filters.lowPass = this.privateNot0(this.data.lowPass?.smoothing)
    this.filters.nodeLinkEcho =
      this.privateNot0(this.data.echo?.delay) || this.privateNot0(this.data.echo?.feedback) || this.privateNot0(this.data.echo?.mix)
    this.filters.nodeLinkChorus =
      this.privateNot0(this.data.chorus?.rate) ||
      this.privateNot0(this.data.chorus?.depth) ||
      this.privateNot0(this.data.chorus?.delay) ||
      this.privateNot0(this.data.chorus?.mix) ||
      this.privateNot0(this.data.chorus?.feedback)
    this.filters.nodeLinkCompressor =
      this.privateNot0(this.data.compressor?.threshold) ||
      this.privateNot0(this.data.compressor?.ratio, 1) ||
      this.privateNot0(this.data.compressor?.attack) ||
      this.privateNot0(this.data.compressor?.release) ||
      this.privateNot0(this.data.compressor?.gain)
    this.filters.nodeLinkHighPass = this.privateNot0(this.data.highPass?.smoothing)
    this.filters.nodeLinkPhaser =
      this.privateNot0(this.data.phaser?.stages) ||
      this.privateNot0(this.data.phaser?.rate) ||
      this.privateNot0(this.data.phaser?.depth) ||
      this.privateNot0(this.data.phaser?.feedback) ||
      this.privateNot0(this.data.phaser?.mix) ||
      this.privateNot0(this.data.phaser?.minFrequency) ||
      this.privateNot0(this.data.phaser?.maxFrequency)
    this.filters.nodeLinkSpatial = this.privateNot0(this.data.spatial?.depth) || this.privateNot0(this.data.spatial?.rate)
    this.filters.karaoke = Object.values(this.data.karaoke ?? {}).some((v) => v !== 0)
    if ((this.filters.nightcore || this.filters.vaporwave) && oldFilterTimescale) {
      if (
        oldFilterTimescale.pitch !== this.data.timescale?.pitch ||
        oldFilterTimescale.rate !== this.data.timescale?.rate ||
        oldFilterTimescale.speed !== this.data.timescale?.speed
      ) {
        this.filters.custom = Object.values(this.data.timescale || {}).some((v) => v !== 1)
        this.filters.nightcore = false
        this.filters.vaporwave = false
      }
    }
    return true
  }

  public async resetFilters(): Promise<FilterManager> {
    this.filters.dspxPlugin.echo = false
    this.filters.dspxPlugin.normalization = false
    this.filters.dspxPlugin.highPass = false
    this.filters.dspxPlugin.lowPass = false
    this.filters.coreFilterPlugin.echo = false
    this.filters.coreFilterPlugin.reverb = false
    this.filters.nightcore = false
    this.filters.lowPass = false
    this.filters.rotation = false
    this.filters.tremolo = false
    this.filters.vibrato = false
    this.filters.karaoke = false
    this.filters.vaporwave = false
    this.filters.volume = false
    this.filters.nodeLinkEcho = false
    this.filters.nodeLinkChorus = false
    this.filters.nodeLinkCompressor = false
    this.filters.nodeLinkHighPass = false
    this.filters.nodeLinkPhaser = false
    this.filters.nodeLinkSpatial = false
    this.filters.audioOutput = 'stereo'

    this.data = structuredClone(DEFAULT_FILTER_DATAS)

    await this.applyPlayerFilters()
    return this
  }

  public async clear(): Promise<FilterManager> {
    this.filters.dspxPlugin.echo = false
    this.filters.dspxPlugin.normalization = false
    this.filters.dspxPlugin.highPass = false
    this.filters.dspxPlugin.lowPass = false
    this.filters.coreFilterPlugin.echo = false
    this.filters.coreFilterPlugin.reverb = false
    this.filters.nightcore = false
    this.filters.lowPass = false
    this.filters.rotation = false
    this.filters.tremolo = false
    this.filters.vibrato = false
    this.filters.karaoke = false
    this.filters.vaporwave = false
    this.filters.volume = false
    this.filters.nodeLinkEcho = false
    this.filters.nodeLinkChorus = false
    this.filters.nodeLinkCompressor = false
    this.filters.nodeLinkHighPass = false
    this.filters.nodeLinkPhaser = false
    this.filters.nodeLinkSpatial = false
    this.filters.audioOutput = 'stereo'

    this.data = structuredClone(DEFAULT_FILTER_DATAS)
    this.equalizerBands = []

    await this.applyPlayerFilters()
    return this
  }

  public async setVolume(volume: number) {
    if (volume < 0 || volume > 5) throw new SyntaxError('Volume-Filter must be between 0 and 5')

    this.data = this.data ?? {}

    this.data.volume = volume
    this.filters.volume = volume !== 1

    await this.applyPlayerFilters()

    return this
  }

  public async setAudioOutput(type: AudioOutputs): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('channelMix'))
      throw new Error("Node#Info#filters does not include the 'channelMix' Filter (Node has it not enable)")
    if (!type || !audioOutputsData[type]) throw new Error("Invalid audio type added, must be 'mono' / 'stereo' / 'left' / 'right'")

    this.data = this.data ?? {}

    this.data.channelMix = audioOutputsData[type]
    this.filters.audioOutput = type

    await this.applyPlayerFilters()
    return this
  }

  public async setSpeed(speed = 1): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('timescale'))
      throw new Error("Node#Info#filters does not include the 'timescale' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.filters.nightcore = false
    this.filters.vaporwave = false
    this.data.timescale = { ...DEFAULT_FILTER_DATAS.timescale, ...this.data.timescale, speed }

    this.isCustomFilterActive()

    await this.applyPlayerFilters()
    return this
  }

  public async setPitch(pitch = 1): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('timescale'))
      throw new Error("Node#Info#filters does not include the 'timescale' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.filters.nightcore = false
    this.filters.vaporwave = false
    this.data.timescale = { ...DEFAULT_FILTER_DATAS.timescale, ...this.data.timescale, pitch }

    this.isCustomFilterActive()

    await this.applyPlayerFilters()
    return this
  }

  public async setRate(rate = 1): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('timescale'))
      throw new Error("Node#Info#filters does not include the 'timescale' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.filters.nightcore = false
    this.filters.vaporwave = false
    this.data.timescale = { ...DEFAULT_FILTER_DATAS.timescale, ...this.data.timescale, rate }

    this.isCustomFilterActive()

    await this.applyPlayerFilters()
    return this
  }

  public async toggleRotation(rotationHz = 0.2): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('rotation'))
      throw new Error("Node#Info#filters does not include the 'rotation' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.rotation = this.filters.rotation ? DEFAULT_FILTER_DATAS.rotation : { rotationHz }

    this.filters.rotation = !this.filters.rotation

    await this.applyPlayerFilters()

    return this
  }

  public async toggleVibrato(frequency = 10, depth = 1): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('vibrato'))
      throw new Error("Node#Info#filters does not include the 'vibrato' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.vibrato = this.filters.vibrato ? DEFAULT_FILTER_DATAS.vibrato : { depth, frequency }

    this.filters.vibrato = !this.filters.vibrato
    await this.applyPlayerFilters()
    return this
  }

  public async toggleTremolo(frequency = 4, depth = 0.8): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('tremolo'))
      throw new Error("Node#Info#filters does not include the 'tremolo' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.tremolo = this.filters.tremolo ? DEFAULT_FILTER_DATAS.tremolo : { depth, frequency }

    this.filters.tremolo = !this.filters.tremolo
    await this.applyPlayerFilters()
    return this
  }

  public async toggleLowPass(smoothing = 20): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('lowPass'))
      throw new Error("Node#Info#filters does not include the 'lowPass' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.lowPass = this.filters.lowPass ? DEFAULT_FILTER_DATAS.lowPass : { smoothing }

    this.filters.lowPass = !this.filters.lowPass
    await this.applyPlayerFilters()
    return this
  }

  dspxPlugin = {
    toggleLowPass: async (boostFactor = 1.0, cutoffFrequency = 80): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'lavadspx-plugin'))
        throw new Error('Node#Info#plugins does not include the lavadspx plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('low-pass'))
        throw new Error("Node#Info#filters does not include the 'low-pass' Filter (Node has it not enable)")

      this.data = this.data ?? {}
      this.data.pluginFilters = this.data.pluginFilters ?? {}

      if (this.filters.dspxPlugin.lowPass) delete this.data.pluginFilters['low-pass']
      else this.data.pluginFilters['low-pass'] = { boostFactor, cutoffFrequency }

      this.filters.dspxPlugin.lowPass = !this.filters.dspxPlugin.lowPass
      await this.applyPlayerFilters()
      return this
    },

    toggleHighPass: async (boostFactor = 1.0, cutoffFrequency = 80): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'lavadspx-plugin'))
        throw new Error('Node#Info#plugins does not include the lavadspx plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('high-pass'))
        throw new Error("Node#Info#filters does not include the 'high-pass' Filter (Node has it not enable)")

      this.data = this.data ?? {}
      this.data.pluginFilters = this.data.pluginFilters ?? {}

      if (this.filters.dspxPlugin.highPass) delete this.data.pluginFilters['high-pass']
      else this.data.pluginFilters['high-pass'] = { boostFactor, cutoffFrequency }

      this.filters.dspxPlugin.highPass = !this.filters.dspxPlugin.highPass
      await this.applyPlayerFilters()
      return this
    },

    toggleNormalization: async (maxAmplitude: number = 0.75, adaptive: boolean = true): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'lavadspx-plugin'))
        throw new Error('Node#Info#plugins does not include the lavadspx plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('normalization'))
        throw new Error("Node#Info#filters does not include the 'normalization' Filter (Node has it not enable)")

      this.data = this.data ?? {}
      this.data.pluginFilters = this.data.pluginFilters ?? {}

      if (this.filters.dspxPlugin.normalization) delete this.data.pluginFilters.normalization
      else this.data.pluginFilters.normalization = { adaptive, maxAmplitude }

      this.filters.dspxPlugin.normalization = !this.filters.dspxPlugin.normalization
      await this.applyPlayerFilters()
      return this
    },

    toggleEcho: async (decay: number = 0.5, echoLength: number = 0.5): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'lavadspx-plugin'))
        throw new Error('Node#Info#plugins does not include the lavadspx plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('echo'))
        throw new Error("Node#Info#filters does not include the 'echo' Filter (Node has it not enable)")

      this.data = this.data ?? {}
      this.data.pluginFilters = this.data.pluginFilters ?? {}

      if (this.filters.dspxPlugin.echo) delete this.data.pluginFilters.echo
      else this.data.pluginFilters.echo = { decay, echoLength }

      this.filters.dspxPlugin.echo = !this.filters.dspxPlugin.echo
      await this.applyPlayerFilters()
      return this
    },
  }

  coreFilterPlugin = {
    toggleEcho: async (delay = 4, decay = 0.8): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'filter-engine'))
        throw new Error('Node#Info#plugins does not include the filter-engine plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('echo'))
        throw new Error("Node#Info#filters does not include the 'echo' Filter (Node has it not enable aka not installed!)")

      this.data = this.data ?? {}

      const { echo, reverb } = DEFAULT_FILTER_DATAS.pluginFilters['filter-engine']

      this.data.pluginFilters = {
        ...this.data.pluginFilters,
        ['filter-engine']: {
          reverb: this.data.pluginFilters?.['filter-engine']?.reverb ?? reverb,
          echo: this.filters.coreFilterPlugin.echo ? echo : { delay, decay },
        },
      }

      this.filters.coreFilterPlugin.echo = !this.filters.coreFilterPlugin.echo

      await this.applyPlayerFilters()
      return this
    },

    toggleReverb: async (delays = [0.037, 0.042, 0.048, 0.053], gains = [0.84, 0.83, 0.82, 0.81]): Promise<FilterManager> => {
      if (this.player.node._checkForPlugins && !this.player?.node?.info?.plugins?.find?.((v) => v.name === 'filter-engine'))
        throw new Error('Node#Info#plugins does not include the filter-engine plugin')
      if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('reverb'))
        throw new Error("Node#Info#filters does not include the 'reverb' Filter (Node has it not enable aka not installed!)")

      this.data = this.data ?? {}

      const { echo, reverb } = DEFAULT_FILTER_DATAS.pluginFilters['filter-engine']

      this.data.pluginFilters = {
        ...this.data.pluginFilters,
        ['filter-engine']: {
          echo: this.data.pluginFilters?.['filter-engine']?.echo ?? echo,
          reverb: this.filters.coreFilterPlugin.reverb ? reverb : { delays, gains },
        },
      }

      this.filters.coreFilterPlugin.reverb = !this.filters.coreFilterPlugin.reverb
      await this.applyPlayerFilters()
      return this
    },
  }

  public async toggleNightcore(speed = 1.289999523162842, pitch = 1.289999523162842, rate = 0.9365999523162842): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('timescale'))
      throw new Error("Node#Info#filters does not include the 'timescale' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.timescale = this.filters.nightcore ? DEFAULT_FILTER_DATAS.timescale : { speed, pitch, rate }

    this.filters.nightcore = !this.filters.nightcore
    this.filters.vaporwave = false
    this.filters.custom = false

    await this.applyPlayerFilters()
    return this
  }

  public async toggleVaporwave(speed = 0.8500000238418579, pitch = 0.800000011920929, rate = 1): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('timescale'))
      throw new Error("Node#Info#filters does not include the 'timescale' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.timescale = this.filters.vaporwave ? DEFAULT_FILTER_DATAS.timescale : { speed, pitch, rate }

    this.filters.vaporwave = !this.filters.vaporwave
    this.filters.nightcore = false
    this.filters.custom = false

    await this.applyPlayerFilters()
    return this
  }

  public async toggleKaraoke(level = 1, monoLevel = 1, filterBand = 220, filterWidth = 100): Promise<FilterManager> {
    if (this.player.node._checkForSources && !this.player?.node?.info?.filters?.includes?.('karaoke'))
      throw new Error("Node#Info#filters does not include the 'karaoke' Filter (Node has it not enable)")

    this.data = this.data ?? {}

    this.data.karaoke = this.filters.karaoke ? DEFAULT_FILTER_DATAS.karaoke : { level, monoLevel, filterBand, filterWidth }

    this.filters.karaoke = !this.filters.karaoke
    await this.applyPlayerFilters()
    return this
  }

  public isCustomFilterActive(): boolean {
    this.filters.custom = !this.filters.nightcore && !this.filters.vaporwave && Object.values(this.data.timescale).some((d) => d !== 1)
    return this.filters.custom
  }

  public async setPreset(preset: keyof typeof EQList | 'Vaporwave' | 'Nightcore' | '8D' | 'Slowmo' | 'DoubleTime' | 'Radio' | 'Lofi' | 'Tremolo' | 'Vibrato' | 'Clear'): Promise<this> {
    if (preset === 'Clear') {
      await this.clear()
      return this
    }
    if (preset === 'Vaporwave') {
      this.filters.vaporwave = true
      this.filters.nightcore = false
      this.data.timescale = { speed: 0.85, pitch: 0.8, rate: 1 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === 'Nightcore') {
      this.filters.nightcore = true
      this.filters.vaporwave = false
      this.data.timescale = { speed: 1.1, pitch: 1.2, rate: 1 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === '8D') {
      this.filters.custom = true
      this.data.rotation = { rotationHz: 0.2 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === 'Slowmo') {
      this.filters.custom = true
      this.data.timescale = { speed: 0.7, pitch: 1, rate: 1 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === 'DoubleTime') {
      this.filters.custom = true
      this.data.timescale = { speed: 1.5, pitch: 1, rate: 1 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === 'Radio') {
      this.filters.custom = true
      this.data.lowPass = { smoothing: 10 }
      await this.setEQ(EQList.Radio)
      return this
    }
    if (preset === 'Lofi') {
      this.filters.custom = true
      this.data.timescale = { speed: 1.0, pitch: 1.0, rate: 1 }
      this.data.lowPass = { smoothing: 20 }
      await this.setEQ(EQList.Lofi)
      return this
    }
    if (preset === 'Tremolo') {
      this.filters.tremolo = true
      this.data.tremolo = { frequency: 2, depth: 0.5 }
      await this.applyPlayerFilters()
      return this
    }
    if (preset === 'Vibrato') {
      this.filters.vibrato = true
      this.data.vibrato = { frequency: 2, depth: 0.5 }
      await this.applyPlayerFilters()
      return this
    }
    return this.setEQ(EQList[preset as keyof typeof EQList])
  }

  public async setEQPreset(preset: keyof typeof EQList): Promise<this> {
    return this.setEQ(EQList[preset])
  }

  public async setEQ(bands: EQBand | EQBand[], transitionMs: number = 0): Promise<this> {
    if (!Array.isArray(bands)) bands = [bands]

    if (!bands.length || !bands.every((band) => safeStringify(Object.keys(band).sort()) === '["band","gain"]'))
      throw new TypeError("Bands must be a non-empty object array containing 'band' and 'gain' properties.")

    const startBands = [...this.equalizerBands]

    if (transitionMs > 0) {
      const steps = 10
      const interval = transitionMs / steps
      for (let i = 1; i <= steps; i++) {
        for (const { band, gain } of bands) {
          const startGain = startBands[band]?.gain || 0
          const currentGain = startGain + (gain - startGain) * (i / steps)
          this.equalizerBands[band] = { band, gain: currentGain }
        }
        await this._applyEQInternal()
        await new Promise((resolve) => setTimeout(resolve, interval))
      }
    } else {
      for (const { band, gain } of bands) this.equalizerBands[band] = { band, gain }
      await this._applyEQInternal()
    }

    return this
  }

  private async _applyEQInternal(): Promise<void> {
    await this.applyPlayerFilters()
  }

  public async clearEQ(): Promise<this> {
    return this.setEQ(Array.from({ length: 15 }, (_v, i) => ({ band: i, gain: 0 })))
  }
}
