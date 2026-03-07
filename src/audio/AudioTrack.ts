import { formatDuration, isNumber, isRecord, isString } from "../utils";
import type { APITrack, CommonPluginInfo, CommonUserData, JsonObject } from "../types";

/**
 * Represents a music track with metadata and playback information
 */
export class Track<UserData extends JsonObject = CommonUserData, PluginInfo extends JsonObject = CommonPluginInfo> {
    /**
     * Unique identifier of the track
     */
    id: string;

    /**
     * Title of the track
     */
    title = "Unknown Track";

    /**
     * Author/artist of the track
     */
    author = "Unknown Author";

    /**
     * Whether the track is a live stream
     */
    isLive = false;

    /**
     * Whether the track is seekable
     */
    isSeekable = false;

    /**
     * Duration of the track in milliseconds
     */
    duration = 0;

    /**
     * Formatted duration string (hh:mm:ss or mm:ss)
     */
    formattedDuration = "00:00";

    /**
     * Uniform Resource Identifier of the track
     */
    uri: string | null = null;

    /**
     * International Standard Recording Code
     */
    isrc: string | null = null;

    /**
     * URL of the track (validated URI)
     */
    url: string | null = null;

    /**
     * Artwork/thumbnail URL
     */
    artworkUrl: string | null = null;

    /**
     * Custom user data attached to the track
     */
    userData = {} as UserData;

    /**
     * Additional info from plugins
     */
    pluginInfo = {} as PluginInfo;

    /**
     * Encoded string representation (Lavalink format)
     */
    encoded: string;

    /**
     * Source name (youtube, spotify, soundcloud, etc.)
     */
    sourceName = "unknown";

    get identifier(): string {
        return this.id;
    }

    get stream(): boolean {
        return this.isLive;
    }

    get seekable(): boolean {
        return this.isSeekable;
    }

    get durationFormatted(): string {
        return this.formattedDuration;
    }

    get source(): string {
        return this.sourceName;
    }

    get thumbnail(): string | null {
        return this.artworkUrl;
    }

    get info() {
        return {
            identifier: this.id,
            position: 0,
            title: this.title,
            author: this.author,
            length: this.duration,
            isStream: this.isLive,
            isSeekable: this.isSeekable,
            uri: this.uri,
            isrc: this.isrc,
            artworkUrl: this.artworkUrl,
            sourceName: this.sourceName,
        };
    }

    constructor(data: APITrack<UserData, PluginInfo>) {
        if (!isRecord(data)) {
            throw new Error("Track data must be an object");
        }
        if (!isRecord(data.info)) {
            throw new Error("Track info is not an object");
        }

        // Validate and set identifier
        if (isString(data.info.identifier, "non-empty")) {
            this.id = data.info.identifier;
        } else {
            throw new Error("Track does not have an identifier");
        }

        // Validate and set encoded data
        if (isString(data.encoded, "non-empty")) {
            this.encoded = data.encoded;
        } else {
            throw new Error("Track does not have an encoded data string");
        }

        // Set title and author
        if (isString(data.info.title, "non-empty")) {
            this.title = data.info.title;
        }
        if (isString(data.info.author, "non-empty")) {
            this.author = data.info.author;
        }

        // Set stream and seekable flags
        if (data.info.isStream) {
            this.isLive = true;
        }
        if (data.info.isSeekable) {
            this.isSeekable = true;
        }

        // Set duration
        if (this.isLive) {
            this.duration = Number.POSITIVE_INFINITY;
            this.formattedDuration = "Live";
        } else if (isNumber(data.info.length, "whole")) {
            this.duration = data.info.length;
            this.formattedDuration = formatDuration(this.duration);
        }

        // Set URIs
        if (isString(data.info.uri, "non-empty")) {
            this.uri = data.info.uri;
        }
        if (isString(data.info.isrc, "non-empty")) {
            this.isrc = data.info.isrc;
        }

        // Validate URL
        if (isString(this.uri, "url")) {
            this.url = this.uri;
        }
        if (isString(data.info.artworkUrl, "url")) {
            this.artworkUrl = data.info.artworkUrl;
        }

        // Set user data and plugin info
        if (isRecord(data.userData, "non-empty")) {
            this.userData = data.userData;
        }
        if (isRecord(data.pluginInfo, "non-empty")) {
            this.pluginInfo = data.pluginInfo;
        }

        // Set source name
        if (isString(data.info.sourceName, "non-empty")) {
            this.sourceName = data.info.sourceName;
        }
    }

    /**
     * String representation of the track
     */
    toString(): string {
        return this.title;
    }

    /**
     * JSON representation of the track
     */
    toJSON(): Record<string, unknown> {
        return {
            identifier: this.id,
            title: this.title,
            author: this.author,
            duration: this.duration,
            uri: this.uri,
            thumbnail: this.artworkUrl,
            source: this.sourceName,
            isSeekable: this.isSeekable,
            isStream: this.isLive,
            encoded: this.encoded,
            userData: this.userData,
            pluginInfo: this.pluginInfo,
        };
    }

    /**
     * Create a clone of the track
     */
    clone(): Track<UserData, PluginInfo> {
        return new Track({
            encoded: this.encoded,
            info: {
                ...this.info,
                length: this.duration,
                isStream: this.isLive,
            },
            userData: this.userData,
            pluginInfo: this.pluginInfo,
        } as APITrack<UserData, PluginInfo>);
    }
}
