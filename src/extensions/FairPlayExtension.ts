import { PlayerPlugin } from "../core/PluginSystem";
import type { Player } from "../core/RyanlinkPlayer";
import type { Track } from "../audio/AudioTrack";

interface PlayerWithGet extends Player {
    get?<T>(key: string): T;
}

export interface FairPlayPluginEvents {
    /**
     * Emitted when fair play reorders the queue
     */
    fairPlayApplied: [player: Player, guildId: string, trackCount: number];
}

export interface FairPlayConfig {
    enabled: boolean;
    /** Minimum tracks before fair play kicks in */
    minTracks: number;
    /** Maximum consecutive tracks from same requester */
    maxConsecutive: number;
}

/**
 * Fair Play Plugin - Distributes tracks fairly among requesters
 * Prevents one user from dominating the queue
 */
export class FairPlayPlugin extends PlayerPlugin<FairPlayPluginEvents & Record<string, unknown[]>> {
    readonly name = "fairplay" as const;

    #player!: Player;
    config: FairPlayConfig = {
        enabled: true,
        minTracks: 5,
        maxConsecutive: 3,
    };

    init(player: Player): void {
        this.#player = player;

        const config = (player as PlayerWithGet).get?.("fairplay_config");
        if (config) {
            this.config = { ...this.config, ...config };
        }

        // Apply fair play when tracks are added
        player.on("trackAdd", (p, g, t) => {
            void this.#handleTrackAdd(p, g, t);
        });
    }

    #handleTrackAdd(_player: Player, guildId: string, _tracks: Track[]): void {
        if (!this.config.enabled) {
            return;
        }

        const queue = this.#player.queues.get(guildId);
        if (!queue || queue.length < this.config.minTracks) {
            return;
        }

        this.applyFairPlay(queue.guildId);
    }

    /**
     * Apply fair play algorithm to a queue
     */
    applyFairPlay(guildId: string): void {
        const queue = this.#player.queues.get(guildId);
        if (!queue) {
            return;
        }

        const playerConfig = (this.#player as PlayerWithGet).get?.("fairplay_config");
        const config = playerConfig ? { ...this.config, ...playerConfig } : this.config;

        if (queue.length < config.minTracks) {
            return;
        }

        const tracks = queue.tracks;
        const fairQueue: Track[] = [];
        const requesterQueues = new Map<string, Track[]>();

        // Group tracks by requester
        for (const track of tracks) {
            const requesterId = this.#getRequesterId(track);
            let requesterQueue = requesterQueues.get(requesterId);
            if (!requesterQueue) {
                requesterQueue = [];
                requesterQueues.set(requesterId, requesterQueue);
            }
            requesterQueue.push(track);
        }

        // Distribute tracks fairly
        let hasMore = true;
        let consecutiveCount = 0;
        let lastRequesterId: string | null = null;

        while (hasMore) {
            hasMore = false;

            for (const [requesterId, requesterTracks] of requesterQueues) {
                if (requesterTracks.length === 0) {
                    continue;
                }

                hasMore = true;

                // Check if we need to switch requester
                if (lastRequesterId === requesterId) {
                    consecutiveCount++;
                    if (consecutiveCount >= config.maxConsecutive) {
                        // Skip this requester for now
                        continue;
                    }
                } else {
                    consecutiveCount = 1;
                    lastRequesterId = requesterId;
                }

                // Add track from this requester
                const track = requesterTracks.shift();
                if (track) {
                    fairQueue.push(track);
                }
            }

            // Reset if we've gone through all requesters
            if (!hasMore) {
                lastRequesterId = null;
                consecutiveCount = 0;
                hasMore = Array.from(requesterQueues.values()).some((q) => q.length > 0);
            }
        }

        // Update queue with fair distribution
        if (fairQueue.length > 0) {
            queue.clear("current");
            queue.add(fairQueue);

            this.#player.emit("fairPlayApplied", this.#player, guildId, fairQueue.length);
        }
    }

    #getRequesterId(track: Track): string {
        const requester = (track.userData as { requester?: { id: string } }).requester;
        if (requester && typeof requester === "object") {
            return requester.id || "unknown";
        }
        return "unknown";
    }
}
