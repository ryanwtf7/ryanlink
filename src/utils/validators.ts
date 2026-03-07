import { URL } from "node:url";
import type { CreateNodeOptions, PlayerOptions } from "../types";

/**
 * Validation functions for Ryanlink
 */

/**
 * Check if input is a finite number
 * @param input Value to check
 * @param check Optional check type: `integer`, `natural` (> 0), `whole` (>= 0)
 * @returns `true` if the input passed, `false` otherwise
 */
export const isNumber = <T extends number>(
    input: unknown,
    check?: "integer" | "natural" | "whole" | "safe-int" | "positive",
): input is T => {
    if (check === undefined) {
        return Number.isFinite(input);
    }
    if (check === "integer" || check === "safe-int") {
        return Number.isSafeInteger(input);
    }
    if (check === "natural" || check === "positive") {
        return Number.isSafeInteger(input) && (input as number) > 0;
    }
    if (check === "whole") {
        return Number.isSafeInteger(input) && (input as number) >= 0;
    }
    return false;
};

/**
 * Check if input is a string
 * @param input Value to check
 * @param check Optional check: {@linkcode RegExp}, `url` ({@linkcode URL.canParse}), `non-empty` (at least one non-whitespace character)
 * @returns `true` if the input passed, `false` otherwise
 */
export const isString = <T extends string>(input: unknown, check?: "url" | "non-empty" | RegExp): input is T => {
    if (typeof input !== "string") {
        return false;
    }
    if (check === undefined) {
        return true;
    }
    if (check === "url") {
        return URL.canParse(input);
    }
    if (check === "non-empty") {
        return input.trim().length > 0;
    }
    if (check instanceof RegExp) {
        return check.test(input);
    }
    return false;
};

/**
 * Check if input is a plain object
 * @param input Value to check
 * @param check Optional check: `non-empty` (at least one key)
 * @returns `true` if the input passed, `false` otherwise
 */
export const isRecord = <T extends Record<string, unknown>>(input: unknown, check?: "non-empty"): input is T => {
    if (!input || input.constructor !== Object) {
        return false;
    }
    if (check === undefined) {
        return true;
    }
    if (check === "non-empty") {
        return Object.keys(input).length > 0;
    }
    return false;
};

/**
 * Check if input is an array
 * @param input Value to check
 * @param check Optional check: `non-empty`, or a function (same as {@linkcode Array.prototype.every})
 * @returns `true` if the input passed, `false` otherwise
 */
export const isArray = <T extends unknown[]>(
    input: unknown,
    check?: "non-empty" | Parameters<T["every"]>[0],
): input is T => {
    if (!Array.isArray(input)) {
        return false;
    }
    if (check === undefined) {
        return true;
    }
    if (check === "non-empty") {
        return input.length !== 0;
    }
    if (typeof check === "function") {
        return input.every(check);
    }
    return false;
};

/**
 * Check if input is a boolean
 * @param input Value to check
 * @returns `true` if the input is a boolean, `false` otherwise
 */
export const isBoolean = (input: unknown): input is boolean => {
    return typeof input === "boolean";
};

/**
 * Check if input is a function
 * @param input Value to check
 * @returns `true` if the input is a function, `false` otherwise
 */
export const isFunction = (input: unknown): input is (...args: unknown[]) => unknown => {
    return typeof input === "function";
};

/**
 * Check if input is null or undefined
 * @param input Value to check
 * @returns `true` if the input is null or undefined, `false` otherwise
 */
export const isNullish = (input: unknown): input is null | undefined => {
    return input === null || input === undefined;
};

/**
 * Check if input is a valid snowflake (Discord ID)
 * @param input Value to check
 * @returns `true` if the input is a valid snowflake, `false` otherwise
 */
export const isSnowflake = (input: unknown): input is string => {
    return isString(input) && /^\d{17,20}$/.test(input);
};

/**
 * Check if input is a valid URL
 * @param input Value to check
 * @returns `true` if the input is a valid URL, `false` otherwise
 */
export const isUrl = (input: unknown): input is string => {
    return isString(input, "url");
};

/**
 * Type guard to check if error is an Error instance
 * @param error Value to check
 * @returns `true` if the value is an Error, `false` otherwise
 */
export const isError = (error: unknown): error is Error => {
    return error instanceof Error;
};

/**
 * Assert that a condition is true, throw error otherwise
 */
export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Validates node options
 */
export function validateNodeOptions(options: CreateNodeOptions): void {
    assert(isString(options.name, "non-empty"), "Node name must be a non-empty string");
    assert(isString(options.host, "non-empty"), "Node host must be a non-empty string");
    assert(isNumber(options.port, "natural"), "Node port must be a positive number");
    assert(isString(options.password, "non-empty"), "Node password must be a non-empty string");
}

/**
 * Validates player options
 */
export function validatePlayerOptions(options: PlayerOptions): void {
    assert(isArray(options.nodes, "non-empty"), "At least one node is required");
    assert(isFunction(options.forwardVoiceUpdate), "forwardVoiceUpdate must be a function");
    if (options.queryPrefix !== undefined) {
        assert(isString(options.queryPrefix, "non-empty"), "queryPrefix must be a non-empty string");
    }
}
