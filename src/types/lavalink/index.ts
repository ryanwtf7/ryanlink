/**
 * Lavalink type definitions
 */

export * from "./REST";
export type { LavalinkInfo } from "../api/Rest";
export * from "./Node";
export * from "./NodeManager";

import type { StatsPayload } from "../api/Websocket";
export * from "../api/Websocket";
import type { Node } from "../../lavalink/LavalinkConnection";

/**
 * Node stats event data
 */
export interface BaseNodeStats extends StatsPayload {}

/**
 * Node manager events
 */
export interface NodeManagerEvents {
    create: [node: Node];
    destroy: [node: Node];
    connect: [node: Node];
    ready: [node: Node, resumed: boolean, sessionId: string];
    disconnect: [node: Node, reason: { code: number; reason: string }];
    reconnecting: [node: Node];
    error: [node: Node, error: Error];
    raw: [node: Node, payload: unknown];
    nodeInfo: [node: Node, info: unknown];
}
