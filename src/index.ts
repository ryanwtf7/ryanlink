/**
 * Ryanlink - Advanced Lavalink client for Node.js
 *
 * @packageDocumentation
 */

// Export all components
export * from "./config";
export * from "./utils";
export * from "./lavalink";
export * from "./voice";
export * from "./audio";
export * from "./extensions";
export * from "./core";

/**
 * Ryanlink version (dynamically loaded from package.json)
 */
export { CLIENT_VERSION as version, CLIENT_NAME as name, PACKAGE_INFO } from "./metadata";
