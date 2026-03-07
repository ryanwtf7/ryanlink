import { LookupSymbol, UpdateSymbol } from "../config/symbols";
import { FilterManager } from "./AudioFilters";
import { Track } from "./AudioTrack";
import { Playlist } from "./TrackCollection";
import type { Player } from "../core/RyanlinkPlayer";
import type { VoiceState } from "../voice/VoiceSession";
import type {
    APIPlayer,
    QueueContext,
    RepeatMode,
    SearchResult,
    PlayerUpdateRequestBody,
    PlayerUpdateQueryParams,
    JsonObject,
    Severity,
} from "../types";

/**
 * Represents a music queue for a guild
 * Manages tracks, playback state, and filters
 */
export class Queue<Context extends Record<string, unknown> = QueueContext> {
    #player: APIPlayer;

    #autoplay = false;
    #repeatMode: RepeatMode = "none";

    #tracks: Track[] = [];
    #previousTracks: Track[] = [];

    context = {} as Context;

    readonly voice: VoiceState;
    readonly filters: FilterManager;
    readonly player: Player;

    constructor(player: Player, guildId: string, context?: Context) {
        if (player.queues.has(guildId)) {
            throw new Error("An identical queue already exists");
        }

        const _player = player.queues[LookupSymbol](guildId);
        if (!_player) {
            throw new Error(`No player found for guild '${guildId}'`);
        }

        const voice = player.voices.get(guildId);
        if (!voice) {
            throw new Error(`No connection found for guild '${guildId}'`);
        }

        this.#player = _player;
        if (context !== undefined) {
            this.context = context;
        }

        this.voice = voice;
        this.filters = new FilterManager(player, guildId);
        this.player = player;

        // Make properties immutable
        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            voice: immutable,
            filters: immutable,
            player: { ...immutable, enumerable: false },
        });
    }

    get node() {
        return this.voice.nodeSessionId
            ? this.player.nodes.all.find((n) => n.sessionId === this.voice.nodeSessionId)
            : this.player.nodes.relevant()[0];
    }

    get rest() {
        return this.node?.rest;
    }

    get guildId(): string {
        return this.voice.guildId;
    }

    get volume(): number {
        return this.#player.volume;
    }

    get paused(): boolean {
        return this.#player.paused;
    }

    get stopped(): boolean {
        return this.track !== null && this.#player.track === null;
    }

    get empty(): boolean {
        return this.finished && !this.hasPrevious;
    }

    get playing(): boolean {
        return !this.paused && this.track !== null && this.#player.track !== null;
    }

    get autoplay(): boolean {
        return this.#autoplay;
    }

    get finished(): boolean {
        return this.#tracks.length === 0;
    }

    get destroyed(): boolean {
        return this.player.queues.get(this.guildId) !== this;
    }

    get repeatMode(): RepeatMode {
        return this.#repeatMode;
    }

    get hasNext(): boolean {
        return this.#tracks.length > 1;
    }

    get hasPrevious(): boolean {
        return this.#previousTracks.length !== 0;
    }

    get track(): Track | null {
        return this.#tracks[0] ?? null;
    }

    get previousTrack(): Track | null {
        return this.#previousTracks[this.#previousTracks.length - 1] ?? null;
    }

    get tracks(): Track[] {
        return this.#tracks;
    }

    get previousTracks(): Track[] {
        return this.#previousTracks;
    }

    get length(): number {
        return this.#tracks.length;
    }

    get totalLength(): number {
        return this.length + this.#previousTracks.length;
    }

    get duration(): number {
        return this.#tracks.reduce((time, track) => time + (track.isLive ? 0 : track.duration), 0);
    }

    get formattedDuration(): string {
        return this.#formatDuration(this.duration);
    }

    get currentTime(): number {
        if (this.#player.paused || !this.#player.state.connected) {
            return this.#player.state.position;
        }
        if (this.#player.state.position === 0) {
            return 0;
        }
        return this.#player.state.position + (Date.now() - this.#player.state.time);
    }

    get formattedCurrentTime(): string {
        return this.#formatDuration(this.currentTime);
    }

    #formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
        }
        return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
    }

    #error(data: string | { message?: string; cause?: string; severity?: Severity }): Error {
        const explicit = typeof data === "string";
        const message = explicit ? data : (data.message ?? data.cause ?? "Unknown error");
        const error = new Error(message) as Error & { severity?: Severity };
        error.name = `Error [${this.constructor.name}]`;
        if (!explicit && data.severity) {
            error.severity = data.severity;
        }
        return error;
    }

    async #update(data: PlayerUpdateRequestBody, params?: PlayerUpdateQueryParams): Promise<void> {
        const node = this.node;
        if (!node) {
            throw this.#error("No node available");
        }

        const player = await node.rest.updatePlayer(this.guildId, data, params);
        Object.assign(this.#player, player);
    }

    /**
     * Sync queue state with Lavalink
     * @param target - "local" to pull from Lavalink, "remote" to push to Lavalink
     */
    async sync(target: "local" | "remote" = "local"): Promise<void> {
        const node = this.node;
        if (!node) {
            throw this.#error("No node available");
        }

        if (target === "local") {
            const player = await node.rest.fetchPlayer(this.guildId);
            Object.assign(this.#player, player);
            return;
        }

        if (target !== "remote") {
            throw this.#error("Target must be 'local' or 'remote'");
        }

        const voice = this.player.voices[LookupSymbol](this.guildId);
        if (!voice) {
            return;
        }

        const request: PlayerUpdateRequestBody = {
            voice: {
                token: voice.token,
                endpoint: voice.endpoint,
                sessionId: voice.session_id,
                channelId: voice.channel_id,
            },
            filters: this.#player.filters,
            paused: this.#player.paused,
            volume: this.#player.volume,
        };

        if (this.#player.track !== null) {
            request.track = {
                encoded: this.#player.track.encoded,
                userData: this.#player.track.userData,
            };
            request.position = this.#player.state.position;
        }

        await this.#update(request);
        const nodeSessionId = this.node?.sessionId ?? "";
        this.player.voices[UpdateSymbol](this.guildId, {
            node_session_id: nodeSessionId,
        });
    }

    /**
     * Search for tracks
     */
    async search(query: string, prefix = this.player.options.queryPrefix): Promise<SearchResult> {
        return this.player.search(query, { prefix, node: this.node?.name });
    }

    /**
     * Add tracks to the queue
     */
    add(source: Track | Track[] | Playlist, userData?: JsonObject): this {
        const added: Track[] = [];

        if (source instanceof Track) {
            Object.assign(source.userData, userData);
            this.#tracks.push(source);
            added.push(source);
        } else if (source instanceof Playlist) {
            for (const track of source.tracks) {
                Object.assign(track.userData, userData);
                this.#tracks.push(track);
                added.push(track);
            }
        } else if (Array.isArray(source)) {
            for (const track of source) {
                if (track instanceof Track) {
                    Object.assign(track.userData, userData);
                    this.#tracks.push(track);
                    added.push(track);
                }
            }
        } else {
            throw this.#error("Source must be a track, playlist, or array of tracks");
        }

        this.player.emit("trackAdd", this.player, this.guildId, added);
        return this;
    }

    /**
     * Add related tracks (for autoplay)
     */
    async addRelated(refTrack?: Track): Promise<Track[]> {
        refTrack ??= this.track ?? this.previousTrack ?? undefined;
        if (!refTrack) {
            throw this.#error("The queue is empty and there is no track to refer");
        }

        if (!this.node) {
            return [];
        }
        const relatedTracks = await this.player.options.fetchRelatedTracks?.(this, refTrack);
        this.add(relatedTracks);
        return relatedTracks;
    }

    /**
     * Remove tracks from the queue
     */
    remove(index: number): Track | undefined;
    remove(indices: number[]): Track[];
    remove(input: number | number[]): Track | Track[] | undefined {
        if (typeof input === "number") {
            if (input === 0 && !this.stopped) {
                return;
            }
            if (input < 0) {
                return this.#previousTracks.splice(input, 1)[0];
            }
            return this.#tracks.splice(input, 1)[0];
        }

        if (Array.isArray(input)) {
            if (input.length === 0) {
                return [];
            }
            const tracks: Track[] = [];

            const indices = input.toSorted((a, b) => a - b);
            for (let i = 0; i < indices.length; i++) {
                const index = indices[i] - i;
                if (index === 0 && !this.stopped) {
                    continue;
                }
                if (index < 0) {
                    tracks.push(...this.#previousTracks.splice(index, 1));
                } else if (index < this.#tracks.length) {
                    tracks.push(...this.#tracks.splice(index, 1));
                }
            }
            return tracks;
        }

        throw this.#error("Input must be an index or array of indices");
    }

    /**
     * Clear tracks from the queue
     */
    clear(type?: "current" | "previous"): void {
        switch (type) {
            case "current":
                if (!this.finished) {
                    this.#tracks.length = this.stopped ? 0 : 1;
                }
                break;
            case "previous":
                this.#previousTracks.length = 0;
                break;
            default:
                if (!this.finished) {
                    this.#tracks.length = this.stopped ? 0 : 1;
                }
                this.#previousTracks.length = 0;
        }
    }

    /**
     * Jump to a specific track
     */
    async jump(index: number): Promise<Track> {
        if (this.empty) {
            throw this.#error("The queue is empty at the moment");
        }
        if (!Number.isInteger(index)) {
            throw this.#error("Index must be an integer");
        }

        const track = index < 0 ? this.#previousTracks[this.#previousTracks.length + index] : this.#tracks[index];

        if (!track) {
            throw this.#error("Specified index is out of range");
        }

        if (index < 0) {
            this.#tracks.unshift(...this.#previousTracks.splice(index));
        } else {
            this.#previousTracks.push(...this.#tracks.splice(0, index));
        }

        await this.#update({
            paused: false,
            track: { encoded: track.encoded, userData: track.userData },
        });

        return track;
    }

    /**
     * Pause playback
     */
    async pause(): Promise<boolean> {
        await this.#update({ paused: true });
        return this.#player.paused;
    }

    /**
     * Resume playback
     */
    async resume(): Promise<boolean> {
        if (this.stopped) {
            await this.jump(0);
        } else {
            await this.#update({ paused: false });
        }
        return !this.#player.paused;
    }

    /**
     * Seek to a position
     */
    async seek(ms: number): Promise<number> {
        if (this.track === null) {
            throw this.#error("No track is playing at the moment");
        }
        if (!this.track.isSeekable) {
            throw this.#error("Current track is not seekable");
        }
        if (!Number.isInteger(ms) || ms < 0) {
            throw this.#error("Seek time must be a positive integer");
        }
        if (ms > this.track.duration) {
            throw this.#error("Specified time to seek is out of range");
        }

        const body: PlayerUpdateRequestBody = { paused: false, position: ms };

        if (this.#player.track?.info.identifier !== this.track.id) {
            body.track = { encoded: this.track.encoded, userData: this.track.userData };
        }

        await this.#update(body);
        return this.#player.state.position;
    }

    /**
     * Play next track
     */
    async next(): Promise<Track | null> {
        if (this.hasNext) {
            return this.jump(1);
        }

        if (this.hasPrevious && this.#repeatMode === "queue") {
            const track = this.#previousTracks.shift();
            if (track) {
                this.#tracks.push(track);
            }
            return this.jump(this.hasNext ? 1 : 0);
        }

        if (!this.empty && this.#autoplay) {
            const related = await this.addRelated();
            if (related.length > 0) {
                return this.jump(this.length - related.length);
            }
        }

        if (!this.finished) {
            const track = this.#tracks.shift();
            if (track) {
                this.#previousTracks.push(track);
            }
            await this.stop();
        }

        return null;
    }

    /**
     * Play previous track
     */
    async previous(): Promise<Track | null> {
        if (this.hasPrevious) {
            return this.jump(-1);
        }
        return null;
    }

    /**
     * Shuffle tracks
     */
    shuffle(includePrevious = false): this {
        if (includePrevious === true) {
            this.#tracks.push(...this.#previousTracks.splice(0));
        }

        if (this.#tracks.length < 3) {
            return this;
        }

        for (let i = this.#tracks.length - 1; i > 1; --i) {
            const j = Math.floor(Math.random() * i) + 1;
            [this.#tracks[i], this.#tracks[j]] = [this.#tracks[j], this.#tracks[i]];
        }

        return this;
    }

    /**
     * Set volume
     */
    async setVolume(volume: number): Promise<number> {
        if (!Number.isInteger(volume) || volume < 0) {
            throw this.#error("Volume must be a positive integer");
        }
        if (volume > 1000) {
            throw this.#error("Volume cannot be more than 1000");
        }

        await this.#update({ volume });
        return this.#player.volume;
    }

    /**
     * Set autoplay
     */
    setAutoplay(autoplay = false): boolean {
        if (typeof autoplay !== "boolean") {
            throw this.#error("Autoplay must be a boolean value");
        }
        this.#autoplay = autoplay;
        return this.#autoplay;
    }

    /**
     * Set repeat mode
     */
    setRepeatMode(repeatMode: RepeatMode = "none"): RepeatMode {
        if (repeatMode !== "track" && repeatMode !== "queue" && repeatMode !== "none") {
            throw this.#error("Repeat mode can only be set to track, queue, or none");
        }
        this.#repeatMode = repeatMode;
        return this.#repeatMode;
    }

    /**
     * Stop playback
     */
    async stop(): Promise<void> {
        return this.#update({ track: { encoded: null } });
    }

    /**
     * Destroy the queue
     */
    async destroy(reason?: string): Promise<void> {
        return this.player.queues.destroy(this.guildId, reason);
    }

    /**
     * Move a track from one position to another
     * @param from - Current position of the track
     * @param to - New position for the track
     */
    move(from: number, to: number): Track | null {
        if (from < 0 || from >= this.#tracks.length || to < 0 || to >= this.#tracks.length || from === to) {
            return null;
        }

        const track = this.#tracks[from];
        if (!track) {
            return null;
        }

        this.#tracks.splice(from, 1);
        this.#tracks.splice(to, 0, track);

        return track;
    }

    /**
     * Splice tracks - remove and/or add tracks at a specific position
     * @param index - Position to start
     * @param amount - Number of tracks to remove
     * @param tracks - Tracks to add at the position
     */
    splice(index: number, amount: number, tracks?: Track | Track[]): Track[] {
        if (!this.#tracks.length && tracks) {
            void this.add(tracks);
            return [];
        }

        const removed = tracks
            ? this.#tracks.splice(index, amount, ...(Array.isArray(tracks) ? tracks : [tracks]))
            : this.#tracks.splice(index, amount);

        return removed;
    }

    /**
     * Sort tracks by a property or custom function
     * @param sortBy - Property name or comparator function
     * @param order - Sort order (asc/desc)
     */
    sortBy(
        sortBy: "duration" | "title" | "author" | ((a: Track, b: Track) => number),
        order: "asc" | "desc" = "asc",
    ): this {
        if (typeof sortBy === "function") {
            this.#tracks.sort(sortBy);
        } else {
            this.#tracks.sort((a, b) => {
                let comparison = 0;

                switch (sortBy) {
                    case "duration":
                        comparison = a.duration - b.duration;
                        break;
                    case "title":
                        comparison = a.info.title.localeCompare(b.info.title);
                        break;
                    case "author":
                        comparison = a.info.author.localeCompare(b.info.author);
                        break;
                    default:
                        return 0;
                }

                return order === "desc" ? -comparison : comparison;
            });
        }

        return this;
    }

    /**
     * Get a sorted copy without modifying the original queue
     */
    toSortedBy(
        sortBy: "duration" | "title" | "author" | ((a: Track, b: Track) => number),
        order: "asc" | "desc" = "asc",
    ): Track[] {
        const copy = [...this.#tracks];

        if (typeof sortBy === "function") {
            return copy.sort(sortBy);
        }

        return copy.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "duration":
                    comparison = a.duration - b.duration;
                    break;
                case "title":
                    comparison = a.info.title.localeCompare(b.info.title);
                    break;
                case "author":
                    comparison = a.info.author.localeCompare(b.info.author);
                    break;
                default:
                    return 0;
            }

            return order === "desc" ? -comparison : comparison;
        });
    }

    /**
     * Filter tracks by predicate or criteria
     */
    filterTracks(
        predicate:
            | ((track: Track, index: number) => boolean)
            | {
                  title?: string;
                  author?: string;
                  duration?: number | { min?: number; max?: number };
                  uri?: string;
                  identifier?: string;
                  sourceName?: string;
                  isStream?: boolean;
                  isSeekable?: boolean;
              },
    ): Array<{ track: Track; index: number }> {
        if (typeof predicate === "function") {
            return this.#tracks
                .map((track, index) => ({ track, index }))
                .filter(({ track, index }) => predicate(track, index));
        }

        return this.#tracks
            .map((track, index) => ({ track, index }))
            .filter(({ track }) => {
                if (predicate.title && !track.info.title.toLowerCase().includes(predicate.title.toLowerCase())) {
                    return false;
                }
                if (predicate.author && !track.info.author.toLowerCase().includes(predicate.author.toLowerCase())) {
                    return false;
                }
                if (predicate.duration) {
                    if (typeof predicate.duration === "number") {
                        if (track.duration !== predicate.duration) {
                            return false;
                        }
                    } else {
                        if (predicate.duration.min && track.duration < predicate.duration.min) {
                            return false;
                        }
                        if (predicate.duration.max && track.duration > predicate.duration.max) {
                            return false;
                        }
                    }
                }
                if (predicate.uri && track.info.uri !== predicate.uri) {
                    return false;
                }
                if (predicate.identifier && track.info.identifier !== predicate.identifier) {
                    return false;
                }
                if (predicate.sourceName && track.info.sourceName !== predicate.sourceName) {
                    return false;
                }
                if (predicate.isStream !== undefined && track.isLive !== predicate.isStream) {
                    return false;
                }
                if (predicate.isSeekable !== undefined && track.isSeekable !== predicate.isSeekable) {
                    return false;
                }

                return true;
            });
    }

    /**
     * Find a track by predicate or criteria
     */
    findTrack(
        predicate:
            | ((track: Track, index: number) => boolean)
            | {
                  title?: string;
                  author?: string;
                  duration?: number | { min?: number; max?: number };
                  uri?: string;
                  identifier?: string;
                  sourceName?: string;
                  isStream?: boolean;
                  isSeekable?: boolean;
              },
    ): { track: Track; index: number } | null {
        const results = this.filterTracks(predicate);
        return results[0] ?? null;
    }

    /**
     * Get a range of tracks
     */
    getTracks(start: number, end?: number): Track[] {
        return this.#tracks.slice(start, end);
    }

    /**
     * Shift from previous tracks
     */
    shiftPrevious(): Track | null {
        return this.#previousTracks.shift() ?? null;
    }
}
