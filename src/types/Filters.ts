import type { FloatNumber, IntegerNumber } from './Utils'

export type AudioOutputs = 'mono' | 'stereo' | 'left' | 'right'

export interface PlayerFilters {
  custom: boolean

  nightcore: boolean

  vaporwave: boolean

  rotation: boolean

  karaoke: boolean

  tremolo: boolean

  vibrato: boolean

  lowPass: boolean

  audioOutput: AudioOutputs

  nodeLinkEcho: boolean

  nodeLinkChorus: boolean

  nodeLinkCompressor: boolean

  nodeLinkHighPass: boolean

  nodeLinkPhaser: boolean

  nodeLinkSpatial: boolean

  volume: boolean

  coreFilterPlugin: {
    echo: boolean

    reverb: boolean
  }
  dspxPlugin: {
    lowPass: boolean

    highPass: boolean

    normalization: boolean

    echo: boolean
  }
}

export interface EQBand {
  band: IntegerNumber | number

  gain: FloatNumber | number
}

export interface KaraokeFilter {
  level?: number

  monoLevel?: number

  filterBand?: number

  filterWidth?: number
}

export interface TimescaleFilter {
  speed?: number

  pitch?: number

  rate?: number
}

export interface TremoloFilter {
  frequency?: number

  depth?: number
}

export interface VibratoFilter {
  frequency?: number

  depth?: number
}

export interface RotationFilter {
  rotationHz?: number
}

export interface DistortionFilter {
  sinOffset?: number
  sinScale?: number
  cosOffset?: number
  cosScale?: number
  tanOffset?: number
  tanScale?: number
  offset?: number
  scale?: number
}

export interface ChannelMixFilter {
  leftToLeft?: number

  leftToRight?: number

  rightToLeft?: number

  rightToRight?: number
}

export interface NodeLink_EchoFilter {
  delay?: number

  feedback?: number

  mix?: number
}

export interface NodeLink_ChorusFilter {
  rate?: number

  depth?: number

  delay?: number

  mix?: number

  feedback?: number
}

export interface NodeLink_CompressorFilter {
  threshold?: number

  ratio?: number

  attack?: number

  release?: number

  gain?: number
}

export interface NodeLink_HighPassFilter {
  smoothing?: number
}

export interface NodeLink_PhaserFilter {
  stages?: number

  rate?: number

  depth?: number

  feedback?: number

  mix?: number

  minFrequency?: number

  maxFrequency?: number
}

export interface NodeLink_SpatialFilter {
  depth?: number

  rate?: number
}

export interface LowPassFilter {
  smoothing?: number
}

export interface FilterData {
  volume?: number
  karaoke?: KaraokeFilter
  timescale?: TimescaleFilter
  tremolo?: TremoloFilter
  vibrato?: VibratoFilter
  rotation?: RotationFilter
  distortion?: DistortionFilter
  channelMix?: ChannelMixFilter
  lowPass?: LowPassFilter
  echo?: NodeLink_EchoFilter
  chorus?: NodeLink_ChorusFilter
  compressor?: NodeLink_CompressorFilter
  highPass?: NodeLink_HighPassFilter
  phaser?: NodeLink_PhaserFilter
  spatial?: NodeLink_SpatialFilter
  pluginFilters?: {
    'filter-engine'?: {
      echo?: {
        delay?: number
        decay?: number
      }
      reverb?: {
        delays?: number[]
        gains?: number[]
      }
    }
    'high-pass'?: {
      cutoffFrequency?: number
      boostFactor?: number
    }
    'low-pass'?: {
      cutoffFrequency?: number
      boostFactor?: number
    }
    normalization?: {
      maxAmplitude?: number
      adaptive?: boolean
    }
    echo?: {
      echoLength?: number
      decay?: number
    }
  }
}

export interface AudioFilters extends FilterData {
  equalizer?: EQBand[]
}
