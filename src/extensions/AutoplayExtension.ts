import { PlayerPlugin } from "../core/PluginSystem";
import type { Player } from "../core/RyanlinkPlayer";
import type { Track } from "../audio/AudioTrack";
import { Queue } from "../audio/AudioQueue";
import { LoadType, type LoadResult } from "../types/api/Rest";

interface PlayerWithGet extends Player {
    get?<T>(key: string): T;
}

export interface AutoplayConfig {
    enabled: boolean;
    minPlayTime: number;
    sources: {
        spotify: boolean;
        youtube: boolean;
        youtubemusic: boolean;
        soundcloud: boolean;
    };
    limit: number;
    /** Filter out tracks shorter than this (ms) */
    minDuration: number;
    /** Filter out tracks longer than this (ms) */
    maxDuration: number;
    /** Filter out specific keywords in titles */
    excludeKeywords: string[];
}

/**
 * Autoplay Plugin - Automatically adds related tracks when queue ends
 * Uses Player's existing events - no separate event system
 */
export class AutoplayPlugin extends PlayerPlugin {
    readonly name = "autoplay" as const;

    #player!: Player;
    #adding = new Set<string>(); // Track which guilds are currently adding

    init(player: Player): void {
        this.#player = player;

        // Listen to queue finish event
        player.on("queueFinish", (queue) => {
            void this.#handleQueueFinish(queue);
        });
    }

    async #handleQueueFinish(queue: Queue): Promise<void> {
        const lastTrack = queue.previousTrack;
        if (!lastTrack) {
            return;
        }

        const config = (queue.player as PlayerWithGet).get?.<AutoplayConfig>(`autoplay_config_${queue.guildId}`) ?? {
            enabled: true,
            minPlayTime: 10000,
            sources: {
                spotify: true,
                youtube: true,
                youtubemusic: true,
                soundcloud: false,
            },
            limit: 5,
            minDuration: 20000,
            maxDuration: 900000,
            excludeKeywords: ["nightcore", "bass boosted", "8d audio", "slowed", "reverb"],
        };

        if (!config.enabled) {
            return;
        }

        // Prevent concurrent autoplay
        if (this.#adding.has(queue.guildId)) {
            return;
        }
        this.#adding.add(queue.guildId);

        try {
            const playedData = this.#buildPlayedData(queue);
            const relatedTracks = await this.#fetchRelatedTracks(queue, lastTrack, config, playedData);

            if (relatedTracks.length > 0) {
                for (const relatedTrack of relatedTracks) {
                    if (!relatedTrack.pluginInfo) {
                        relatedTrack.pluginInfo = {};
                    }
                    relatedTrack.pluginInfo.fromAutoplay = true;

                    relatedTrack.userData.requester = {
                        id: this.#player.clientId ?? "autoplay",
                        username: "Autoplay",
                    };

                    queue.add(relatedTrack);
                }

                if (queue.stopped && queue.tracks.length > 0) {
                    await queue.resume();
                }
            }
        } catch (error) {
            this.#player.emit("debug", "autoplay", {
                message: `Autoplay failed: ${(error as Error).message}`,
                state: "error",
                error: error as Error,
                functionLayer: "AutoplayPlugin",
            });
        } finally {
            this.#adding.delete(queue.guildId);
        }
    }

    #buildPlayedData(queue: Queue): {
        playedIds: Set<string>;
        playedTracks: Set<string>;
    } {
        const playedIds = new Set<string>();
        const playedTracks = new Set<string>();

        const addTrack = (track: Track) => {
            if (track.info.identifier) {
                playedIds.add(track.info.identifier);
            }
            if (track.info.isrc) {
                playedIds.add(track.info.isrc);
            }
            if (track.info.title && track.info.author) {
                const key = `${track.info.title.toLowerCase()}|${track.info.author.toLowerCase()}`;
                playedTracks.add(key);
            }
        };

        if (queue.track) {
            addTrack(queue.track);
        }
        queue.previousTracks.forEach(addTrack);
        queue.tracks.forEach(addTrack);

        return { playedIds, playedTracks };
    }

    async #fetchRelatedTracks(
        queue: Queue,
        lastTrack: Track,
        config: AutoplayConfig,
        playedData: { playedIds: Set<string>; playedTracks: Set<string> },
    ): Promise<Track[]> {
        const tracks: Track[] = [];
        const source = lastTrack.info.sourceName?.toLowerCase();

        if (config.sources.spotify && source?.includes("spotify")) {
            const spotifyTracks = await this.#getSpotifyRecommendations(queue, lastTrack);
            tracks.push(...spotifyTracks);

            if (tracks.length < config.limit) {
                const artistTracks = await this.#getSpotifyArtistSearch(queue, lastTrack);
                tracks.push(...artistTracks);
            }
        }

        if (tracks.length < config.limit && config.sources.youtube && source?.includes("youtube")) {
            const youtubeTracks = await this.#getYouTubeSimilar(queue, lastTrack);
            tracks.push(...youtubeTracks);

            if (tracks.length < config.limit) {
                const artistTracks = await this.#getYouTubeArtist(queue, lastTrack);
                tracks.push(...artistTracks);
            }
        }

        if (tracks.length === 0 && config.sources.youtube) {
            const youtubeTracks = await this.#getYouTubeSimilar(queue, lastTrack);
            tracks.push(...youtubeTracks);
        }

        return this.#filterAutoplayTracks(tracks, playedData, config);
    }

    #filterAutoplayTracks(
        tracks: Track[],
        playedData: { playedIds: Set<string>; playedTracks: Set<string> },
        config: AutoplayConfig,
    ): Track[] {
        return tracks
            .filter((track) => {
                if (!track.info) {
                    return false;
                }

                if (playedData.playedIds.has(track.info.identifier)) {
                    return false;
                }
                if (track.info.isrc && playedData.playedIds.has(track.info.isrc)) {
                    return false;
                }

                const key = `${track.info.title.toLowerCase()}|${track.info.author.toLowerCase()}`;
                if (playedData.playedTracks.has(key)) {
                    return false;
                }

                if (track.info.length) {
                    if (track.info.length < config.minDuration) {
                        return false;
                    }
                    if (track.info.length > config.maxDuration) {
                        return false;
                    }
                }

                const title = track.info.title.toLowerCase();
                for (const keyword of config.excludeKeywords) {
                    if (title.includes(keyword.toLowerCase())) {
                        return false;
                    }
                }

                return true;
            })
            .sort(() => Math.random() - 0.5)
            .slice(0, config.limit);
    }

    async #getSpotifyRecommendations(queue: Queue, track: Track): Promise<Track[]> {
        try {
            const query = `sprec:seed_tracks=${track.info.identifier}`;
            const result = (await queue.search(query)) as unknown as LoadResult;

            if (result.loadType === LoadType.Track || result.loadType === LoadType.Playlist) {
                if (result.loadType === LoadType.Track) {
                    return [result.data as unknown as Track];
                }
                return result.data.tracks as unknown as Track[];
            }
        } catch (error) {
            // Silent fail
        }
        return [];
    }

    async #getSpotifyArtistSearch(queue: Queue, track: Track): Promise<Track[]> {
        try {
            const query = `spsearch:${track.info.author}`;
            const result = (await queue.search(query)) as unknown as LoadResult;

            if (result.loadType === LoadType.Search && Array.isArray(result.data)) {
                return (result.data as unknown as Track[]).slice(0, 5);
            }
        } catch (error) {
            // Silent fail
        }
        return [];
    }

    async #getYouTubeSimilar(queue: Queue, track: Track): Promise<Track[]> {
        try {
            const query = `https://www.youtube.com/watch?v=${track.info.identifier}&list=RD${track.info.identifier}`;
            const result = (await queue.search(query)) as unknown as LoadResult;

            if (result.loadType === LoadType.Playlist && result.data && "tracks" in result.data) {
                return (result.data.tracks as unknown as Track[]).slice(0, 10);
            }
        } catch (error) {
            // Silent fail
        }
        return [];
    }

    async #getYouTubeArtist(queue: Queue, track: Track): Promise<Track[]> {
        try {
            const query = `ytsearch:${track.info.author}`;
            const result = (await queue.search(query)) as unknown as LoadResult;

            if (result.loadType === LoadType.Search && Array.isArray(result.data)) {
                return (result.data as unknown as Track[]).slice(0, 5);
            }
        } catch (error) {
            // Silent fail
        }
        return [];
    }
}
