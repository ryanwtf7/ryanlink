import { EventEmitter } from "node:events";
import { Queue } from "../audio/AudioQueue";
import { Track } from "./AudioTrack";
import {
    LookupSymbol,
    OnStateUpdateSymbol,
    OnEventUpdateSymbol,
    OnPingUpdateSymbol,
    OnVoiceCloseSymbol,
} from "../config/symbols";
import { noop } from "../utils";
import { EventType, TrackEndReason } from "../types/api/Websocket";
import type { Player } from "../core/RyanlinkPlayer";
import type {
    CreateQueueOptions,
    QueueContext,
    APIPlayer,
    PlayerState,
    EventPayload,
    TrackStartEventPayload,
    TrackEndEventPayload,
    TrackExceptionEventPayload,
    TrackStuckEventPayload,
    WebSocketClosedEventPayload,
} from "../types";

/**
 * Manages all queues across guilds
 * Handles queue creation, destruction, synchronization, and event forwarding
 */
export class QueueManager<Context extends Record<string, unknown> = QueueContext> extends EventEmitter {
    #player: Player;
    #queues = new Map<string, Queue<Context>>();
    #players = new Map<string, APIPlayer>();

    constructor(player: Player) {
        super({ captureRejections: false });
        this.#player = player;
    }

    get(guildId: string): Queue<Context> | undefined {
        return this.#queues.get(guildId);
    }

    has(guildId: string): boolean {
        return this.#queues.has(guildId);
    }

    get all(): Queue<Context>[] {
        return Array.from(this.#queues.values());
    }

    get size(): number {
        return this.#queues.size;
    }

    keys(): IterableIterator<string> {
        return this.#queues.keys();
    }

    values(): IterableIterator<Queue<Context>> {
        return this.#queues.values();
    }

    entries(): IterableIterator<[string, Queue<Context>]> {
        return this.#queues.entries();
    }

    async create(options: CreateQueueOptions<Context>): Promise<Queue<Context>> {
        if (this.#queues.has(options.guildId)) {
            throw new Error(`Queue already exists for guild '${options.guildId}'`);
        }

        let voice = this.#player.voices.get(options.guildId);
        if (!voice) {
            voice = await this.#player.voices.connect(options.guildId, options.voiceId, {
                node: options.node,
                context: options.context,
                filters: options.filters,
                volume: options.volume,
            });
        }

        const playerState: APIPlayer = {
            guildId: options.guildId,
            track: null,
            volume: options.volume ?? 100,
            paused: false,
            state: {
                time: Date.now(),
                position: 0,
                connected: false,
                ping: -1,
            },
            voice: {
                token: "",
                endpoint: "",
                sessionId: "",
                channelId: options.voiceId,
            },
            filters: options.filters ?? {},
        };

        this.#players.set(options.guildId, playerState);

        const queue = new Queue(this.#player, options.guildId, options.context);
        this.#queues.set(options.guildId, queue);

        this.#player.emit("queueCreate", queue);

        return queue;
    }

    async destroy(guildId: string, reason = "destroyed"): Promise<void> {
        const queue = this.#queues.get(guildId);
        if (!queue) {
            return;
        }

        const voice = this.#player.voices.get(guildId);
        if (voice?.node) {
            await voice.node.rest.destroyPlayer(guildId).catch(noop);
        }

        await this.#player.voices.destroy(guildId, reason);

        this.#queues.delete(guildId);
        this.#players.delete(guildId);

        this.#player.emit("queueDestroy", queue, reason);
    }

    async relocate(guildId: string, nodeName: string): Promise<void> {
        const queue = this.#queues.get(guildId);
        if (!queue) {
            throw new Error(`No queue found for guild '${guildId}'`);
        }

        const voice = this.#player.voices.get(guildId);
        if (!voice) {
            throw new Error(`No voice connection found for guild '${guildId}'`);
        }

        await voice.changeNode(nodeName);
    }

    async syncAll(): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const queue of this.#queues.values()) {
            promises.push(queue.sync("remote").catch(noop));
        }

        await Promise.all(promises);
    }

    [LookupSymbol](guildId: string): APIPlayer | undefined {
        return this.#players.get(guildId);
    }

    [OnStateUpdateSymbol](guildId: string, state: PlayerState): void {
        const player = this.#players.get(guildId);
        if (!player) {
            return;
        }

        player.state = state;

        const queue = this.#queues.get(guildId);
        if (queue) {
            this.#player.emit("queueUpdate", queue, state);
        }

        const voice = this.#player.voices.get(guildId);
        if (voice?.regionId) {
            const region = this.#player.voices.regions.get(voice.regionId);
            if (region) {
                (region as unknown as { [OnPingUpdateSymbol]?(nodeName: string, state: PlayerState): void })[
                    OnPingUpdateSymbol
                ]?.(voice.node.name, state);
            }
        }
    }

    [OnEventUpdateSymbol](guildId: string, event: EventPayload): void {
        const queue = this.#queues.get(guildId);
        if (!queue) {
            return;
        }

        switch (event.type) {
            case EventType.TrackStart:
                this.#handleTrackStart(queue, event);
                break;
            case EventType.TrackEnd:
                void this.#handleTrackEnd(queue, event);
                break;
            case EventType.TrackException:
                this.#handleTrackException(queue, event);
                break;
            case EventType.TrackStuck:
                this.#handleTrackStuck(queue, event);
                break;
            case EventType.WebSocketClosed:
                this.#handleWebSocketClosed(queue, event);
                break;
        }
    }

    #handleTrackStart(queue: Queue<Context>, event: TrackStartEventPayload): void {
        const track = new Track(event.track);
        this.#player.emit("trackStart", queue, track);
    }

    async #handleTrackEnd(queue: Queue<Context>, event: TrackEndEventPayload): Promise<void> {
        const track = new Track(event.track);
        const reason = event.reason;

        this.#player.emit("trackFinish", queue, track, reason);

        const shouldAdvance = reason === TrackEndReason.Finished || reason === TrackEndReason.LoadFailed;

        if (shouldAdvance) {
            const nextTrack = await queue.next().catch(noop);

            if (!nextTrack && queue.finished) {
                this.#player.emit("queueFinish", queue);
            }
        }
    }

    #handleTrackException(queue: Queue<Context>, event: TrackExceptionEventPayload): void {
        const track = new Track(event.track);
        this.#player.emit("trackError", queue, track, event.exception);
    }

    #handleTrackStuck(queue: Queue<Context>, event: TrackStuckEventPayload): void {
        const track = new Track(event.track);
        this.#player.emit("trackStuck", queue, track, event.thresholdMs);
    }

    #handleWebSocketClosed(queue: Queue<Context>, event: WebSocketClosedEventPayload): void {
        const voice = this.#player.voices.get(queue.guildId);
        if (voice) {
            (
                this.#player.voices as unknown as {
                    [OnVoiceCloseSymbol]?(guildId: string, code: number, reason: string, byRemote: boolean): void;
                }
            )[OnVoiceCloseSymbol]?.(queue.guildId, event.code, event.reason, event.byRemote);
        }
    }
}
