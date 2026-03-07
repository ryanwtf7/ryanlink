/**
 * Utility functions for Ryanlink
 */

/**
 * Do nothing, return nothing
 * Useful for error handling and default callbacks
 */
export const noop = (): void => {};

/**
 * Format duration as a string
 * @param ms Duration in milliseconds
 * @returns Formatted string: `hh:mm:ss`, `mm:ss`, or `00:00` (default)
 *
 * @example
 * formatDuration(0) // "00:00"
 * formatDuration(90000) // "01:30"
 * formatDuration(3661000) // "01:01:01"
 */
export const formatDuration = (ms: number): string => {
    if (!Number.isSafeInteger(ms) || ms <= 0) {
        return "00:00";
    }

    const s = Math.floor(ms / 1000);
    const ss = `${s % 60}`.padStart(2, "0");
    const mm = `${Math.floor(s / 60) % 60}`.padStart(2, "0");

    if (s < 3600) {
        return `${(s === 3600 ? "01:" : "") + mm}:${ss}`;
    }

    return `${`${Math.floor(s / 3600)}`.padStart(2, "0")}:${mm}:${ss}`;
};

/**
 * Parse duration string to milliseconds
 * @param duration Duration string (hh:mm:ss, mm:ss, or ss)
 * @returns Duration in milliseconds
 *
 * @example
 * parseDuration("01:30") // 90000
 * parseDuration("1:01:01") // 3661000
 */
export const parseDuration = (duration: string): number => {
    const parts = duration.split(":").map(Number);

    if (parts.length === 1) {
        return (parts[0] ?? 0) * 1000;
    }

    if (parts.length === 2) {
        return ((parts[0] ?? 0) * 60 + (parts[1] ?? 0)) * 1000;
    }

    if (parts.length === 3) {
        return ((parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)) * 1000;
    }

    return 0;
};

/**
 * Clamp a number between min and max
 * @param value Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

/**
 * Sleep for a specified duration
 * @param ms Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts
 * @param baseDelay Base delay in milliseconds
 * @returns Result of the function
 */
export const retry = async <T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 1000): Promise<T> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }

    throw lastError ?? new Error("Retry failed");
};

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * @param array Array to shuffle
 * @returns The shuffled array
 */
export const shuffle = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

/**
 * Get a random element from an array
 * @param array Array to pick from
 * @returns Random element or undefined if array is empty
 */
export const randomElement = <T>(array: T[]): T | undefined => {
    if (array.length === 0) {
        return undefined;
    }
    return array[Math.floor(Math.random() * array.length)];
};

/**
 * Chunk an array into smaller arrays
 * @param array Array to chunk
 * @param size Size of each chunk
 * @returns Array of chunks
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

/**
 * Remove duplicates from an array
 * @param array Array to deduplicate
 * @param key Optional key function for complex objects
 * @returns Array without duplicates
 */
export const unique = <T>(array: T[], key?: (item: T) => unknown): T[] => {
    if (!key) {
        return [...new Set(array)];
    }

    const seen = new Set();
    return array.filter((item) => {
        const k = key(item);
        if (seen.has(k)) {
            return false;
        }
        seen.add(k);
        return true;
    });
};
