import type { NodeOptions } from "../../types/lavalink/Node";

/**
 * Options for creating a node via manager
 */
export type CreateNodeOptions = Omit<NodeOptions, "clientId">;

/**
 * Types of node features for support evaluation
 */
export type FeatureTypes = "filter" | "source" | "plugin";

/**
 * Simplified node stats for relevance evaluation.
 *
 * The value of each field lies within [0, 1]
 * except `streaming`, where -1 reports insufficient data
 */
export interface NodeMetrics {
    /**
     * Memory usage (0-1 scale, 0 = no usage, 1 = full usage)
     */
    memory: number;

    /**
     * Workload (0-1 scale, 0 = no load, 1 = full load)
     */
    workload: number;

    /**
     * Streaming quality (0-1 scale, 0 = poor, 1 = excellent, -1 = insufficient data)
     */
    streaming: number;
}
