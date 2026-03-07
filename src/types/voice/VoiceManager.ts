import type { NonNullableProp } from "../common";
import type { CreateQueueOptions } from "../audio";

/**
 * Common info in Discord's 'dispatch' payload type
 */
export interface CommonDispatchPayloadInfo {
    op: 0;
    s: number;
}

/**
 * Discord client ready payload (partial, essential only)
 */
export interface BotReadyPayload extends CommonDispatchPayloadInfo {
    t: "READY";
    d: {
        user: {
            id: string;
        };
    };
}

/**
 * Discord voice state update payload
 */
export interface VoiceStateUpdatePayload extends CommonDispatchPayloadInfo {
    t: "VOICE_STATE_UPDATE";
    d: {
        guild_id?: string;
        channel_id: string | null;
        user_id: string;
        session_id: string;
        deaf: boolean;
        mute: boolean;
        self_deaf: boolean;
        self_mute: boolean;
        suppress: boolean;
    };
}

/**
 * Discord voice server update payload
 */
export interface VoiceServerUpdatePayload extends CommonDispatchPayloadInfo {
    t: "VOICE_SERVER_UPDATE";
    d: {
        token: string;
        guild_id: string;
        endpoint: string | null;
    };
}

/**
 * Discord dispatch payload
 */
export type DiscordDispatchPayload = BotReadyPayload | VoiceStateUpdatePayload | VoiceServerUpdatePayload;

/**
 * Internal ref representing client-side voice state
 */
export interface BotVoiceState
    extends
        Required<NonNullableProp<Omit<VoiceStateUpdatePayload["d"], "guild_id" | "user_id">, "channel_id">>,
        NonNullableProp<Omit<VoiceServerUpdatePayload["d"], "guild_id">, "endpoint"> {
    /**
     * Whether the voice connection is established
     */
    connected: boolean;

    /**
     * The node session ID this voice state is connected to
     */
    node_session_id: string;

    /**
     * Whether the voice connection is reconnecting
     */
    reconnecting: boolean;

    /**
     * The voice region ID (extracted from endpoint)
     */
    region_id: string;
}

/**
 * Options for customizing the player while connecting
 */
export interface ConnectOptions extends Pick<CreateQueueOptions, "context" | "filters" | "node" | "volume"> {}

/**
 * Discord voice close event codes
 * https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-close-event-codes
 */
export const enum VoiceCloseCodes {
    /**
     * You sent an invalid opcode.
     */
    UnknownOpcode = 4001,

    /**
     * You sent an invalid payload in your identifying to the Gateway.
     */
    FailedToDecodePayload,

    /**
     * You sent a payload before identifying with the Gateway.
     */
    NotAuthenticated,

    /**
     * The token you sent in your identify payload is incorrect.
     */
    AuthenticationFailed,

    /**
     * You sent more than one identify payload.
     */
    AlreadyAuthenticated,

    /**
     * Your session is no longer valid.
     */
    SessionNoLongerValid,

    /**
     * Your session has timed out.
     */
    SessionTimeout = 4009,

    /**
     * We can't find the server you're trying to connect to.
     */
    ServerNotFound = 4011,

    /**
     * We didn't recognize the protocol you sent.
     */
    UnknownProtocol,

    /**
     * Disconnect individual client (you were kicked, the main gateway session was dropped, etc.). Should not reconnect.
     */
    Disconnected = 4014,

    /**
     * The server crashed. Our bad! Try resuming.
     */
    VoiceServerCrashed,

    /**
     * We didn't recognize your encryption.
     */
    UnknownEncryptionMode,

    /**
     * This channel requires a client supporting E2EE via the DAVE Protocol
     */
    DAVEProtocolRequired,

    /**
     * You sent a malformed request.
     */
    BadRequest = 4020,

    /**
     * Disconnect due to rate limit exceeded. Should not reconnect.
     */
    DisconnectedRateLimited,

    /**
     * Disconnect all clients due to call terminated (channel deleted, voice server changed, etc.). Should not reconnect.
     */
    DisconnectedCallTerminated,
}
