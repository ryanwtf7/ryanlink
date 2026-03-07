import { PlayerPlugin } from "../core/PluginSystem";
import type { Player } from "../core/RyanlinkPlayer";
import { Track } from "../audio/AudioTrack";

export interface LyricsPluginEvents {
    /**
     * Emitted when lyrics are found
     */
    lyricsFound: [player: Player, track: Track, lyrics: LyricsResult];

    /**
     * Emitted when lyrics are not found
     */
    lyricsNotFound: [player: Player, track: Track];
}

export interface LyricsLine {
    timestamp: number;
    duration: number | null;
    line: string;
}

export interface LyricsResult {
    sourceName: string;
    provider: string;
    text: string | null;
    lines: LyricsLine[];
    track: {
        title: string;
        artist: string;
        album?: string;
        duration: number;
    };
}

export interface LyricsConfig {
    sources: {
        lavalink: boolean;
        lrclib: boolean;
        musixmatch: boolean;
        genius: boolean;
    };
    apiKeys?: {
        musixmatch?: string;
        genius?: string;
    };
}

/**
 * Lyrics Plugin - Fetches and manages track lyrics from multiple sources
 * Supports Lavalink LavaLyrics, LRCLib, Musixmatch, and Genius
 */
export class LyricsPlugin extends PlayerPlugin<LyricsPluginEvents & Record<string, unknown[]>> {
    readonly name = "lyrics" as const;

    #player!: Player;

    init(player: Player): void {
        this.#player = player;
    }

    /**
     * Fetch lyrics for a track
     * @param track - The track to fetch lyrics for
     * @param config - Configuration for lyrics sources
     */
    async getLyrics(track: Track, config?: LyricsConfig): Promise<LyricsResult | null> {
        const defaultConfig: LyricsConfig = {
            sources: {
                lavalink: true,
                lrclib: true,
                musixmatch: false,
                genius: false,
            },
            ...config,
        };

        const title = track.info.title;
        const artist = track.info.author;

        if (defaultConfig.sources.lavalink) {
            const lavalinkLyrics = await this.#fetchFromLavalink(track);
            if (lavalinkLyrics) {
                this.#player.emit("lyricsFound", this.#player, track, lavalinkLyrics);
                return lavalinkLyrics;
            }
        }

        if (defaultConfig.sources.lrclib) {
            const lrclibLyrics = await this.#fetchFromLRCLib(title, artist);
            if (lrclibLyrics) {
                this.#player.emit("lyricsFound", this.#player, track, lrclibLyrics);
                return lrclibLyrics;
            }
        }

        if (defaultConfig.sources.musixmatch && defaultConfig.apiKeys?.musixmatch) {
            const musixmatchLyrics = await this.#fetchFromMusixmatch(title, artist, defaultConfig.apiKeys.musixmatch);
            if (musixmatchLyrics) {
                this.#player.emit("lyricsFound", this.#player, track, musixmatchLyrics);
                return musixmatchLyrics;
            }
        }

        if (defaultConfig.sources.genius && defaultConfig.apiKeys?.genius) {
            const geniusLyrics = await this.#fetchFromGenius(title, artist, defaultConfig.apiKeys.genius);
            if (geniusLyrics) {
                this.#player.emit("lyricsFound", this.#player, track, geniusLyrics);
                return geniusLyrics;
            }
        }

        this.#player.emit("lyricsNotFound", this.#player, track);
        return null;
    }

    /**
     * Get the current lyric line based on playback position
     */
    getCurrentLine(lyrics: LyricsResult, position: number): LyricsLine | null {
        if (!lyrics.lines || lyrics.lines.length === 0) {
            return null;
        }

        for (let i = lyrics.lines.length - 1; i >= 0; i--) {
            if (lyrics.lines[i].timestamp <= position) {
                return lyrics.lines[i];
            }
        }

        return null;
    }

    /**
     * Format lyrics for display
     */
    formatLyrics(lyrics: LyricsResult, maxLength: number = 2000): string {
        if (lyrics.text) {
            return lyrics.text.slice(0, maxLength);
        }

        if (lyrics.lines && lyrics.lines.length > 0) {
            let formatted = "";
            for (const line of lyrics.lines) {
                const timestamp = this.#formatTimestamp(line.timestamp);
                formatted += `[${timestamp}] ${line.line}\n`;

                if (formatted.length > maxLength) {
                    return `${formatted.slice(0, maxLength)}...`;
                }
            }
            return formatted;
        }

        return "No lyrics available";
    }

    #formatTimestamp(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    async #fetchFromLavalink(_track: Track): Promise<LyricsResult | null> {
        // Implementation would call Lavalink's lyrics endpoint
        // This is a placeholder
        return await Promise.resolve(null);
    }

    async #fetchFromLRCLib(_title: string, _artist: string): Promise<LyricsResult | null> {
        // Implementation would call LRCLib API
        // This is a placeholder
        return await Promise.resolve(null);
    }

    async #fetchFromMusixmatch(_title: string, _artist: string, _apiKey: string): Promise<LyricsResult | null> {
        // Implementation would call Musixmatch API
        // This is a placeholder
        return await Promise.resolve(null);
    }

    async #fetchFromGenius(_title: string, _artist: string, _apiToken: string): Promise<LyricsResult | null> {
        // Implementation would call Genius API
        // This is a placeholder
        return await Promise.resolve(null);
    }
}
