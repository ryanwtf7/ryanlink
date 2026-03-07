import { formatDuration, isArray, isNumber, isRecord, isString } from "../utils";
import { Track } from "./AudioTrack";
import type { APIPlaylist, CommonPluginInfo, JsonObject } from "../types";

/**
 * Represents a playlist containing multiple tracks
 */
export class Playlist<PluginInfo extends JsonObject = CommonPluginInfo> {
    /**
     * Name of the playlist
     */
    name = "Unknown Playlist";

    /**
     * Index of the track that was selected (from URL)
     */
    selectedTrack = -1;

    /**
     * List of tracks in the playlist
     */
    tracks: Track[] = [];

    /**
     * Additional info from plugins
     */
    pluginInfo = {} as PluginInfo;

    /**
     * Total duration of all tracks in milliseconds
     */
    duration = 0;

    /**
     * Formatted total duration string
     */
    formattedDuration = "00:00";

    constructor(data: APIPlaylist<PluginInfo>) {
        if (!isRecord(data)) {
            throw new Error("Playlist data must be an object");
        }
        if (!isRecord(data.info)) {
            throw new Error("Playlist info is not an object");
        }
        if (!isArray(data.tracks)) {
            throw new Error("Playlist tracks must be an array");
        }

        // Process tracks and calculate duration
        for (let i = 0; i < data.tracks.length; i++) {
            const track = new Track(data.tracks[i]);
            if (!track.isLive) {
                this.duration += track.duration;
            }
            this.tracks.push(track);
        }

        // Set playlist name
        if (isString(data.info.name, "non-empty")) {
            this.name = data.info.name;
        } else if (data.info.name === "") {
            this.name = "";
        }

        // Set selected track index
        if (isNumber(data.info.selectedTrack, "whole")) {
            this.selectedTrack = data.info.selectedTrack;
        }

        // Set plugin info
        if (isRecord(data.pluginInfo, "non-empty")) {
            this.pluginInfo = data.pluginInfo;
        }

        // Format duration
        if (this.duration > 0) {
            this.formattedDuration = formatDuration(this.duration);
        }
    }

    get selected(): Track | null {
        if (this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
            return null;
        }
        return this.tracks[this.selectedTrack] ?? null;
    }

    /**
     * Get the selected track (if any)
     * @returns The selected track or undefined if none/invalid
     */
    getSelectedTrack(): Track | undefined {
        return this.selected ?? undefined;
    }

    /**
     * Get the number of tracks
     */
    get length(): number {
        return this.tracks.length;
    }

    /**
     * Get the number of tracks (alias for length)
     */
    get trackCount(): number {
        return this.tracks.length;
    }

    /**
     * Formatted total duration (alias for formattedDuration)
     */
    get durationFormatted(): string {
        return this.formattedDuration;
    }

    /**
     * String representation of the playlist
     */
    toString(): string {
        return this.name;
    }

    /**
     * JSON representation of the playlist
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            selectedTrack: this.selectedTrack,
            tracks: this.tracks.map((t) => t.toJSON()),
            duration: this.duration,
            formattedDuration: this.formattedDuration,
            pluginInfo: this.pluginInfo,
        };
    }
}
