import { Routes } from "../config/endpoints";
import { CLIENT_NAME, CLIENT_VERSION, CLIENT_REPOSITORY } from "../metadata";
import type {
    RESTOptions,
    LoadResult,
    APIPlayer,
    PlayerUpdateRequestBody,
    PlayerUpdateQueryParams,
    SessionUpdateRequestBody,
    SessionUpdateResponseBody,
    LavalinkInfo,
    NodeStats,
    RoutePlannerStatus,
    APITrack,
} from "../types";

/**
 * REST client for Lavalink HTTP API
 * Uses native fetch for better performance
 */
export class REST {
    #origin: string;
    #headers: Record<string, string>;
    #sessionId: string | null = null;
    #requestTimeout: number;

    readonly userAgent: string;

    constructor(options: RESTOptions) {
        if (options.origin) {
            if (!options.origin.startsWith("http://") && !options.origin.startsWith("https://")) {
                throw new Error("Origin must start with http:// or https://");
            }
            this.#origin = options.origin;
        } else {
            const protocol = options.secure ? "https" : "http";
            const port = options.port ?? 2333;
            const host = options.host ?? "localhost";
            this.#origin = `${protocol}://${host}:${port}`;
        }

        if (options.version !== undefined && options.version <= 0) {
            throw new Error("Version must be a positive number");
        }

        if (options.password.includes("\n") || options.password.includes("\r")) {
            throw new Error("Password cannot contain newline characters");
        }

        const userAgent = options.userAgent ?? `${CLIENT_NAME}/${CLIENT_VERSION} (${CLIENT_REPOSITORY})`;
        if (userAgent.includes("\n") || userAgent.includes("\r")) {
            throw new Error("User agent cannot contain newline characters");
        }
        this.userAgent = userAgent;

        const requestTimeout = options.requestTimeout ?? 10_000;
        if (requestTimeout <= 0) {
            throw new Error("Request timeout must be a positive number");
        }
        this.#requestTimeout = requestTimeout;

        this.#headers = {
            Authorization: options.password,
            "User-Agent": this.userAgent,
            "Content-Type": "application/json",
        };

        if (options.sessionId) {
            this.#sessionId = options.sessionId;
        }
    }

    get origin(): string {
        return this.#origin;
    }

    get sessionId(): string | null {
        return this.#sessionId;
    }

    set sessionId(value: string | null) {
        if (value !== null && (typeof value !== "string" || value.trim() === "")) {
            return;
        }
        this.#sessionId = value;
    }

    /**
     * Make a request to the Lavalink REST API
     */
    async #request<T>(path: string, options: RequestInit = {}, timeout?: number): Promise<T> {
        const url = `${this.#origin}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout ?? this.#requestTimeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.#headers,
                    ...options.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await this.#parseError(response);
                throw error;
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return undefined as T;
            }

            return (await response.json()) as T;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Request timeout after ${timeout ?? this.#requestTimeout}ms`);
            }
            throw error;
        }
    }

    async #parseError(response: Response): Promise<Error> {
        let message = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const data = (await response.json()) as { error?: string; message?: string };
            if (data.error) {
                message = data.error;
            } else if (data.message) {
                message = data.message;
            }
        } catch {
            // Use default message
        }

        const error = new Error(message);
        error.name = "LavalinkRestError";
        return error;
    }

    /**
     * Load tracks from a query or URL
     */
    async loadTracks(identifier: string): Promise<LoadResult> {
        const path = `${Routes.trackLoading()}?identifier=${encodeURIComponent(identifier)}`;
        return this.#request<LoadResult>(path, { method: "GET" });
    }

    /**
     * Decode a single track
     */
    async decodeTrack(encoded: string): Promise<APITrack> {
        const path = `${Routes.trackDecoding()}?encodedTrack=${encodeURIComponent(encoded)}`;
        return this.#request<APITrack>(path, { method: "GET" });
    }

    /**
     * Decode multiple tracks
     */
    async decodeTracks(encoded: string[]): Promise<APITrack[]> {
        return this.#request<APITrack[]>(Routes.trackDecoding(true), {
            method: "POST",
            body: JSON.stringify(encoded),
        });
    }

    /**
     * Fetch all players for a session
     */
    async fetchPlayers(): Promise<APIPlayer[]> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<APIPlayer[]>(Routes.player(this.#sessionId), { method: "GET" });
    }

    /**
     * Fetch a specific player
     */
    async fetchPlayer(guildId: string): Promise<APIPlayer> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<APIPlayer>(Routes.player(this.#sessionId, guildId), { method: "GET" });
    }

    /**
     * Update a player
     */
    async updatePlayer(
        guildId: string,
        data: PlayerUpdateRequestBody,
        params?: PlayerUpdateQueryParams,
    ): Promise<APIPlayer> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }

        let path = Routes.player(this.#sessionId, guildId);
        if (params?.noReplace) {
            path += "?noReplace=true";
        }

        return this.#request<APIPlayer>(path, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    /**
     * Destroy a player
     */
    async destroyPlayer(guildId: string): Promise<void> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<void>(Routes.player(this.#sessionId, guildId), { method: "DELETE" });
    }

    /**
     * Update session configuration
     */
    async updateSession(data: SessionUpdateRequestBody): Promise<SessionUpdateResponseBody> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<SessionUpdateResponseBody>(Routes.session(this.#sessionId), {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    /**
     * Fetch Lavalink server info
     */
    async fetchInfo(): Promise<LavalinkInfo> {
        return this.#request<LavalinkInfo>(Routes.info(), { method: "GET" });
    }

    /**
     * Fetch node statistics
     */
    async fetchStats(): Promise<NodeStats> {
        return this.#request<NodeStats>(Routes.stats(), { method: "GET" });
    }

    /**
     * Fetch Lavalink version
     */
    async fetchVersion(): Promise<string> {
        return this.#request<string>("/version", { method: "GET" });
    }

    /**
     * Fetch route planner status
     */
    async fetchRoutePlannerStatus(): Promise<RoutePlannerStatus> {
        return this.#request<RoutePlannerStatus>(Routes.routePlanner(), { method: "GET" });
    }

    /**
     * Free a specific address from the route planner
     */
    async freeRoutePlannerAddress(address: string): Promise<void> {
        return this.#request<void>(Routes.routePlanner("address"), {
            method: "POST",
            body: JSON.stringify({ address }),
        });
    }

    /**
     * Free all addresses from the route planner
     */
    async freeAllRoutePlannerAddresses(): Promise<void> {
        return this.#request<void>(Routes.routePlanner("all"), { method: "POST" });
    }

    /**
     * Set SponsorBlock segments for a player
     */
    async setSponsorBlock(guildId: string, segments: string[]): Promise<void> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<void>(`${Routes.player(this.#sessionId, guildId)}/sponsorblock`, {
            method: "PATCH",
            body: JSON.stringify(segments),
        });
    }

    /**
     * Get current SponsorBlock segments for a player
     */
    async getSponsorBlock(guildId: string): Promise<string[]> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<string[]>(`${Routes.player(this.#sessionId, guildId)}/sponsorblock`, { method: "GET" });
    }

    /**
     * Delete SponsorBlock configuration for a player
     */
    async deleteSponsorBlock(guildId: string): Promise<void> {
        if (!this.#sessionId) {
            throw new Error("No session ID available");
        }
        return this.#request<void>(`${Routes.player(this.#sessionId, guildId)}/sponsorblock`, { method: "DELETE" });
    }
}
