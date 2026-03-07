/**
 * Default configuration options for Ryanlink
 */

import { CLIENT_NAME, CLIENT_VERSION, CLIENT_REPOSITORY } from "../metadata";
import type { NodeOptions, PlayerOptions, RESTOptions } from "../types";

/**
 * Default REST client options
 */
export const DefaultRestOptions = Object.seal({
    /**
     * Lavalink API version
     */
    version: 4,

    /**
     * User agent string sent with requests
     */
    userAgent: `${CLIENT_NAME}/${CLIENT_VERSION} (${CLIENT_REPOSITORY})`,

    /**
     * Whether to include stack traces in error responses
     */
    stackTrace: false,

    /**
     * Request timeout in milliseconds
     */
    requestTimeout: 10_000,
} as const satisfies Partial<RESTOptions>);

/**
 * Default Node connection options
 */
export const DefaultNodeOptions = Object.seal({
    /**
     * Interval for stats updates in milliseconds
     */
    statsInterval: 60_000,

    /**
     * Highest acceptable latency in milliseconds
     */
    highestLatency: 2_000,

    /**
     * Delay before reconnection attempts in milliseconds
     */
    reconnectDelay: 10_000,

    /**
     * Maximum number of reconnection attempts (-1 = infinite)
     */
    reconnectLimit: 3,

    /**
     * WebSocket handshake timeout in milliseconds
     */
    handshakeTimeout: 5_000,
} as const satisfies Partial<Omit<NodeOptions, keyof RESTOptions>>);

/**
 * Default Player options
 */
export const DefaultPlayerOptions = Object.seal({
    /**
     * Automatically initialize player on construction
     */
    autoInit: true,

    /**
     * Automatically sync queue state with Lavalink
     */
    autoSync: true,

    /**
     * Default search prefix (ytsearch, ytmsearch, scsearch, etc.)
     */
    queryPrefix: "ytsearch",

    /**
     * Automatically relocate queues when nodes disconnect
     */
    relocateQueues: true,

    /**
     * Default function to fetch related tracks for autoplay
     * Returns empty array by default (no autoplay)
     */
    async fetchRelatedTracks() {
        return await Promise.resolve([]);
    },
} as const satisfies Partial<PlayerOptions>);

/**
 * Default queue options
 */
export const DefaultQueueOptions = Object.seal({
    /**
     * Default volume (0-1000)
     */
    volume: 100,

    /**
     * Default repeat mode
     */
    repeatMode: "none" as const,

    /**
     * Default autoplay state
     */
    autoplay: false,

    /**
     * Default paused state
     */
    paused: false,
} as const);

/**
 * Default filter values
 */
export const DefaultFilterOptions = Object.seal({
    /**
     * Volume multiplier (0.0 - 5.0)
     */
    volume: 1.0,

    /**
     * Equalizer bands (15 bands, -0.25 to 1.0 each)
     */
    equalizer: [] as Array<{ band: number; gain: number }>,

    /**
     * Karaoke filter
     */
    karaoke: null as { level?: number; monoLevel?: number; filterBand?: number; filterWidth?: number } | null,

    /**
     * Timescale filter (speed, pitch, rate)
     */
    timescale: null as { speed?: number; pitch?: number; rate?: number } | null,

    /**
     * Tremolo filter (frequency, depth)
     */
    tremolo: null as { frequency?: number; depth?: number } | null,

    /**
     * Vibrato filter (frequency, depth)
     */
    vibrato: null as { frequency?: number; depth?: number } | null,

    /**
     * Rotation filter (rotationHz)
     */
    rotation: null as { rotationHz?: number } | null,

    /**
     * Distortion filter
     */
    distortion: null as {
        sinOffset?: number;
        sinScale?: number;
        cosOffset?: number;
        cosScale?: number;
        tanOffset?: number;
        tanScale?: number;
        offset?: number;
        scale?: number;
    } | null,

    /**
     * Channel mix filter
     */
    channelMix: null as {
        leftToLeft?: number;
        leftToRight?: number;
        rightToLeft?: number;
        rightToRight?: number;
    } | null,

    /**
     * Low pass filter
     */
    lowPass: null as { smoothing?: number } | null,
} as const);

/**
 * Common HTTP status codes
 */
export const HttpStatusCodes = Object.freeze({
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const);

/**
 * WebSocket close codes
 */
export const WebSocketCloseCodes = Object.freeze({
    NORMAL: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    UNSUPPORTED_DATA: 1003,
    NO_STATUS_RECEIVED: 1005,
    ABNORMAL_CLOSURE: 1006,
    INVALID_FRAME_PAYLOAD_DATA: 1007,
    POLICY_VIOLATION: 1008,
    MESSAGE_TOO_BIG: 1009,
    INTERNAL_ERROR: 1011,
} as const);
