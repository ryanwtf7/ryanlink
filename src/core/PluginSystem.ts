import type { Player } from "./RyanlinkPlayer";

/**
 * Abstract base class for Player plugins
 * Plugins can extend the player functionality and add custom events
 *
 * @example
 * ```ts
 * class MyPlugin extends PlayerPlugin<{
 *   customEvent: [data: string];
 * }> {
 *   readonly name = "my-plugin";
 *
 *   init(player: Player) {
 *     player.on("trackStart", () => {
 *       this.emit("customEvent", "track started");
 *     });
 *   }
 *
 *   // Example of a toJSON method, assuming it's meant to be part of the plugin class
 *   // and not inside the player.on callback.
 *   // The instruction "Improving toJSON return type" suggests this method might exist elsewhere
 *   // or is being added.
 *   toJSON(): Record<string, unknown> {
 *     return {
 *       name: this.name,
 *       // ... other plugin properties
 *     };
 *   }
 * }
 * ```
 */
export abstract class PlayerPlugin<EventMap extends Record<string, unknown[]> = Record<string, unknown[]>> {
    /** Type helper for event map - not used at runtime */
    declare protected _: EventMap;

    /**
     * Unique name for the plugin - must be readonly
     * Used to identify and access the plugin from player.plugins
     */
    abstract readonly name: string;

    /**
     * Initialize the plugin with the player instance
     * Called once when the player is initialized
     *
     * @param player - The player instance to attach to
     */
    abstract init(player: Player): void;
}
