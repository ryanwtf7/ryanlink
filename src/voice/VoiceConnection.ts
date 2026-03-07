import { setTimeout } from "node:timers/promises";
import { SnowflakeRegex, VoiceRegionIdRegex } from "../config";
import { LookupSymbol, OnVoiceCloseSymbol, UpdateSymbol } from "../config/symbols";
import { isString, noop } from "../utils";
import { VoiceRegion } from "./RegionSelector";
import { VoiceState } from "./VoiceSession";
import {
    VoiceCloseCodes,
    type BotReadyPayload,
    type BotVoiceState,
    type ConnectOptions,
    type CreateQueueOptions,
    type DiscordDispatchPayload,
    type VoiceServerUpdatePayload,
    type VoiceStateUpdatePayload,
} from "../types";
import type { Player } from "../core/RyanlinkPlayer";

/**
 * Join request with promise resolvers
 */
interface JoinRequest extends Pick<CreateQueueOptions, "context" | "node" | "voiceId"> {
    promise: Promise<VoiceState>;
    resolve: (value: VoiceState | PromiseLike<VoiceState>) => void;
    reject: (reason?: unknown) => void;
    config?: Pick<CreateQueueOptions, "filters" | "volume">;
}

/**
 * Manages voice connections for all guilds
 * Handles Discord voice events and Lavalink voice state
 */
export class VoiceManager implements Partial<Map<string, VoiceState>> {
    #cache = new Map<string, BotVoiceState>();
    #voices = new Map<string, VoiceState>();

    #joins = new Map<string, JoinRequest>();
    #destroys = new Map<string, Promise<void>>();

    readonly regions = new Map<string, VoiceRegion>();
    readonly player: Player;

    constructor(player: Player) {
        if (player.voices === undefined) {
            this.player = player;
        } else {
            throw new Error("Manager already exists for this Player");
        }

        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            regions: immutable,
            player: { ...immutable, enumerable: false },
        } as PropertyDescriptorMap);
    }

    /**
     * Number of voice connections
     */
    get size(): number {
        return this.#voices.size;
    }

    /**
     * Get voice state for a guild
     */
    get(guildId: string): VoiceState | undefined {
        return this.#voices.get(guildId);
    }

    /**
     * Check if voice state exists
     */
    has(guildId: string): boolean {
        return this.#voices.has(guildId);
    }

    /**
     * Get all connected guild IDs
     */
    keys() {
        return this.#voices.keys();
    }

    /**
     * Get all voice connections
     */
    values() {
        return this.#voices.values();
    }

    /**
     * Get all voice connections as entries
     */
    entries() {
        return this.#voices.entries();
    }

    /**
     * Destroy a voice connection
     * @param guildId Guild ID
     * @param reason Reason for destruction
     */
    async destroy(guildId: string, reason = "destroyed"): Promise<void> {
        if (this.player.queues.has(guildId)) {
            return this.player.queues.destroy(guildId, reason);
        }
        if (this.#destroys.has(guildId)) {
            return this.#destroys.get(guildId) ?? Promise.resolve();
        }

        const voice = this.#voices.get(guildId);
        if (!voice) {
            return;
        }

        let resolve!: () => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const resolver = { promise, resolve, reject };
        this.#destroys.set(guildId, resolver.promise);

        if (this[LookupSymbol](guildId)?.connected) {
            await voice.disconnect().catch(noop);
        }

        this.#cache.delete(guildId);
        this.#voices.delete(guildId);

        this.player.emit("voiceDestroy", voice, reason);

        resolver.resolve();
        this.#destroys.delete(guildId);
    }

    /**
     * Connect to a voice channel
     * @param guildId Guild ID
     * @param voiceId Voice channel ID
     * @param options Connection options
     */
    async connect(guildId: string, voiceId: string, options?: ConnectOptions): Promise<VoiceState> {
        if (!isString(guildId, SnowflakeRegex)) {
            throw new Error("Guild Id is not a valid Discord Id");
        }
        if (!isString(voiceId, SnowflakeRegex)) {
            throw new Error("Voice Id is not a valid Discord Id");
        }

        const currentRequest = this.#joins.get(guildId);
        if (currentRequest) {
            if (currentRequest.voiceId === voiceId) {
                return currentRequest.promise;
            }
            currentRequest.reject(new Error("Connection request was replaced"));
        }

        const state = this.#cache.get(guildId);
        if (state?.connected && state.channel_id === voiceId) {
            const voice = this.player.queues.get(guildId)?.voice;
            if (voice && voice.connected) {
                return voice;
            }
        }

        this.#joins.delete(guildId);

        let resolve!: (value: VoiceState | PromiseLike<VoiceState>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<VoiceState>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const request: JoinRequest = {
            promise,
            resolve,
            reject,
            voiceId,
            node: options?.node,
            context: options?.context,
            config: options ? { filters: options.filters, volume: options.volume } : undefined,
        };

        this.#joins.set(guildId, request);

        // Send voice state update to Discord
        await this.player.options.forwardVoiceUpdate(guildId, {
            op: 4,
            d: {
                guild_id: guildId,
                channel_id: voiceId,
                self_deaf: false,
                self_mute: false,
            },
        });

        // Wait for voice connection with timeout
        const timeout = setTimeout(15_000, undefined, { ref: false });
        const result = await Promise.race([request.promise, timeout]);

        if (result === undefined) {
            this.#joins.delete(guildId);
            throw new Error("Voice connection timed out");
        }

        return result;
    }

    /**
     * Disconnect from voice channel
     * @param guildId Guild ID
     */
    async disconnect(guildId: string): Promise<void> {
        const state = this.#cache.get(guildId);
        if (!state) {
            return;
        }

        await this.player.options.forwardVoiceUpdate(guildId, {
            op: 4,
            d: {
                guild_id: guildId,
                channel_id: null,
                self_deaf: false,
                self_mute: false,
            },
        });

        state.channel_id = "";
        state.connected = false;
    }

    /**
     * Handle Discord dispatch events
     * @param payload Discord gateway payload
     */
    handleDispatch(payload: DiscordDispatchPayload): void {
        if (payload.t === "READY") {
            this.#handleReady(payload);
        } else if (payload.t === "VOICE_STATE_UPDATE") {
            this.#handleVoiceStateUpdate(payload);
        } else if (payload.t === "VOICE_SERVER_UPDATE") {
            this.#handleVoiceServerUpdate(payload);
        }
    }

    /**
     * Internal lookup for voice state
     * @internal
     */
    [LookupSymbol](guildId: string): BotVoiceState | undefined {
        return this.#cache.get(guildId);
    }

    /**
     * Internal update for voice state
     * @internal
     */
    [UpdateSymbol](guildId: string, partial: Partial<BotVoiceState>): void {
        const state = this.#cache.get(guildId);
        if (state) {
            Object.assign(state, partial);
        }
    }

    /**
     * Internal voice close handler
     * @internal
     */
    [OnVoiceCloseSymbol](guildId: string, code: number, reason: string, byRemote: boolean): void {
        const voice = this.#voices.get(guildId);
        if (!voice) {
            return;
        }

        this.player.emit("voiceClose", voice, code, reason, byRemote);

        // Check if we should destroy the connection
        const shouldDestroy =
            (code as VoiceCloseCodes) === VoiceCloseCodes.Disconnected ||
            (code as VoiceCloseCodes) === VoiceCloseCodes.DisconnectedRateLimited ||
            (code as VoiceCloseCodes) === VoiceCloseCodes.DisconnectedCallTerminated;

        if (shouldDestroy) {
            this.destroy(guildId, `Voice closed: ${reason} (${code})`).catch(noop);
        }
    }

    /**
     * Handle READY event
     */
    #handleReady(_payload: BotReadyPayload): void {
        // Clear all voice states on ready
        this.#cache.clear();
        this.#voices.clear();
        this.#joins.clear();
    }

    /**
     * Handle VOICE_STATE_UPDATE event
     */
    #handleVoiceStateUpdate(payload: VoiceStateUpdatePayload): void {
        const { d: data } = payload;
        const guildId = data.guild_id;

        if (!guildId || data.user_id !== this.player.clientId) {
            return;
        }

        let state = this.#cache.get(guildId);

        // User left voice channel
        if (data.channel_id === null) {
            if (state) {
                state.channel_id = "";
                state.connected = false;
            }
            return;
        }

        // Create or update state
        if (!state) {
            state = {
                channel_id: data.channel_id,
                session_id: data.session_id,
                deaf: data.deaf,
                mute: data.mute,
                self_deaf: data.self_deaf,
                self_mute: data.self_mute,
                suppress: data.suppress,
                token: "",
                endpoint: "",
                connected: false,
                node_session_id: "",
                reconnecting: false,
                region_id: "",
            };
            this.#cache.set(guildId, state);
        } else {
            state.channel_id = data.channel_id;
            state.session_id = data.session_id;
            state.deaf = data.deaf;
            state.mute = data.mute;
            state.self_deaf = data.self_deaf;
            state.self_mute = data.self_mute;
            state.suppress = data.suppress;
        }

        void this.#tryConnect(guildId);
    }

    /**
     * Handle VOICE_SERVER_UPDATE event
     */
    #handleVoiceServerUpdate(payload: VoiceServerUpdatePayload): void {
        const { d: data } = payload;
        const guildId = data.guild_id;

        let state = this.#cache.get(guildId);

        if (!state) {
            state = {
                channel_id: "",
                session_id: "",
                deaf: false,
                mute: false,
                self_deaf: false,
                self_mute: false,
                suppress: false,
                token: data.token,
                endpoint: data.endpoint ?? "",
                connected: false,
                node_session_id: "",
                reconnecting: false,
                region_id: "",
            };
            this.#cache.set(guildId, state);
        } else {
            state.token = data.token;
            state.endpoint = data.endpoint ?? "";
        }

        // Extract region from endpoint
        if (state.endpoint) {
            const match = state.endpoint.match(VoiceRegionIdRegex);
            if (match?.[1]) {
                state.region_id = match[1];

                // Create or get voice region
                if (!this.regions.has(state.region_id)) {
                    this.regions.set(state.region_id, new VoiceRegion(this.player, state.region_id));
                }
            }
        }

        void this.#tryConnect(guildId);
    }

    /**
     * Try to establish voice connection
     */
    async #tryConnect(guildId: string): Promise<void> {
        const state = this.#cache.get(guildId);
        const request = this.#joins.get(guildId);

        if (!state || !request) {
            return;
        }

        if (!state.channel_id || !state.session_id || !state.token || !state.endpoint) {
            return;
        }

        this.#joins.delete(guildId);

        try {
            const nodeName =
                request.node ??
                (state.region_id && this.regions.get(state.region_id)?.getRelevantNode()?.name) ??
                this.player.nodes.relevant()[0]?.name;

            if (!nodeName) {
                throw new Error("No nodes available");
            }

            let queue = this.player.queues.get(guildId);
            if (!queue) {
                queue = await this.player.queues.create({
                    guildId,
                    voiceId: state.channel_id,
                    node: nodeName,
                    context: request.context,
                    ...request.config,
                });
            }

            const voice = new VoiceState(this.player, nodeName, guildId);
            this.#voices.set(guildId, voice);

            state.connected = true;
            state.node_session_id = voice.node.sessionId ?? "";

            await queue.sync("remote").catch(noop);

            this.player.emit("voiceConnect", voice);
            request.resolve(voice);
        } catch (error) {
            request.reject(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
