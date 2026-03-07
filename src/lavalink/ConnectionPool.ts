import { EventEmitter } from "node:events";
import { LavalinkNode } from "./LavalinkConnection";
import type { Player } from "../core/RyanlinkPlayer";
import type { NodeOptions, NodeManagerEvents, LavalinkInfo } from "../types/lavalink";

/**
 * Node metrics for selection and monitoring
 */
export interface NodeMetrics {
    /** Total number of nodes */
    total: number;
    /** Number of connected nodes */
    connected: number;
    /** Number of ready nodes */
    ready: number;
    /** Number of reconnecting nodes */
    reconnecting: number;
    /** Total players across all nodes */
    players: number;
    /** Total playing players across all nodes */
    playingPlayers: number;
}

/**
 * Manages all Lavalink nodes
 * Handles node creation, connection, and selection
 */
export class NodeManager extends EventEmitter<NodeManagerEvents> {
    #player: Player;
    #nodes = new Map<string, LavalinkNode>();

    readonly info = new Map<string, LavalinkInfo>(); // LavalinkInfo cache

    constructor(player: Player) {
        super({ captureRejections: false });
        this.#player = player;

        const immutable: PropertyDescriptor = {
            writable: false,
            configurable: false,
        };

        Object.defineProperties(this, {
            info: immutable,
        });
    }

    /**
     * Get a node by name
     */
    get(name: string): LavalinkNode | undefined {
        return this.#nodes.get(name);
    }

    /**
     * Check if a node exists
     */
    has(name: string): boolean {
        return this.#nodes.has(name);
    }

    /**
     * Get all nodes
     */
    get all(): LavalinkNode[] {
        return Array.from(this.#nodes.values());
    }

    /**
     * Get number of nodes
     */
    get size(): number {
        return this.#nodes.size;
    }

    /**
     * Create a new node
     */
    create(options: NodeOptions): LavalinkNode {
        if (this.#nodes.has(options.name)) {
            throw new Error(`Node '${options.name}' already exists`);
        }

        const node = new LavalinkNode({
            ...options,
            clientId: this.#player.clientId ?? "",
        });

        // Forward node events
        node.on("connect", (_attempts, _name) => {
            this.emit("connect", node);
        });

        node.on("ready", (resumed, sessionId, _name) => {
            this.emit("ready", node, resumed, sessionId);

            // Fetch node info on first ready (not on resume)
            if (!this.info.has(node.name)) {
                this.fetchInfo(node.name).catch(() => {});
            }

            if (resumed) {
                void this.#handleResumed(node);
            }
        });

        node.on("disconnect", (code, reason, _byLocal, _name) => {
            this.emit("disconnect", node, { code, reason });
        });

        node.on("close", (_code, _reason, _name) => {
            // Node is reconnecting
            this.emit("reconnecting", node);
        });

        node.on("error", (error, _name) => {
            this.emit("error", node, error);
        });

        node.on("dispatch", (payload, _name) => {
            this.emit("raw", node, payload);
        });

        this.#nodes.set(options.name, node);
        this.emit("create", node);

        return node;
    }

    /**
     * Delete a node
     */
    async delete(name: string): Promise<boolean> {
        const node = this.#nodes.get(name);
        if (!node) {
            return false;
        }

        // Check if node has active queues
        const activeQueues = this.#player.queues.all.filter((q) => q.node?.name === name);
        if (activeQueues.length > 0) {
            throw new Error(`Cannot delete node '${name}' with ${activeQueues.length} active queue(s)`);
        }

        await node.disconnect();
        this.#nodes.delete(name);
        this.info.delete(name);
        this.emit("destroy", node);

        return true;
    }

    /**
     * Connect all nodes
     */
    async connect(): Promise<void> {
        const promises = Array.from(this.#nodes.values()).map((node) => node.connect());
        await Promise.allSettled(promises);
    }

    /**
     * Disconnect all nodes
     */
    async disconnect(): Promise<void> {
        const promises = Array.from(this.#nodes.values()).map((node) => node.disconnect());
        await Promise.allSettled(promises);
    }

    /**
     * Get relevant nodes sorted by load and availability
     * Returns nodes that are ready and have lowest load
     */
    relevant(): LavalinkNode[] {
        const readyNodes = Array.from(this.#nodes.values()).filter((node) => node.ready);

        if (readyNodes.length === 0) {
            return [];
        }

        // Sort by load (players, CPU, memory)
        return readyNodes.sort((a, b) => {
            const aStats = a.stats;
            const bStats = b.stats;

            if (!aStats) {
                return 1;
            }
            if (!bStats) {
                return -1;
            }

            // Compare by playing players first
            const aLoad = aStats.playingPlayers / (aStats.players || 1);
            const bLoad = bStats.playingPlayers / (bStats.players || 1);

            if (aLoad !== bLoad) {
                return aLoad - bLoad;
            }

            // Then by CPU load
            const aCpu = aStats.cpu.lavalinkLoad;
            const bCpu = bStats.cpu.lavalinkLoad;

            if (aCpu !== bCpu) {
                return aCpu - bCpu;
            }

            // Finally by memory usage
            const aMemory = aStats.memory.used / aStats.memory.allocated;
            const bMemory = bStats.memory.used / bStats.memory.allocated;

            return aMemory - bMemory;
        });
    }

    /**
     * Get node metrics
     */
    get metrics(): NodeMetrics {
        const nodes = Array.from(this.#nodes.values());

        return {
            total: nodes.length,
            connected: nodes.filter((n) => n.connected).length,
            ready: nodes.filter((n) => n.ready).length,
            reconnecting: nodes.filter((n) => n.reconnecting).length,
            players: nodes.reduce((sum, n) => sum + (n.stats?.players ?? 0), 0),
            playingPlayers: nodes.reduce((sum, n) => sum + (n.stats?.playingPlayers ?? 0), 0),
        };
    }

    /**
     * Get all node names
     */
    keys(): IterableIterator<string> {
        return this.#nodes.keys();
    }

    /**
     * Get all nodes
     */
    values(): IterableIterator<LavalinkNode> {
        return this.#nodes.values();
    }

    /**
     * Get all entries
     */
    entries(): IterableIterator<[string, LavalinkNode]> {
        return this.#nodes.entries();
    }

    /**
     * Fetch and cache node info
     * @param name Node name
     */
    async fetchInfo(name: string): Promise<LavalinkInfo> {
        if (this.info.has(name)) {
            return this.info.get(name) as LavalinkInfo;
        }

        const node = this.#nodes.get(name);
        if (!node) {
            throw new Error(`Node '${name}' not found`);
        }

        const info = await node.rest.fetchInfo();
        this.info.set(name, info);
        return info;
    }

    /**
     * Check if a feature is supported by a node
     * @param type Feature type (filter, source, plugin)
     * @param value Feature value (name)
     * @param nodeName Optional node name (checks all if not specified)
     */
    supports(type: "filter" | "source" | "plugin", value: string, nodeName?: string): boolean {
        if (nodeName) {
            const node = this.#nodes.get(nodeName);
            if (!node) {
                return false;
            }
            return this.#checkNodeSupport(node.name, type, value);
        }

        // Check if any node supports it
        return Array.from(this.#nodes.values()).some((node) => this.#checkNodeSupport(node.name, type, value));
    }

    /**
     * Check if a specific node supports a feature
     */
    #checkNodeSupport(nodeName: string, type: "filter" | "source" | "plugin", value: string): boolean {
        const info = this.info.get(nodeName);
        if (!info) {
            return false;
        }

        switch (type) {
            case "filter":
                return info.filters?.includes(value) ?? false;
            case "source":
                return info.sourceManagers?.includes(value) ?? false;
            case "plugin":
                return info.plugins?.some((p: { name: string }) => p.name === value) ?? false;
            default:
                return false;
        }
    }

    /**
     * Handle node resumption
     * Sync all queues when a node resumes
     */
    async #handleResumed(node: LavalinkNode): Promise<void> {
        try {
            // Sync queues if autoSync is enabled
            if (this.#player.options.autoSync) {
                await this.#player.queues.syncAll();
            }
        } catch (error) {
            this.emit("error", node, error as Error);
        }
    }
}
