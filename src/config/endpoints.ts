/**
 * Lavalink REST API route constructors
 */

/**
 * An object holding methods that construct API routes based on params
 */
export const Routes = {
    /**
     * WebSocket endpoint
     * @returns `/websocket`
     */
    websocket(): "/websocket" {
        return "/websocket" as const;
    },

    /**
     * Track loading endpoint
     * @returns `/loadtracks`
     */
    trackLoading(): "/loadtracks" {
        return "/loadtracks" as const;
    },

    /**
     * Track decoding endpoint
     * @param multiple Whether to decode multiple tracks
     * @returns `/decodetrack` or `/decodetracks`
     */
    trackDecoding(multiple?: boolean): "/decodetrack" | "/decodetracks" {
        if (multiple) {
            return "/decodetracks" as const;
        }
        return "/decodetrack" as const;
    },

    /**
     * Player endpoint
     * @param sessionId Lavalink session ID
     * @param guildId Optional guild ID for specific player
     * @returns `/sessions/{sessionId}/players` or `/sessions/{sessionId}/players/{guildId}`
     */
    player(sessionId: string, guildId?: string): string {
        if (guildId) {
            return `/sessions/${sessionId}/players/${guildId}` as const;
        }
        return `/sessions/${sessionId}/players` as const;
    },

    /**
     * Session endpoint
     * @param sessionId Lavalink session ID
     * @returns `/sessions/{sessionId}`
     */
    session(sessionId: string): string {
        return `/sessions/${sessionId}` as const;
    },

    /**
     * Info endpoint
     * @returns `/info`
     */
    info(): "/info" {
        return "/info" as const;
    },

    /**
     * Stats endpoint
     * @returns `/stats`
     */
    stats(): "/stats" {
        return "/stats" as const;
    },

    /**
     * Route planner endpoint
     * @param free Optional action: `address` or `all`
     * @returns `/routeplanner/status` or `/routeplanner/free/{action}`
     */
    routePlanner(free?: "address" | "all"): string {
        if (free) {
            return `/routeplanner/free/${free}` as const;
        }
        return "/routeplanner/status" as const;
    },

    /**
     * Version endpoint
     * @returns `/version`
     */
    version(): "/version" {
        return "/version" as const;
    },
} as const;

/**
 * Type helper to extract route return types
 */
export type RouteReturnType<T extends keyof typeof Routes> = ReturnType<(typeof Routes)[T]>;
