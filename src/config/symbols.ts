/**
 * Symbol for internal lookup operations
 * Used to access internal state without exposing public methods
 */
export const LookupSymbol = Symbol.for("lookup");

/**
 * Symbol for internal update operations
 * Used to update internal state without exposing public methods
 */
export const UpdateSymbol = Symbol.for("update");

/**
 * Symbol for ping update handling in VoiceRegion
 */
export const OnPingUpdateSymbol = Symbol("onPingUpdate");

/**
 * Symbol for voice close handling
 */
export const OnVoiceCloseSymbol = Symbol("onVoiceClose");

/**
 * Symbol for player state update handling
 */
export const OnStateUpdateSymbol = Symbol("onStateUpdate");

/**
 * Symbol for event update handling
 */
export const OnEventUpdateSymbol = Symbol("onEventUpdate");
