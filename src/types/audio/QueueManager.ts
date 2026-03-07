import type { QueueContext } from "../common";
import type { PlayerUpdateRequestBody } from "../api";

/**
 * Options for creating a queue via manager
 */
export interface CreateQueueOptions<Context extends Record<string, unknown> = QueueContext> extends Pick<
    PlayerUpdateRequestBody,
    "filters" | "volume"
> {
    /**
     * Guild ID for the queue
     */
    guildId: string;

    /**
     * Voice channel ID to connect to
     */
    voiceId: string;

    /**
     * Node name to use (optional, will use best node if not specified)
     */
    node?: string;

    /**
     * Custom context data for the queue
     */
    context?: Context;
}
