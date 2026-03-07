/**
 * Professional Equalizer Presets for Ryanlink v2
 * All presets use 15-band equalizer configuration
 */

export interface EQBand {
    band: number;
    gain: number;
}

export const EQPresets = {
    /** A Bassboost Equalizer, so high it distorts the audio */
    BassboostEarrape: [
        { band: 0, gain: 0.6 * 0.375 },
        { band: 1, gain: 0.67 * 0.375 },
        { band: 2, gain: 0.67 * 0.375 },
        { band: 3, gain: 0.4 * 0.375 },
        { band: 4, gain: -0.5 * 0.375 },
        { band: 5, gain: 0.15 * 0.375 },
        { band: 6, gain: -0.45 * 0.375 },
        { band: 7, gain: 0.23 * 0.375 },
        { band: 8, gain: 0.35 * 0.375 },
        { band: 9, gain: 0.45 * 0.375 },
        { band: 10, gain: 0.55 * 0.375 },
        { band: 11, gain: -0.6 * 0.375 },
        { band: 12, gain: 0.55 * 0.375 },
        { band: 13, gain: -0.5 * 0.375 },
        { band: 14, gain: -0.75 * 0.375 },
    ] as EQBand[],

    /** A High and decent Bassboost Equalizer */
    BassboostHigh: [
        { band: 0, gain: 0.6 * 0.25 },
        { band: 1, gain: 0.67 * 0.25 },
        { band: 2, gain: 0.67 * 0.25 },
        { band: 3, gain: 0.4 * 0.25 },
        { band: 4, gain: -0.5 * 0.25 },
        { band: 5, gain: 0.15 * 0.25 },
        { band: 6, gain: -0.45 * 0.25 },
        { band: 7, gain: 0.23 * 0.25 },
        { band: 8, gain: 0.35 * 0.25 },
        { band: 9, gain: 0.45 * 0.25 },
        { band: 10, gain: 0.55 * 0.25 },
        { band: 11, gain: -0.6 * 0.25 },
        { band: 12, gain: 0.55 * 0.25 },
        { band: 13, gain: -0.5 * 0.25 },
        { band: 14, gain: -0.75 * 0.25 },
    ] as EQBand[],

    /** A decent Bassboost Equalizer */
    BassboostMedium: [
        { band: 0, gain: 0.6 * 0.1875 },
        { band: 1, gain: 0.67 * 0.1875 },
        { band: 2, gain: 0.67 * 0.1875 },
        { band: 3, gain: 0.4 * 0.1875 },
        { band: 4, gain: -0.5 * 0.1875 },
        { band: 5, gain: 0.15 * 0.1875 },
        { band: 6, gain: -0.45 * 0.1875 },
        { band: 7, gain: 0.23 * 0.1875 },
        { band: 8, gain: 0.35 * 0.1875 },
        { band: 9, gain: 0.45 * 0.1875 },
        { band: 10, gain: 0.55 * 0.1875 },
        { band: 11, gain: -0.6 * 0.1875 },
        { band: 12, gain: 0.55 * 0.1875 },
        { band: 13, gain: -0.5 * 0.1875 },
        { band: 14, gain: -0.75 * 0.1875 },
    ] as EQBand[],

    /** A slight Bassboost Equalizer */
    BassboostLow: [
        { band: 0, gain: 0.6 * 0.125 },
        { band: 1, gain: 0.67 * 0.125 },
        { band: 2, gain: 0.67 * 0.125 },
        { band: 3, gain: 0.4 * 0.125 },
        { band: 4, gain: -0.5 * 0.125 },
        { band: 5, gain: 0.15 * 0.125 },
        { band: 6, gain: -0.45 * 0.125 },
        { band: 7, gain: 0.23 * 0.125 },
        { band: 8, gain: 0.35 * 0.125 },
        { band: 9, gain: 0.45 * 0.125 },
        { band: 10, gain: 0.55 * 0.125 },
        { band: 11, gain: -0.6 * 0.125 },
        { band: 12, gain: 0.55 * 0.125 },
        { band: 13, gain: -0.5 * 0.125 },
        { band: 14, gain: -0.75 * 0.125 },
    ] as EQBand[],

    /** Professional high-fidelity audio preset for clear vocals and deep bass */
    HighQuality: [
        { band: 0, gain: 0.15 },
        { band: 1, gain: 0.1 },
        { band: 2, gain: 0.05 },
        { band: 3, gain: 0 },
        { band: 4, gain: 0 },
        { band: 5, gain: 0 },
        { band: 6, gain: 0 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0 },
        { band: 10, gain: 0.05 },
        { band: 11, gain: 0.1 },
        { band: 12, gain: 0.15 },
        { band: 13, gain: 0.15 },
        { band: 14, gain: 0.15 },
    ] as EQBand[],

    /** Makes the Music slightly "better" */
    BetterMusic: [
        { band: 0, gain: 0.25 },
        { band: 1, gain: 0.025 },
        { band: 2, gain: 0.0125 },
        { band: 3, gain: 0 },
        { band: 4, gain: 0 },
        { band: 5, gain: -0.0125 },
        { band: 6, gain: -0.025 },
        { band: 7, gain: -0.0175 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0 },
        { band: 10, gain: 0.0125 },
        { band: 11, gain: 0.025 },
        { band: 12, gain: 0.25 },
        { band: 13, gain: 0.125 },
        { band: 14, gain: 0.125 },
    ] as EQBand[],

    /** Makes the Music sound like rock music / sound rock music better */
    Rock: [
        { band: 0, gain: 0.3 },
        { band: 1, gain: 0.25 },
        { band: 2, gain: 0.2 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0.05 },
        { band: 5, gain: -0.05 },
        { band: 6, gain: -0.15 },
        { band: 7, gain: -0.2 },
        { band: 8, gain: -0.1 },
        { band: 9, gain: -0.05 },
        { band: 10, gain: 0.05 },
        { band: 11, gain: 0.1 },
        { band: 12, gain: 0.2 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.3 },
    ] as EQBand[],

    /** Makes the Music sound like Classic music / sound Classic music better */
    Classic: [
        { band: 0, gain: 0.375 },
        { band: 1, gain: 0.35 },
        { band: 2, gain: 0.125 },
        { band: 3, gain: 0 },
        { band: 4, gain: 0 },
        { band: 5, gain: 0.125 },
        { band: 6, gain: 0.55 },
        { band: 7, gain: 0.05 },
        { band: 8, gain: 0.125 },
        { band: 9, gain: 0.25 },
        { band: 10, gain: 0.2 },
        { band: 11, gain: 0.25 },
        { band: 12, gain: 0.3 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.3 },
    ] as EQBand[],

    /** Makes the Music sound like Pop music / sound Pop music better */
    Pop: [
        { band: 0, gain: 0.26 },
        { band: 1, gain: 0.22 },
        { band: 2, gain: 0.18 },
        { band: 3, gain: 0.12 },
        { band: 4, gain: 0.1 },
        { band: 5, gain: 0.03 },
        { band: 6, gain: -0.005 },
        { band: 7, gain: -0.01 },
        { band: 8, gain: -0.015 },
        { band: 9, gain: -0.015 },
        { band: 10, gain: -0.01 },
        { band: 11, gain: -0.005 },
        { band: 12, gain: 0.08 },
        { band: 13, gain: 0.15 },
        { band: 14, gain: 0.2 },
    ] as EQBand[],

    /** Makes the Music sound like Electronic music / sound Electronic music better */
    Electronic: [
        { band: 0, gain: 0.375 },
        { band: 1, gain: 0.35 },
        { band: 2, gain: 0.125 },
        { band: 3, gain: 0 },
        { band: 4, gain: 0 },
        { band: 5, gain: -0.125 },
        { band: 6, gain: -0.125 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0.25 },
        { band: 9, gain: 0.125 },
        { band: 10, gain: 0.15 },
        { band: 11, gain: 0.2 },
        { band: 12, gain: 0.25 },
        { band: 13, gain: 0.35 },
        { band: 14, gain: 0.4 },
    ] as EQBand[],

    /** Boosts all Bands slightly for louder and fuller sound */
    FullSound: [
        { band: 0, gain: 0.25 },
        { band: 1, gain: 0.25 },
        { band: 2, gain: 0.25 },
        { band: 3, gain: 0.25 },
        { band: 4, gain: 0.25 },
        { band: 5, gain: 0.25 },
        { band: 6, gain: 0.25 },
        { band: 7, gain: 0.25 },
        { band: 8, gain: 0.25 },
        { band: 9, gain: 0.25 },
        { band: 10, gain: 0.25 },
        { band: 11, gain: 0.25 },
        { band: 12, gain: 0.25 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.25 },
    ] as EQBand[],

    /** Makes the Music sound like being in a Gaming environment / sound Gaming music better */
    Gaming: [
        { band: 0, gain: 0.35 },
        { band: 1, gain: 0.3 },
        { band: 2, gain: 0.25 },
        { band: 3, gain: 0.2 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0.075 },
        { band: 7, gain: 0 },
        { band: 8, gain: -0.05 },
        { band: 9, gain: 0.05 },
        { band: 10, gain: 0.1 },
        { band: 11, gain: 0.15 },
        { band: 12, gain: 0.25 },
        { band: 13, gain: 0.3 },
        { band: 14, gain: 0.35 },
    ] as EQBand[],

    /** Nightcore preset with speed and pitch adjustments */
    Nightcore: [
        { band: 0, gain: 0.2 },
        { band: 1, gain: 0.15 },
        { band: 2, gain: 0.1 },
        { band: 3, gain: 0.05 },
        { band: 4, gain: 0 },
        { band: 5, gain: -0.05 },
        { band: 6, gain: -0.1 },
        { band: 7, gain: -0.05 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0.05 },
        { band: 10, gain: 0.1 },
        { band: 11, gain: 0.15 },
        { band: 12, gain: 0.2 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.3 },
    ] as EQBand[],

    /** Vaporwave preset */
    Vaporwave: [
        { band: 0, gain: 0.35 },
        { band: 1, gain: 0.3 },
        { band: 2, gain: 0.2 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0 },
        { band: 5, gain: -0.05 },
        { band: 6, gain: -0.1 },
        { band: 7, gain: -0.15 },
        { band: 8, gain: -0.1 },
        { band: 9, gain: 0 },
        { band: 10, gain: 0.1 },
        { band: 11, gain: 0.15 },
        { band: 12, gain: 0.2 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.3 },
    ] as EQBand[],

    /** Treble and Bass boost */
    TrebleBass: [
        { band: 0, gain: 0.3 },
        { band: 1, gain: 0.25 },
        { band: 2, gain: 0.2 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0 },
        { band: 5, gain: -0.05 },
        { band: 6, gain: -0.1 },
        { band: 7, gain: -0.05 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0.05 },
        { band: 10, gain: 0.1 },
        { band: 11, gain: 0.15 },
        { band: 12, gain: 0.2 },
        { band: 13, gain: 0.25 },
        { band: 14, gain: 0.3 },
    ] as EQBand[],

    /** Soft preset */
    Soft: [
        { band: 0, gain: 0.1 },
        { band: 1, gain: 0.08 },
        { band: 2, gain: 0.06 },
        { band: 3, gain: 0.04 },
        { band: 4, gain: 0.02 },
        { band: 5, gain: 0 },
        { band: 6, gain: 0 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0 },
        { band: 10, gain: 0.02 },
        { band: 11, gain: 0.04 },
        { band: 12, gain: 0.06 },
        { band: 13, gain: 0.08 },
        { band: 14, gain: 0.1 },
    ] as EQBand[],

    /** TV preset */
    TV: [
        { band: 0, gain: 0.2 },
        { band: 1, gain: 0.25 },
        { band: 2, gain: 0.3 },
        { band: 3, gain: 0.25 },
        { band: 4, gain: 0.2 },
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0.1 },
        { band: 9, gain: 0.15 },
        { band: 10, gain: 0.2 },
        { band: 11, gain: 0.15 },
        { band: 12, gain: 0.1 },
        { band: 13, gain: 0.05 },
        { band: 14, gain: 0 },
    ] as EQBand[],

    /** Radio preset */
    Radio: [
        { band: 0, gain: 0.15 },
        { band: 1, gain: 0.2 },
        { band: 2, gain: 0.25 },
        { band: 3, gain: 0.2 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0.1 },
        { band: 10, gain: 0.15 },
        { band: 11, gain: 0.2 },
        { band: 12, gain: 0.15 },
        { band: 13, gain: 0.1 },
        { band: 14, gain: 0.05 },
    ] as EQBand[],

    /** Normalization preset (all bands at 0) */
    Normalization: [
        { band: 0, gain: 0 },
        { band: 1, gain: 0 },
        { band: 2, gain: 0 },
        { band: 3, gain: 0 },
        { band: 4, gain: 0 },
        { band: 5, gain: 0 },
        { band: 6, gain: 0 },
        { band: 7, gain: 0 },
        { band: 8, gain: 0 },
        { band: 9, gain: 0 },
        { band: 10, gain: 0 },
        { band: 11, gain: 0 },
        { band: 12, gain: 0 },
        { band: 13, gain: 0 },
        { band: 14, gain: 0 },
    ] as EQBand[],
} as const;

export type EQPresetName = keyof typeof EQPresets;

/**
 * Get an EQ preset by name
 * @param name The preset name
 * @returns The EQ bands for the preset
 */
export function getEQPreset(name: EQPresetName): readonly EQBand[] {
    return EQPresets[name];
}

/**
 * Get all available EQ preset names
 * @returns Array of preset names
 */
export function getEQPresetNames(): EQPresetName[] {
    return Object.keys(EQPresets) as EQPresetName[];
}

/**
 * Check if a preset name is valid
 * @param name The preset name to check
 * @returns True if the preset exists
 */
export function isValidEQPreset(name: string): name is EQPresetName {
    return name in EQPresets;
}
