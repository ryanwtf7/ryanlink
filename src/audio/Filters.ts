import { audioOutputsData, EQList } from '../config/Constants'
import type { Player } from './Player'
import type { EQBand, FilterData, AudioFilters, PlayerFilters } from '../types/Filters'
import { PlayerSymbol } from '../utils/Utils'

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
    distortion: false,
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

  public get player(): Player {
    return (this as any)[PlayerSymbol]
  }

  constructor(player: Player) {
    ; (this as any)[PlayerSymbol] = player
  }

  /**
   * Get a filter value
   */
  public get<T extends keyof AudioFilters>(name: T): AudioFilters[T] {
    return (this.data as any)[name] ?? (this.data.pluginFilters as any)?.[name]
  }

  /**
   * Set a filter directly (hardcore mode)
   */
  public async set<T extends keyof FilterData>(name: T, value: FilterData[T], isPlugin: boolean = false) {
    if (isPlugin) {
      this.data.pluginFilters = this.data.pluginFilters ?? {}
        ; (this.data.pluginFilters as any)[name] = value
    } else {
      ; (this.data as any)[name] = value
    }
    await this.applyPlayerFilters()
    return this
  }

  /**
   * Remove a filter
   */
  public async remove(name: string) {
    delete (this.data as any)[name]
    if (this.data.pluginFilters) delete (this.data.pluginFilters as any)[name]
    await this.applyPlayerFilters()
    return this
  }

  /**
   * Override all filters
   */
  public async override(filters: AudioFilters) {
    this.data = filters
    await this.applyPlayerFilters()
    return this
  }

  async applyPlayerFilters(): Promise<void> {
    const sendData = { ...this.data } as AudioFilters & { equalizer: EQBand[] }
    this.checkFiltersState()

    if (!this.filters.volume) delete sendData.volume
    if (!this.filters.tremolo) delete sendData.tremolo
    if (!this.filters.vibrato) delete sendData.vibrato
    if (!this.filters.distortion) delete sendData.distortion
    if (!this.filters.lowPass) delete sendData.lowPass
    if (!this.filters.karaoke) delete sendData.karaoke
    if (!this.filters.rotation) delete sendData.rotation
    if (this.filters.audioOutput === 'stereo') delete sendData.channelMix

    if (sendData.timescale && Object.values(sendData.timescale).every((v) => v === 1)) delete sendData.timescale

    sendData.equalizer = [...this.equalizerBands]
    if (sendData.equalizer.length === 0) delete sendData.equalizer

    await this.player.node.updatePlayer({
      guildId: this.player.guildId,
      playerOptions: {
        filters: sendData,
      },
    })
  }

  private privateNot0(value: number | undefined, numToCheckAgains: number = 0): boolean {
    return typeof value === 'number' && value !== numToCheckAgains
  }

  checkFiltersState(): boolean {
    this.data = this.data ?? {}

    this.filters.rotation = this.privateNot0(this.data.rotation?.rotationHz)
    this.filters.vibrato = this.privateNot0(this.data.vibrato?.frequency) || this.privateNot0(this.data.vibrato?.depth)
    this.filters.tremolo = this.privateNot0(this.data.tremolo?.frequency) || this.privateNot0(this.data.tremolo?.depth)
    this.filters.distortion = !!(
      this.data.distortion &&
      Object.values(this.data.distortion).some((v) => typeof v === 'number' && v !== 0 && v !== 1)
    )

    this.filters.lowPass = this.privateNot0(this.data.lowPass?.smoothing)
    this.filters.karaoke = Object.values(this.data.karaoke ?? {}).some((v) => v !== 0)

    return true
  }

  public async resetFilters(): Promise<FilterManager> {
    this.data = structuredClone(DEFAULT_FILTER_DATAS)
    this.equalizerBands = []
    await this.applyPlayerFilters()
    return this
  }

  public async clear(): Promise<FilterManager> {
    return this.resetFilters()
  }

  // --- High Level API ---

  public async setVolume(volume: number) {
    this.data.volume = volume
    this.filters.volume = volume !== 1
    await this.applyPlayerFilters()
    return this
  }

  public async setSpeed(speed = 1) {
    this.data.timescale = { ...this.data.timescale, speed }
    await this.applyPlayerFilters()
    return this
  }

  public async setPitch(pitch = 1) {
    this.data.timescale = { ...this.data.timescale, pitch }
    await this.applyPlayerFilters()
    return this
  }

  public async toggleNightcore() {
    this.filters.nightcore = !this.filters.nightcore
    if (this.filters.nightcore) {
      this.data.timescale = { speed: 1.1, pitch: 1.2, rate: 1 }
      this.filters.vaporwave = false
    } else {
      this.data.timescale = { speed: 1, pitch: 1, rate: 1 }
    }
    await this.applyPlayerFilters()
    return this
  }

  public async toggleVaporwave() {
    this.filters.vaporwave = !this.filters.vaporwave
    if (this.filters.vaporwave) {
      this.data.timescale = { speed: 0.85, pitch: 0.8, rate: 1 }
      this.filters.nightcore = false
    } else {
      this.data.timescale = { speed: 1, pitch: 1, rate: 1 }
    }
    await this.applyPlayerFilters()
    return this
  }

  // --- EQ & Presets ---

  public async setEQ(bands: EQBand[]) {
    this.equalizerBands = bands
    await this.applyPlayerFilters()
    return this
  }

  public async setPreset(preset: keyof typeof EQList | 'Vaporwave' | 'Nightcore' | 'Clear') {
    if (preset === 'Clear') return this.resetFilters()
    if (preset === 'Vaporwave') return this.toggleVaporwave()
    if (preset === 'Nightcore') return this.toggleNightcore()

    if (EQList[preset]) {
      this.equalizerBands = EQList[preset]
      await this.applyPlayerFilters()
    }
    return this
  }
}
