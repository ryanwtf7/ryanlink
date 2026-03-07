import { PlayerPlugin } from "../core/PluginSystem";
import type { Player } from "../core/RyanlinkPlayer";
import { Track } from "../audio/AudioTrack";
import { Queue } from "../audio/AudioQueue";
import type { SponsorBlockSegment } from "../types/lavalink/Node";

export interface SponsorBlockPluginEvents {
    /**
     * Emitted when segments are loaded
     */
    segmentsLoaded: [queue: Queue, track: Track, segments: SponsorBlockSegment[]];

    /**
     * Emitted when a segment is skipped
     */
    segmentSkipped: [queue: Queue, track: Track, segment: SponsorBlockSegment];
}

/**
 * SponsorBlock Plugin - Automatically skip sponsored segments in videos
 * Requires Lavalink SponsorBlock plugin
 */
export class SponsorBlockPlugin extends PlayerPlugin<SponsorBlockPluginEvents & Record<string, unknown[]>> {
    readonly name = "sponsorblock" as const;

    #player!: Player;

    init(player: Player): void {
        this.#player = player;

        // Listen to SponsorBlock events from Lavalink
        player.on("segmentsLoaded", this.#handleSegmentsLoaded.bind(this));
        player.on("segmentSkipped", this.#handleSegmentSkipped.bind(this));
    }

    /**
     * Set which segments to skip for a player
     */
    async setSegments(queue: Queue, segments: string[] = ["sponsor", "selfpromo"]): Promise<void> {
        const node = queue.node;
        if (!node) {
            throw new Error("No node available");
        }

        await node.setSponsorBlock(queue, segments);
    }

    /**
     * Get current SponsorBlock segments for a player
     */
    async getSegments(queue: Queue): Promise<string[]> {
        const node = queue.node;
        if (!node) {
            throw new Error("No node available");
        }

        return await node.getSponsorBlock(queue);
    }

    /**
     * Delete SponsorBlock configuration for a player
     */
    async deleteSegments(queue: Queue): Promise<void> {
        const node = queue.node;
        if (!node) {
            throw new Error("No node available");
        }

        await node.deleteSponsorBlock(queue);
    }

    #handleSegmentsLoaded(queue: Queue, track: Track, segments: unknown): void {
        const _segments = (segments as SponsorBlockSegment[]) || [];
        this.#player.emit("segmentsLoaded", queue, track, _segments);
    }

    #handleSegmentSkipped(queue: Queue, track: Track, segment: unknown): void {
        const _segment = segment as SponsorBlockSegment;
        this.#player.emit("segmentSkipped", queue, track, _segment);
    }
}
