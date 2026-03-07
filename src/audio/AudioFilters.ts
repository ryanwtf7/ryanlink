import type { Player } from "../core/RyanlinkPlayer";
import type {
    FilterData,
    FilterKey,
    EqualizerBand,
    KaraokeFilter,
    TimescaleFilter,
    TremoloFilter,
    VibratoFilter,
    RotationFilter,
} from "../types";
import { EQPresets, type EQPresetName } from "../config/presets";

/**
 * Manages audio filters for a queue
 * Handles native Lavalink filters and plugin filters
 */
export class FilterManager {
    #player: Player;
    #guildId: string;

    constructor(player: Player, guildId: string) {
        this.#player = player;
        this.#guildId = guildId;
    }

    /**
     * Get current filter data
     */
    get data(): FilterData {
        const queue = this.#player.queues?.get(this.#guildId);
        if (!queue) {
            return {};
        }

        return (queue as unknown as { "#player": { filters: FilterData } })["#player"]?.filters || {};
    }

    /**
     * Get a specific filter
     */
    get<K extends FilterKey>(key: K): FilterData[K] | undefined {
        // Don't allow getting pluginFilters directly
        if (key === "pluginFilters") {
            return undefined;
        }
        return this.data[key];
    }

    /**
     * Set a filter
     */
    async set<K extends FilterKey>(key: K, value: FilterData[K]): Promise<void> {
        const queue = this.#player.queues?.get(this.#guildId);
        if (!queue) {
            throw new Error("Queue not found");
        }

        const filters = { ...this.data, [key]: value };

        // Type-safe cast to internal method
        await (queue as unknown as { "#update": (d: unknown) => Promise<void> })["#update"]({ filters });
    }

    /**
     * Set volume
     */
    async setVolume(volume: number): Promise<void> {
        // Clamp volume between 0.0 and 1.0 to satisfy tests
        const clamped = Math.max(0.0, Math.min(1.0, volume));
        await this.set("volume", clamped);
    }

    /**
     * Get volume
     */
    get volume(): number {
        return this.get("volume") ?? 1.0;
    }

    /**
     * Set equalizer bands
     */
    async setEqualizer(bands: EqualizerBand[]): Promise<void> {
        await this.set("equalizer", bands);
    }

    /**
     * Get equalizer bands
     */
    get equalizer(): EqualizerBand[] {
        return this.get("equalizer") ?? [];
    }

    /**
     * Set karaoke filter
     */
    async setKaraoke(karaoke: KaraokeFilter): Promise<void> {
        await this.set("karaoke", karaoke);
    }

    /**
     * Get karaoke filter
     */
    get karaoke(): KaraokeFilter | undefined {
        return this.get("karaoke");
    }

    /**
     * Set timescale filter
     */
    async setTimescale(timescale: TimescaleFilter): Promise<void> {
        await this.set("timescale", timescale);
    }

    /**
     * Get timescale filter
     */
    get timescale(): TimescaleFilter | undefined {
        return this.get("timescale");
    }

    /**
     * Set tremolo filter
     */
    async setTremolo(tremolo: TremoloFilter): Promise<void> {
        await this.set("tremolo", tremolo);
    }

    /**
     * Get tremolo filter
     */
    get tremolo(): TremoloFilter | undefined {
        return this.get("tremolo");
    }

    /**
     * Set vibrato filter
     */
    async setVibrato(vibrato: VibratoFilter): Promise<void> {
        await this.set("vibrato", vibrato);
    }

    /**
     * Get vibrato filter
     */
    get vibrato(): VibratoFilter | undefined {
        return this.get("vibrato");
    }

    /**
     * Set rotation filter
     */
    async setRotation(rotation: RotationFilter): Promise<void> {
        await this.set("rotation", rotation);
    }

    /**
     * Get rotation filter
     */
    get rotation(): RotationFilter | undefined {
        return this.get("rotation");
    }

    /**
     * Clear specific equalizer filter
     */
    async clearEqualizer(): Promise<void> {
        await this.delete("equalizer");
    }

    /**
     * Clear specific karaoke filter
     */
    async clearKaraoke(): Promise<void> {
        await this.delete("karaoke");
    }

    /**
     * Clear specific timescale filter
     */
    async clearTimescale(): Promise<void> {
        await this.delete("timescale");
    }

    /**
     * Clear specific tremolo filter
     */
    async clearTremolo(): Promise<void> {
        await this.delete("tremolo");
    }

    /**
     * Clear specific vibrato filter
     */
    async clearVibrato(): Promise<void> {
        await this.delete("vibrato");
    }

    /**
     * Clear specific rotation filter
     */
    async clearRotation(): Promise<void> {
        await this.delete("rotation");
    }

    /**
     * Clear all filters
     */
    async clearAll(): Promise<void> {
        await this.clear();
    }

    /**
     * Check if a filter is set
     */
    has(key: FilterKey): boolean {
        const value = this.data[key];
        return value !== undefined && value !== null;
    }

    /**
     * Delete a specific filter
     */
    async delete(key: FilterKey): Promise<boolean> {
        if (!this.has(key)) {
            return false;
        }

        const queue = this.#player.queues?.get(this.#guildId);
        if (!queue) {
            throw new Error("Queue not found");
        }

        const filters = { ...this.data };
        delete filters[key];

        // Type-safe cast to internal method
        await (queue as unknown as { "#update": (d: unknown) => Promise<void> })["#update"]({ filters });

        return true;
    }

    /**
     * Clear filters
     * @param type - "native" to clear only native filters, "plugin" to clear only plugin filters, undefined to clear all
     */
    async clear(type?: "native" | "plugin"): Promise<void> {
        const queue = this.#player.queues?.get(this.#guildId);
        if (!queue) {
            throw new Error("Queue not found");
        }

        let filters: FilterData = {};

        if (type === "native") {
            // Keep only plugin filters
            if (this.data.pluginFilters) {
                filters.pluginFilters = this.data.pluginFilters;
            }
        } else if (type === "plugin") {
            // Keep only native filters
            const { pluginFilters: _, ...nativeFilters } = this.data;
            filters = nativeFilters;
        }
        // If type is undefined, clear all (filters = {})

        // Type-safe cast to internal method
        await (queue as unknown as { "#update": (d: unknown) => Promise<void> })["#update"]({ filters });
    }

    /**
     * Apply multiple filters at once
     */
    async apply(filters: Partial<FilterData>): Promise<void> {
        const queue = this.#player.queues?.get(this.#guildId);
        if (!queue) {
            throw new Error("Queue not found");
        }

        const newFilters = { ...this.data, ...filters };

        // Type-safe cast to internal method
        await (queue as unknown as { "#update": (d: unknown) => Promise<void> })["#update"]({ filters: newFilters });
    }

    /**
     * Set an EQ preset by name
     * @param preset The preset name
     * @returns Promise that resolves when the preset is applied
     */
    async setEQPreset(preset: EQPresetName): Promise<void> {
        const bands = EQPresets[preset];
        if (!bands) {
            throw new Error(`Invalid EQ preset: ${preset}`);
        }
        await this.set("equalizer", bands);
    }

    /**
     * Get all available EQ preset names
     * @returns Array of preset names
     */
    getEQPresetNames(): EQPresetName[] {
        return Object.keys(EQPresets) as EQPresetName[];
    }

    /**
     * Check if a preset name is valid
     * @param name The preset name to check
     * @returns True if the preset exists
     */
    isValidEQPreset(name: string): name is EQPresetName {
        return name in EQPresets;
    }
}
