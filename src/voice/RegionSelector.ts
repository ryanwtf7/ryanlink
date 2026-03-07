import { OnPingUpdateSymbol } from "../config/symbols";
import type { PlayerState } from "../types";
import type { Player } from "../core/RyanlinkPlayer";

/**
 * Voice node ping statistics
 */
interface VoiceNodePingStats {
    /**
     * History of ping measurements (up to 5 samples)
     */
    history: number[];

    /**
     * Timestamp of last ping measurement
     */
    lastPingTime: number;
}

/**
 * Represents a voice region with node ping tracking
 * Used for latency-based node selection
 */
export class VoiceRegion {
    #pings = new Map<string, VoiceNodePingStats>();

    readonly id: string;
    readonly player: Player;

    constructor(player: Player, regionId: string) {
        if (player.voices.regions.has(regionId)) {
            throw new Error("An identical voice region already exists");
        }

        this.id = regionId;
        this.player = player;

        // Make properties immutable
        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            id: immutable,
            player: { ...immutable, enumerable: false },
        } as PropertyDescriptorMap);
    }

    /**
     * Check if all ready nodes have ping data for this region
     * @returns `true` if all nodes are synced, `false` otherwise
     */
    inSync(): boolean {
        return !Array.from(this.player.nodes.values()).some((n) => n.ready && !this.#pings.has(n.name));
    }

    /**
     * Remove ping data for a node
     * @param name Node name
     * @returns `true` if data was removed, `false` if it didn't exist
     */
    forgetNode(name: string): boolean {
        return this.#pings.delete(name);
    }

    /**
     * Get the average ping for a node in this region
     * @param name Node name
     * @returns Average ping in milliseconds, or `null` if no data
     */
    getAveragePing(name: string): number | null {
        const pings = this.#pings.get(name)?.history;
        if (!pings?.length) {
            return null;
        }

        return Math.round(pings.reduce((total, current) => total + current, 0) / pings.length);
    }

    /**
     * Get all nodes with their average pings
     * @returns Array of [nodeName, averagePing] tuples
     */
    getAllPings(): Array<[string, number | null]> {
        return Array.from(this.player.nodes.values()).map((node) => [node.name, this.getAveragePing(node.name)]);
    }

    /**
     * Get the most relevant node for this region
     * Selects based on lowest average ping
     * @returns The node with lowest ping, or first relevant node if no ping data
     */
    getRelevantNode() {
        return this.player.nodes.relevant().sort((a, b) => {
            const pingA = this.getAveragePing(a.name) ?? Number.MAX_SAFE_INTEGER;
            const pingB = this.getAveragePing(b.name) ?? Number.MAX_SAFE_INTEGER;
            return pingA - pingB;
        })[0];
    }

    /**
     * Internal method to update ping statistics
     * Called by the voice manager when player state updates
     * @param name Node name
     * @param state Player state with ping information
     * @internal
     */
    [OnPingUpdateSymbol](name: string, state: PlayerState): void {
        // Only process if connected and has valid ping data
        if (!state.connected) {
            return;
        }
        if (state.ping <= 0 || state.time <= 0) {
            return;
        }

        const pings = this.#pings.get(name);

        // Initialize ping tracking for this node
        if (!pings) {
            this.#pings.set(name, {
                history: [state.ping],
                lastPingTime: state.time,
            });
            return;
        }

        // Only update if enough time has passed (12 seconds)
        if (state.time - pings.lastPingTime < 12_000) {
            return;
        }

        pings.lastPingTime = state.time;
        pings.history.push(state.ping);

        // Keep only last 5 samples
        if (pings.history.length > 5) {
            pings.history.shift();
        }
    }

    /**
     * Clear all ping data for this region
     */
    clear(): void {
        this.#pings.clear();
    }

    /**
     * Get the number of nodes with ping data
     */
    get nodeCount(): number {
        return this.#pings.size;
    }

    /**
     * String representation of the voice region
     */
    toString(): string {
        return `VoiceRegion<${this.id}>`;
    }

    /**
     * JSON representation of the voice region
     */
    toJSON(): {
        id: string;
        inSync: boolean;
        nodeCount: number;
        pings: Array<{ node: string; averagePing: number | null; samples: number }>;
    } {
        return {
            id: this.id,
            inSync: this.inSync(),
            nodeCount: this.nodeCount,
            pings: Array.from(this.#pings.entries()).map(([node, stats]) => ({
                node,
                averagePing: this.getAveragePing(node),
                samples: stats.history.length,
            })),
        };
    }
}
