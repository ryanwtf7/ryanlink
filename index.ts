/**
 * Ryanlink v1.0.0 - Modern Lavalink Client for Node.js
 * 
 * A feature-rich, TypeScript-first Lavalink client with:
 * - Complete Lavalink v4 support
 * - Advanced audio queue management
 * - 17 professional EQ presets
 * - 5 powerful extensions
 * - Cross-runtime support (Node.js, Bun, Deno)
 * - Production-ready architecture
 */

// Core components
export * from "./src/core";

// Lavalink connection
export * from "./src/lavalink";

// Audio management
export * from "./src/audio";

// Voice management
export * from "./src/voice";

// Extensions
export * from "./src/extensions";

// Configuration
export * from "./src/config";

// Utilities
export * from "./src/utils";

// Types
export * from "./src/types";

// Metadata (dynamically loaded from package.json)
export { CLIENT_VERSION as VERSION, CLIENT_NAME as NAME, PACKAGE_INFO } from "./src/metadata";


// Compatibility exports (for users migrating from similar libraries)
export { RyanlinkPlayer as Player } from "./src/core";
export { AudioQueue as Queue } from "./src/audio";
export { AudioTrack as Track } from "./src/audio";
export { TrackCollection as Playlist } from "./src/audio";
export { LavalinkConnection as Node } from "./src/lavalink";
export { ConnectionPool as NodeManager } from "./src/lavalink";
export { HttpClient as REST } from "./src/lavalink";
export { VoiceConnection as VoiceManager } from "./src/voice";
export { VoiceSession as VoiceState } from "./src/voice";
export { PluginSystem as Plugin } from "./src/core";
