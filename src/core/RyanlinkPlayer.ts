import { EventEmitter } from "node:events";
import { LoadType, type APITrack } from "../types/api/Rest";
import { DefaultPlayerOptions } from "../config";
import { isString } from "../utils";
import { NodeManager } from "../lavalink/ConnectionPool";
import { VoiceManager } from "../voice/VoiceConnection";
import { Playlist, Queue, QueueManager, Track } from "../audio";
import { PlayerPlugin } from "./PluginSystem";
import type {
    CreateQueueOptions,
    PlayerEventMap,
    PlayerOptions,
    PlayOptions,
    PluginRecord,
    RepeatMode,
    SearchOptions,
    SearchResult,
    CreateNodeOptions,
    PlayerInstanceOptions,
    QueueContext,
    PluginEventMap,
    MergeUnionType,
} from "../types";

/**
 * Constrain event map to ensure all values are arrays
 */
type ConstrainEventMap<T> = {
    [K in keyof T]: T[K] extends unknown[] ? T[K] : never;
};

/**
 * Main Player class - entry point for Ryanlink
 * Manages nodes, voices, queues, and plugins
 */
export class Player<
    Context extends Record<string, unknown> = QueueContext,
    Plugins extends PlayerPlugin[] = [],
> extends EventEmitter<ConstrainEventMap<PlayerEventMap & MergeUnionType<PluginEventMap<Plugins[number]>>>> {
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    #clientId: string | null = null;
    #nodes: CreateNodeOptions[] | null = null;

    readonly options: PlayerInstanceOptions;
    readonly plugins: PluginRecord<Plugins>;

    readonly nodes: NodeManager;
    readonly voices: VoiceManager;
    readonly queues: QueueManager<Context>;

    constructor(options: PlayerOptions<Plugins>) {
        super({ captureRejections: false });

        const _options = { ...DefaultPlayerOptions, ...options };

        if (_options.nodes.length === 0) {
            throw new Error("Missing node create options");
        }
        if (typeof _options.forwardVoiceUpdate !== "function") {
            throw new Error("Missing voice update function");
        }

        this.#nodes = _options.nodes;
        delete (_options as Partial<typeof _options>).nodes;

        this.options = _options;
        this.plugins = {} as PluginRecord<Plugins>;

        if (_options.plugins !== undefined) {
            for (const plugin of _options.plugins) {
                if (!(plugin instanceof PlayerPlugin)) {
                    throw new Error("Invalid plugin(s)");
                }
                (this.plugins as { [x: string]: PlayerPlugin })[plugin.name] = plugin;
            }
            delete _options.plugins;
        }

        this.nodes = new NodeManager(this as unknown as Player);
        this.voices = new VoiceManager(this as unknown as Player);
        this.queues = new QueueManager(this as unknown as Player);

        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            options: immutable,
            plugins: immutable,
            nodes: immutable,
            voices: immutable,
            queues: immutable,
        } satisfies { [k in keyof Player]?: PropertyDescriptor });
    }

    /**
     * Whether the player is initialized and ready
     */
    get ready(): boolean {
        return this.#initialized;
    }

    /**
     * The bot's client ID
     */
    get clientId(): string | null {
        return this.#clientId;
    }

    /**
     * Initialize the player
     * @param clientId Bot client ID
     */
    async init(clientId: string): Promise<void> {
        if (this.#initialized) {
            return;
        }

        if (this.#initPromise !== null) {
            return this.#initPromise;
        }

        let resolve!: (value: void | PromiseLike<void>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        this.#initPromise = promise;
        this.#clientId = clientId;

        try {
            const nodes = this.#nodes ?? [];
            for (const node of nodes) {
                this.nodes.create({ ...node, clientId });
            }

            // Initialize all plugins
            for (const name in this.plugins) {
                (this.plugins as Record<string, PlayerPlugin>)[name].init(this as unknown as Player);
            }

            // Connect to all nodes
            await this.nodes.connect();

            this.#initialized = true;
            this.#nodes = null;
            (this as EventEmitter).emit("init");
            resolve();
        } catch (err) {
            reject(err);
            throw err;
        } finally {
            this.#initPromise = null;
        }
    }

    /**
     * Returns the queue of a guild
     * @param guildId Id of the guild
     */
    getQueue(guildId: string): Queue<Context> | undefined {
        return this.queues.get(guildId);
    }

    /**
     * Creates a queue from options
     * @param options Options to create from
     */
    async createQueue(options: CreateQueueOptions<Context>): Promise<Queue<Context>> {
        return this.queues.create(options);
    }

    /**
     * Destroys the queue of a guild
     * @param guildId Id of the guild
     * @param reason Reason for destroying
     */
    async destroyQueue(guildId: string, reason?: string): Promise<void> {
        return this.queues.destroy(guildId, reason);
    }

    /**
     * Searches for results based on query and options
     * @param query Query (or URL as well)
     * @param options Options for customization
     */
    async search(query: string, options?: SearchOptions): Promise<SearchResult> {
        if (!isString(query, "non-empty")) {
            throw new Error("Query must be a non-empty string");
        }

        const node = options?.node !== undefined ? this.nodes.get(options.node) : this.nodes.relevant()[0];
        if (!node) {
            if (options?.node === undefined) {
                throw new Error("No nodes available");
            }
            throw new Error(`Node '${options.node}' not found`);
        }

        const prefix = options?.prefix ?? this.options.queryPrefix;
        query = isString(query, "url") ? query : `${String(prefix)}:${String(query)} `;
        const result = await node.rest.loadTracks(query);

        switch (result.loadType) {
            case LoadType.Empty:
                return { type: "empty", data: [] };
            case LoadType.Error:
                return { type: "error", data: result.data };
            case LoadType.Playlist:
                return { type: "playlist", data: new Playlist(result.data) };
            case LoadType.Search:
                return { type: "query", data: result.data.map((t: APITrack) => new Track(t)) };
            case LoadType.Track:
                return { type: "track", data: new Track(result.data) };
            default:
                throw new Error(`Unexpected load result type from node '${node.name}'`);
        }
    }

    /**
     * Adds or searches if source is query and resumes the queue if stopped
     * @param source Source to play from
     * @param options Options for customization
     */
    async play(source: string | Parameters<Queue["add"]>[0], options: PlayOptions<Context>): Promise<Queue<Context>> {
        let queue = this.queues.get(options.guildId);

        if (typeof source === "string") {
            let result: SearchResult;
            if (!queue) {
                result = await this.search(source, options);
            } else {
                result = await queue.search(source, options.prefix);
            }

            if (result.type === "empty") {
                throw new Error(`No results found for '${source}'`);
            }
            if (result.type === "error") {
                throw new Error(result.data.message ?? result.data.cause, { cause: result.data });
            }

            source = result.type === "query" ? result.data[0] : result.data;
        }

        queue ??= await this.queues.create(options);

        if (options.context !== undefined) {
            Object.assign(queue.context, options.context);
        }

        queue.add(source, options.userData);

        if (queue.stopped) {
            await queue.resume();
        }

        return queue;
    }

    /**
     * Jumps to the specified index in queue of a guild
     * @param guildId Id of the guild
     * @param index Index to jump to
     */
    async jump(guildId: string, index: number): Promise<Track> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.jump(index);
    }

    /**
     * Pauses the queue of a guild
     * @param guildId Id of the guild
     */
    async pause(guildId: string): Promise<boolean> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.pause();
    }

    /**
     * Plays the previous track in queue of a guild
     * @param guildId Id of the guild
     */
    async previous(guildId: string): Promise<Track | null> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.previous();
    }

    /**
     * Resumes the queue of a guild
     * @param guildId Id of the guild
     */
    async resume(guildId: string): Promise<boolean> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.resume();
    }

    /**
     * Seeks to a position in the current track of a guild
     * @param guildId Id of the guild
     * @param ms Position in milliseconds
     */
    async seek(guildId: string, ms: number): Promise<number> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.seek(ms);
    }

    /**
     * Enables or disables autoplay for the queue of a guild
     * @param guildId Id of the guild
     * @param autoplay Whether to enable autoplay
     */
    setAutoplay(guildId: string, autoplay?: boolean): boolean {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.setAutoplay(autoplay);
    }

    /**
     * Sets the repeat mode for the queue of a guild
     * @param guildId Id of the guild
     * @param repeatMode The repeat mode
     */
    setRepeatMode(guildId: string, repeatMode: RepeatMode): RepeatMode {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.setRepeatMode(repeatMode);
    }

    /**
     * Sets the volume of the queue of a guild
     * @param guildId Id of the guild
     * @param volume The volume to set
     */
    async setVolume(guildId: string, volume: number): Promise<number> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.setVolume(volume);
    }

    /**
     * Shuffles tracks for the queue of a guild
     * @param guildId Id of the guild
     * @param includePrevious Whether to pull previous tracks to current
     */
    shuffle(guildId: string, includePrevious?: boolean): Queue<Context> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.shuffle(includePrevious);
    }

    /**
     * Plays the next track in queue of a guild
     * @param guildId Id of the guild
     */
    async next(guildId: string): Promise<Track | null> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.next();
    }

    /**
     * Stops the queue of a guild
     * @param guildId Id of the guild
     */
    async stop(guildId: string): Promise<void> {
        const queue = this.queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }
        return queue.stop();
    }
}
