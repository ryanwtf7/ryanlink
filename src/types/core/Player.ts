import type { CommonUserData, JsonObject, QueueContext, RequiredProp } from "../common";
import type { Exception, PlayerState, TrackEndReason } from "../api/Websocket";
import type { CreateNodeOptions, NodeEventMap } from "../lavalink";
import type { CreateQueueOptions } from "../audio";
import type { DefaultPlayerOptions } from "../../config";
import type { Node } from "../../lavalink/LavalinkConnection";
import type { VoiceState } from "../../voice/VoiceSession";
import type { Playlist, Queue } from "../../audio";
import type { Track } from "../../audio/AudioTrack";
import type { Player } from "../../core/RyanlinkPlayer";
import type { LyricsResult } from "../../extensions/LyricsExtension";
import type { PlayerPlugin } from "../../core/PluginSystem";

/**
 * Helper type to exclude last element from tuple
 */
type ExcludeLast<T extends unknown[]> = T extends [...infer Items, unknown] ? Items : never;

/**
 * Player event map
 */
export interface PlayerEventMap {
    /**
     * Emitted when player is initialized
     */
    init: [];

    /**
     * Emitted when a node connects
     */
    nodeConnect: [node: Node, ...ExcludeLast<NodeEventMap["connect"]>];

    /**
     * Emitted when a node is ready
     */
    nodeReady: [node: Node, ...ExcludeLast<NodeEventMap["ready"]>];

    /**
     * Emitted when a node receives a dispatch
     */
    nodeDispatch: [node: Node, ...ExcludeLast<NodeEventMap["dispatch"]>];

    /**
     * Emitted when a node encounters an error
     */
    nodeError: [node: Node, ...ExcludeLast<NodeEventMap["error"]>];

    /**
     * Emitted when a node closes
     */
    nodeClose: [node: Node, ...ExcludeLast<NodeEventMap["close"]>];

    /**
     * Emitted when a node disconnects
     */
    nodeDisconnect: [node: Node, ...ExcludeLast<NodeEventMap["disconnect"]>];

    /**
     * Emitted when voice connection is established
     */
    voiceConnect: [voice: VoiceState];

    /**
     * Emitted when voice connection closes
     */
    voiceClose: [voice: VoiceState, code: number, reason: string, byRemote: boolean];

    /**
     * Emitted when voice connection changes nodes
     */
    voiceChange: [voice: VoiceState, previousNode: Node, wasPlaying: boolean];

    /**
     * Emitted when voice connection is destroyed
     */
    voiceDestroy: [voice: VoiceState, reason: string];

    /**
     * Emitted when a queue is created
     */
    queueCreate: [queue: Queue];

    /**
     * Emitted when queue state updates
     */
    queueUpdate: [queue: Queue, state: PlayerState];

    /**
     * Emitted when queue finishes
     */
    queueFinish: [queue: Queue];

    /**
     * Emitted when a queue is destroyed
     */
    queueDestroy: [queue: Queue, reason: string];

    /**
     * Emitted when a track starts playing
     */
    trackStart: [queue: Queue, track: Track];

    /**
     * Emitted when tracks are added to a queue
     */
    trackAdd: [player: Player, guildId: string, tracks: Track[]];

    /**
     * Emitted when a track gets stuck
     */
    trackStuck: [queue: Queue, track: Track, thresholdMs: number];

    /**
     * Emitted when a track encounters an error
     */
    trackError: [queue: Queue, track: Track, exception: Exception];

    /**
     * Emitted when a track finishes
     */
    trackFinish: [queue: Queue, track: Track, reason: TrackEndReason];

    /**
     * Emitted for debug logs
     */
    debug: [name: string, info: unknown];

    /**
     * Emitted when SponsorBlock segments are loaded
     */
    segmentsLoaded: [queue: Queue, track: Track, payload: unknown];

    /**
     * Emitted when a SponsorBlock segment is skipped
     */
    segmentSkipped: [queue: Queue, track: Track, payload: unknown];

    /**
     * Emitted when fair play algorithm is applied to a queue
     */
    fairPlayApplied: [player: Player, guildId: string, count: number];

    /**
     * Emitted when lyrics are found for a track
     */
    lyricsFound: [player: Player, track: Track, result: LyricsResult];

    /**
     * Emitted when lyrics are not found for a track
     */
    lyricsNotFound: [player: Player, track: Track];

    /**
     * Emitted when a queue is saved
     */
    queueSaved: [guildId: string];

    /**
     * Emitted when a queue is loaded
     */
    queueLoaded: [guildId: string, count: number];
}

/**
 * Constructs a record type mapping plugins by their names
 */
export type PluginRecord<Plugins extends PlayerPlugin[]> = {
    [Name in Plugins[number]["name"]]: Extract<Plugins[number], { name: Name }>;
};

/**
 * Options for creating a Player
 */
export interface PlayerOptions<Plugins extends PlayerPlugin[] = PlayerPlugin[]> {
    /**
     * Options for creating node(s)
     */
    nodes: CreateNodeOptions[];

    /**
     * Plugins to initialize after creating nodes
     */
    plugins?: Plugins;

    /**
     * Whether to initialize automatically upon receiving the bot's ready event.
     * @default true
     */
    autoInit?: boolean;

    /**
     * Whether to update players for nodes that couldn't resume.
     * @default true
     */
    autoSync?: boolean;

    /**
     * The prefix to use for search queries (not URLs) by default.
     * @default "ytsearch"
     */
    queryPrefix?: string;

    /**
     * Whether to relocate queues when a node closes/disconnects.
     * @default true
     */
    relocateQueues?: boolean;

    /**
     * Forward voice state updates to your bot's gateway connection
     * @param guildId Id of the guild this voice update is meant for
     * @param payload The voice state update payload to be forwarded
     */
    forwardVoiceUpdate: (guildId: string, payload: VoiceUpdatePayload) => Promise<void>;

    /**
     * Return empty or populated array of related tracks
     * @param queue The queue requesting track(s)
     * @param track The track suggested for reference
     */
    fetchRelatedTracks?: (queue: Queue, track: Track) => Promise<Track[]>;
}

/**
 * Player instance options (with defaults applied)
 */
export type PlayerInstanceOptions = Omit<
    RequiredProp<PlayerOptions, keyof typeof DefaultPlayerOptions>,
    "nodes" | "plugins"
>;

/**
 * Voice state update payload
 */
export interface VoiceUpdatePayload {
    op: 4;
    d: {
        guild_id: string;
        channel_id: string | null;
        self_deaf: boolean;
        self_mute: boolean;
    };
}

/**
 * Options for customizing a 'search' operation
 */
export interface SearchOptions {
    /**
     * Node name to use for search
     */
    node?: string;

    /**
     * Search prefix (ytsearch, ytmsearch, scsearch, etc.)
     */
    prefix?: string;
}

/**
 * Options for customizing a 'play' operation
 */
export interface PlayOptions<
    Context extends Record<string, unknown> = QueueContext,
    UserData extends JsonObject = CommonUserData,
>
    extends SearchOptions, CreateQueueOptions<Context> {
    /**
     * User data to attach to the track
     */
    userData?: UserData;
}

/**
 * Track search result
 */
export interface TrackSearchResult {
    type: "track";
    data: Track;
}

/**
 * Playlist search result
 */
export interface PlaylistSearchResult {
    type: "playlist";
    data: Playlist;
}

/**
 * Query search result
 */
export interface QuerySearchResult {
    type: "query";
    data: Track[];
}

/**
 * Empty search result
 */
export interface EmptySearchResult {
    type: "empty";
    data: [];
}

/**
 * Error search result
 */
export interface ErrorSearchResult {
    type: "error";
    data: Exception;
}

/**
 * Search result union type
 */
export type SearchResult =
    | TrackSearchResult
    | PlaylistSearchResult
    | QuerySearchResult
    | EmptySearchResult
    | ErrorSearchResult;
