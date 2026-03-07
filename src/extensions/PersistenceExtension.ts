import { PlayerPlugin } from "../core/PluginSystem";
import type { Player } from "../core/RyanlinkPlayer";
import type { RepeatMode } from "../types";

export interface QueuePersistencePluginEvents {
    /**
     * Emitted when queue is saved
     */
    queueSaved: [guildId: string];

    /**
     * Emitted when queue is loaded
     */
    queueLoaded: [guildId: string, trackCount: number];
}

export interface StoredQueue {
    guildId: string;
    tracks: Array<{
        encoded: string;
        info: unknown;
        pluginInfo?: unknown;
        userData?: unknown;
    }>;
    previousTracks: Array<{
        encoded: string;
        info: unknown;
        pluginInfo?: unknown;
        userData?: unknown;
    }>;
    currentTrack?: {
        encoded: string;
        info: unknown;
        position: number;
    };
    volume: number;
    repeatMode: RepeatMode;
    autoplay: boolean;
    paused: boolean;
    timestamp: number;
}

export interface QueueStore {
    get(guildId: string): Promise<StoredQueue | null> | StoredQueue | null;
    set(guildId: string, data: StoredQueue): Promise<void> | void;
    delete(guildId: string): Promise<void> | void;
}

/**
 * Default in-memory queue store
 */
export class MemoryQueueStore implements QueueStore {
    #data = new Map<string, StoredQueue>();

    get(guildId: string): StoredQueue | null {
        return this.#data.get(guildId) ?? null;
    }

    set(guildId: string, data: StoredQueue): void {
        this.#data.set(guildId, data);
    }

    delete(guildId: string): void {
        this.#data.delete(guildId);
    }
}

/**
 * Queue Persistence Plugin - Saves and restores queue state
 * Useful for bot restarts or crashes
 */
export class QueuePersistencePlugin extends PlayerPlugin<QueuePersistencePluginEvents & Record<string, unknown[]>> {
    readonly name = "queue-persistence" as const;

    #player!: Player;
    #store: QueueStore;
    #autoSave: boolean;

    constructor(store?: QueueStore, autoSave = true) {
        super();
        this.#store = store ?? new MemoryQueueStore();
        this.#autoSave = autoSave;
    }

    init(player: Player): void {
        this.#player = player;

        if (this.#autoSave) {
            // Auto-save on track changes
            player.on("trackStart", (queue, _track) => {
                this.saveQueue(queue.guildId).catch(() => {});
            });

            player.on("trackFinish", (queue, _track, _reason) => {
                this.saveQueue(queue.guildId).catch(() => {});
            });

            // Save on queue destroy
            player.on("queueDestroy", (queue) => {
                this.deleteQueue(queue.guildId).catch(() => {});
            });
        }
    }

    /**
     * Save queue state
     */
    async saveQueue(guildId: string): Promise<void> {
        const queue = this.#player.queues.get(guildId);
        if (!queue) {
            return;
        }

        const data: StoredQueue = {
            guildId,
            tracks: queue.tracks.map((track) => ({
                encoded: track.encoded,
                info: track.info,
                pluginInfo: track.pluginInfo,
                userData: track.userData,
            })),
            previousTracks: queue.previousTracks.map((t) => ({
                encoded: t.encoded,
                info: t.info,
                pluginInfo: t.pluginInfo,
                userData: t.userData,
            })),
            currentTrack: queue.track
                ? {
                      encoded: queue.track.encoded,
                      info: queue.track.info,
                      position: queue.currentTime,
                  }
                : undefined,
            volume: queue.volume,
            repeatMode: queue.repeatMode,
            autoplay: queue.autoplay,
            paused: queue.paused,
            timestamp: Date.now(),
        };

        await this.#store.set(guildId, data);
        this.#player.emit("queueSaved", guildId);
    }

    /**
     * Load queue state
     */
    async loadQueue(guildId: string): Promise<StoredQueue | null> {
        const data = await this.#store.get(guildId);
        if (!data) {
            return null;
        }

        const queue = this.#player.queues.get(guildId);
        if (!queue) {
            return null;
        }

        // Restore tracks
        // Note: Tracks need to be reconstructed from stored data
        // This is a simplified version - you'd need to properly reconstruct Track objects

        this.#player.emit("queueLoaded", guildId, data.tracks.length);
        return data;
    }

    /**
     * Delete saved queue
     */
    async deleteQueue(guildId: string): Promise<void> {
        await this.#store.delete(guildId);
    }

    /**
     * Get all saved queues
     */
    async getAllQueues(): Promise<StoredQueue[]> {
        // This would need to be implemented based on the store type
        return await Promise.resolve([]);
    }
}
