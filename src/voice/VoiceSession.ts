import { LookupSymbol } from "../config/symbols";
import { noop } from "../utils";
import type { APIPlayer, BotVoiceState, PlayerUpdateRequestBody } from "../types";
import type { Node } from "../lavalink/LavalinkConnection";
import type { Player } from "../core/RyanlinkPlayer";

/**
 * Represents the voice connection state for a guild
 * Manages voice connection, node changes, and player state
 */
export class VoiceState {
    #changePromise: Promise<void> | null = null;
    #node: Node;

    #state: BotVoiceState;
    #player: APIPlayer;

    readonly guildId: string;
    readonly player: Player;

    constructor(player: Player, node: string, guildId: string) {
        if (player.voices.has(guildId)) {
            throw new Error("An identical voice state already exists");
        }

        const _node = player.nodes.get(node);
        if (!_node) {
            throw new Error(`Node '${node}' not found`);
        }
        if (!_node.ready) {
            throw new Error(`Node '${node}' not ready`);
        }

        const state = player.voices[LookupSymbol](guildId);
        if (!state) {
            throw new Error(`No connection found for guild '${guildId}'`);
        }

        const _player = player.queues[LookupSymbol](guildId);
        if (!_player) {
            throw new Error(`No player found for guild '${guildId}'`);
        }

        this.#node = _node;
        this.#state = state;
        this.#player = _player;

        this.guildId = guildId;
        this.player = player;

        // Make properties immutable
        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            guildId: immutable,
            player: { ...immutable, enumerable: false },
        } as PropertyDescriptorMap);
    }

    /**
     * Current node for this voice connection
     */
    get node(): Node {
        return this.#node;
    }

    /**
     * Ping to the voice server in milliseconds
     */
    get ping(): number {
        return this.#player.state.ping;
    }

    /**
     * Voice region ID (e.g., "us-west", "eu-central")
     */
    get regionId(): string | null {
        return this.#state.region_id;
    }

    /**
     * Voice channel ID
     */
    get channelId(): string {
        return this.#state.channel_id;
    }

    /**
     * Whether the bot is self-deafened
     */
    get selfDeaf(): boolean {
        return this.#state.self_deaf;
    }

    /**
     * Whether the bot is self-muted
     */
    get selfMute(): boolean {
        return this.#state.self_mute;
    }

    /**
     * Whether the bot is server-deafened
     */
    get serverDeaf(): boolean {
        return this.#state.deaf;
    }

    /**
     * Whether the bot is server-muted
     */
    get serverMute(): boolean {
        return this.#state.mute;
    }

    /**
     * Whether the bot is suppressed (priority speaker)
     */
    get suppressed(): boolean {
        return this.#state.suppress;
    }

    /**
     * Whether this voice state has been destroyed
     */
    get destroyed(): boolean {
        return this.player.voices.get(this.guildId) !== this;
    }

    /**
     * Whether the voice connection is fully connected
     */
    get connected(): boolean {
        if (!this.#player.state.connected) {
            return false;
        }
        return this.#state.connected && this.#state.node_session_id === this.#node.sessionId;
    }

    /**
     * Whether the voice connection is reconnecting
     */
    get reconnecting(): boolean {
        return this.#state.reconnecting;
    }

    /**
     * Whether the voice connection is disconnected
     */
    get disconnected(): boolean {
        return !this.connected && !this.reconnecting;
    }

    /**
     * Whether the voice connection is changing nodes
     */
    get changingNode(): boolean {
        return this.#changePromise !== null;
    }

    /**
     * Session ID for the voice connection
     */
    get sessionId(): string | null {
        return this.#state.session_id;
    }

    /**
     * Voice server token
     */
    get token(): string | null {
        return this.#state.token;
    }

    /**
     * Voice server endpoint
     */
    get endpoint(): string | null {
        return this.#state.endpoint;
    }

    /**
     * Node session ID this voice state is connected to
     */
    get nodeSessionId(): string | null {
        return this.#state.node_session_id;
    }

    /**
     * Destroy this voice connection
     * @param reason Optional reason for destruction
     */
    async destroy(reason?: string): Promise<void> {
        return this.player.voices.destroy(this.guildId, reason);
    }

    /**
     * Connect to a voice channel
     * @param channelId Voice channel ID (defaults to current channel)
     */
    async connect(channelId = this.#state.channel_id): Promise<void> {
        await this.player.voices.connect(this.guildId, channelId);
    }

    /**
     * Disconnect from the voice channel
     */
    async disconnect(): Promise<void> {
        return this.player.voices.disconnect(this.guildId);
    }

    /**
     * Change to a different Lavalink node
     * Preserves playback state and filters
     * @param name Name of the node to change to
     */
    async changeNode(name: string): Promise<void> {
        const node = this.player.nodes.get(name);

        if (!node) {
            throw new Error(`Node '${name}' not found`);
        }
        if (!node.ready) {
            throw new Error(`Node '${name}' not ready`);
        }

        if (this.#changePromise !== null) {
            return this.#changePromise;
        }
        if (name === this.#node.name) {
            throw new Error(`Already on node '${name}'`);
        }

        let resolve!: () => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const resolver = { promise, resolve, reject };
        this.#changePromise = resolver.promise;

        // Prepare player update request
        const request: PlayerUpdateRequestBody = {
            voice: {
                channelId: this.#state.channel_id,
                endpoint: this.#state.endpoint,
                sessionId: this.#state.session_id,
                token: this.#state.token,
            },
            filters: this.#player.filters,
            paused: this.#player.paused,
            volume: this.#player.volume,
        };

        const track = this.#player.track;
        const wasPlaying = !this.#player.paused && track !== null;

        // Only transfer track if the new node supports the source
        if (wasPlaying && this.player.nodes.supports("source", track.info.sourceName, node.name)) {
            request.track = { encoded: track.encoded, userData: track.userData };
            request.position = this.#player.state.position;
        }

        // Destroy player on old node
        await this.#node.rest.destroyPlayer(this.guildId).catch(noop);

        const previousNode = this.#node;
        this.#node = node;

        try {
            // Create player on new node
            const player = await node.rest.updatePlayer(this.guildId, request);
            this.#state.node_session_id = node.sessionId ?? "";
            Object.assign(this.#player, player);

            // Emit voice change event
            this.player.emit("voiceChange", this, previousNode, wasPlaying);
            resolver.resolve();
        } catch (err) {
            resolver.reject(err);
            throw err;
        } finally {
            this.#changePromise = null;
        }
    }

    /**
     * String representation of the voice state
     */
    toString(): string {
        return `VoiceState<${this.guildId}>`;
    }
}
