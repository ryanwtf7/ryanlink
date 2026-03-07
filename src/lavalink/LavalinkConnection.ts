import { EventEmitter, once } from "node:events";
import { Buffer } from "node:buffer";
import { clearTimeout, setTimeout } from "node:timers";
import { WebSocket, type ClientOptions } from "ws";
import { REST } from "./HttpClient";
import { CLIENT_NAME, CLIENT_VERSION } from "../metadata";
import { OPType } from "../types/api/Websocket";
import type {
    NodeOptions,
    NodeState,
    NodeEventMap,
    MessagePayload,
    StatsPayload,
    ClientHeaders,
} from "../types/lavalink";

export enum CloseCodes {
    Normal = 1000,
    GoingAway = 1001,
    ProtocolError = 1002,
    UnsupportedData = 1003,
    NoStatusReceived = 1005,
    AbnormalClosure = 1006,
    InvalidFramePayloadData = 1007,
    PolicyViolation = 1008,
    MessageTooBig = 1009,
    InternalError = 1011,
}

/**
 * Represents a Lavalink node connection
 * Handles WebSocket connection, reconnection, and session management
 */
export class LavalinkNode extends EventEmitter<NodeEventMap> {
    #socketConfig: ClientOptions & { headers: ClientHeaders };
    #connectPromise: Promise<boolean> | null = null;
    #disconnectPromise: Promise<void> | null = null;

    #pingTimer: NodeJS.Timeout | null = null;
    #reconnectTimer: NodeJS.Timeout | null = null;

    #ping: number | null = null;
    #lastPingTime: number | null = null;

    #reconnectCycle = true;
    #reconnectAttempts = 0;
    #manualDisconnect = false;

    #socket: WebSocket | null = null;
    #stats: StatsPayload | null = null;

    #socketUrl: string;
    #pingTimeout: number;
    #reconnectDelay: number;
    #reconnectLimit: number;

    readonly name: string;
    readonly rest: REST;

    constructor(options: NodeOptions) {
        super({ captureRejections: false });

        // Validate options
        if (!options.name || typeof options.name !== "string") {
            throw new Error("Node name must be a non-empty string");
        }

        if (!options.clientId || typeof options.clientId !== "string") {
            throw new Error("Client ID must be a non-empty string");
        }

        // Initialize REST client
        this.rest = new REST(options);

        // Setup socket configuration
        this.#socketConfig = {
            headers: {
                "Client-Name": `${CLIENT_NAME}/${CLIENT_VERSION}`,
                "User-Id": options.clientId,
                "User-Agent": this.rest.userAgent,
                Authorization: options.password,
            },
            perMessageDeflate: false,
            handshakeTimeout: options.handshakeTimeout ?? 30000,
        };

        // Restore session if provided
        if (this.rest.sessionId) {
            this.#socketConfig.headers["Session-Id"] = this.rest.sessionId;
        }

        // Build WebSocket URL
        const protocol = options.secure ? "wss" : "ws";
        this.#socketUrl = `${protocol}://${options.host}:${options.port}/v4/websocket`;

        // Configure timeouts and reconnection
        this.#pingTimeout = (options.statsInterval ?? 60000) + (options.highestLatency ?? 5000);
        this.#reconnectDelay = options.reconnectDelay ?? 5000;
        this.#reconnectLimit = options.reconnectLimit ?? -1; // -1 = infinite

        this.name = options.name;

        // Make REST sessionId readonly but linked to socket
        Object.defineProperty(this.rest, "sessionId", {
            configurable: false,
            get: () => this.sessionId,
            set: () => {},
        });

        // Make properties immutable
        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            name: immutable,
            rest: immutable,
        } as PropertyDescriptorMap);
    }

    get clientId(): string {
        return this.#socketConfig.headers["User-Id"];
    }

    get sessionId(): string | null {
        return this.#socketConfig.headers["Session-Id"] ?? null;
    }

    get ping(): number | null {
        return this.#ping;
    }

    get stats(): StatsPayload | null {
        return this.#stats;
    }

    get state(): NodeState {
        if (this.connecting) {
            return "connecting";
        }
        if (this.connected) {
            return this.ready ? "ready" : "connected";
        }
        return this.reconnecting ? "reconnecting" : "disconnected";
    }

    get connecting(): boolean {
        return this.#socket?.readyState === WebSocket.CONNECTING;
    }

    get connected(): boolean {
        return this.#socket?.readyState === WebSocket.OPEN;
    }

    get ready(): boolean {
        return this.connected && this.sessionId !== null;
    }

    get reconnecting(): boolean {
        return this.#socket === null && this.#reconnectTimer !== null;
    }

    get disconnected(): boolean {
        return this.#socket === null && !this.reconnecting;
    }

    get reconnectLimit(): number {
        return this.#reconnectLimit;
    }

    get reconnectAttempts(): number {
        return this.#reconnectAttempts;
    }

    #error(err: Error | (Error & { errors?: Error[] })): Error {
        const data = "errors" in err && Array.isArray(err.errors) ? err.errors[err.errors.length - 1] : err;
        const error = data instanceof Error ? data : new Error(String(data));
        error.name = `Error [${(this.constructor as { name: string }).name}]`;
        return error;
    }

    #cleanup(): void {
        this.#socket?.removeAllListeners();
        if (this.#pingTimer !== null) {
            clearTimeout(this.#pingTimer);
        }
        this.#socket = this.#pingTimer = this.#stats = null;
        this.#lastPingTime = this.#ping = null;
    }

    #reconnect(): void {
        this.#reconnectCycle = false;
        this.#reconnectTimer?.refresh();
        this.#reconnectTimer ??= setTimeout(() => {
            this.#reconnectCycle = true;
            void this.connect();
        }, this.#reconnectDelay).unref();
    }

    #stopReconnecting(resetCount = true, reconnectCycle = false): void {
        this.#reconnectCycle = reconnectCycle;
        if (resetCount) {
            this.#reconnectAttempts = 0;
        }
        if (this.#reconnectTimer !== null) {
            clearTimeout(this.#reconnectTimer);
        }
        this.#reconnectTimer = null;
    }

    #keepAliveAndPing(): void {
        this.#pingTimer?.refresh();
        this.#pingTimer ??= setTimeout(() => {
            this.#socket?.terminate();
            this.#cleanup();
            this.#reconnect();
        }, this.#pingTimeout).unref();

        // Record timestamp before sending ping
        this.#lastPingTime = Date.now();
        this.#socket?.ping();
    }

    #parseMessageData(data: string): MessagePayload | null {
        try {
            return JSON.parse(data) as MessagePayload;
        } catch {
            return null;
        }
    }

    /**
     * Connect to the Lavalink node
     * Handles reconnection attempts and session resumption
     */
    async connect(): Promise<boolean> {
        if (this.#socket !== null) {
            return this.#connectPromise ?? this.connected;
        }

        if (this.reconnecting) {
            this.#reconnectAttempts++;
            if (!this.#reconnectCycle) {
                this.#stopReconnecting(false, true);
            }
        }

        this.#socket = new WebSocket(this.#socketUrl, this.#socketConfig);

        this.#socket.once("open", () => {
            this.emit("connect", this.#reconnectAttempts, this.name);
        });

        this.#socket.on("message", (data) => {
            void this.#onMessage((data as Buffer).toString("utf8"));
        });

        this.#socket.on("error", (err) => {
            this.emit("error", this.#error(err), this.name);
        });

        this.#socket.on("close", (code, reason) => {
            this.#onClose(code, reason.toString("utf8"));
        });

        this.#socket.on("pong", () => {
            if (this.#lastPingTime === null) {
                return;
            }
            this.#ping = Math.max(0, Date.now() - this.#lastPingTime);
        });

        let resolve!: (value: boolean) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<boolean>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const resolver = { promise, resolve, reject };
        this.#connectPromise = resolver.promise;
        const controller = new AbortController();

        try {
            await Promise.race([
                once(this.#socket, "open", { signal: controller.signal }),
                once(this.#socket, "close", { signal: controller.signal }),
            ]);
        } catch {
            this.#cleanup();
        } finally {
            controller.abort();
            const connected = this.connected;
            resolver.resolve(connected);
            this.#connectPromise = null;
        }
        return this.connected;
    }

    /**
     * Disconnect from the Lavalink node
     * @param code - WebSocket close code
     * @param reason - Disconnect reason
     */
    async disconnect(code: number = CloseCodes.Normal, reason = "disconnected"): Promise<void> {
        if (this.#disconnectPromise !== null) {
            return this.#disconnectPromise;
        }

        this.#stopReconnecting();

        if (this.#socket === null) {
            return;
        }

        if (this.connecting) {
            this.#manualDisconnect = true;
            this.#socket.terminate();
            return;
        }

        if (!this.connected) {
            return;
        }

        this.#manualDisconnect = true;
        this.#disconnectPromise = once(this.#socket, "close").then(
            () => {},
            () => {},
        );
        this.#socket.close(code, reason);
        await this.#disconnectPromise;
        this.#disconnectPromise = null;
    }

    async #onMessage(data: string): Promise<void> {
        const payload = this.#parseMessageData(data);
        if (payload === null) {
            return this.disconnect(CloseCodes.UnsupportedData, "expected json payload");
        }

        if (payload.op === OPType.Stats) {
            this.#stats = payload;
            this.#keepAliveAndPing();
        } else if (payload.op === OPType.Ready) {
            this.#stopReconnecting();
            this.#socketConfig.headers["Session-Id"] = payload.sessionId;
            this.emit("ready", payload.resumed, payload.sessionId, this.name);
        }

        this.emit("dispatch", payload, this.name);
    }

    #onClose(code: number, reason: string): void {
        this.#cleanup();

        // Check if we should stop reconnecting
        const shouldStop =
            this.#manualDisconnect || (this.#reconnectLimit >= 0 && this.#reconnectAttempts >= this.#reconnectLimit);

        if (shouldStop) {
            this.#stopReconnecting();
            delete this.#socketConfig.headers["Session-Id"];
            const byLocal = this.#manualDisconnect;
            this.#manualDisconnect = false;
            this.emit("disconnect", code, reason, byLocal, this.name);
            return;
        }

        if (this.#reconnectCycle) {
            this.#reconnect();
            this.emit("close", code, reason, this.name);
            return;
        }

        // Immediate reconnect attempt
        setTimeout(() => {
            this.#reconnectCycle = true;
            void this.connect();
        }, 0);
    }

    /**
     * Set SponsorBlock segments for a player
     */
    async setSponsorBlock(player: { guildId: string }, segments: string[]): Promise<void> {
        return this.rest.setSponsorBlock(player.guildId, segments);
    }

    /**
     * Get current SponsorBlock segments for a player
     */
    async getSponsorBlock(player: { guildId: string }): Promise<string[]> {
        return this.rest.getSponsorBlock(player.guildId);
    }

    /**
     * Delete SponsorBlock configuration for a player
     */
    async deleteSponsorBlock(player: { guildId: string }): Promise<void> {
        return this.rest.deleteSponsorBlock(player.guildId);
    }

    override toString(): string {
        return this.name;
    }
}

export { LavalinkNode as Node };
