<div align="center">
  <img alt="Ryanlink" src="assets/ryanlink.jpeg" width="120" />
  
  # Ryanlink
  
  A modern, feature-rich Lavalink client for Node.js with TypeScript support
  
  <br/>
  
  [![NPM Version](https://img.shields.io/npm/v/ryanlink?style=flat&logo=npm)](https://www.npmjs.com/package/ryanlink)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
  [![Node Version](https://img.shields.io/node/v/ryanlink)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
  [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/ryanwtf7/ryanlink/coverage.yml?branch=master&label=tests)](https://github.com/ryanwtf7/ryanlink/actions)
  
  [Documentation](https://ryanwtf7.github.io/ryanlink) • [NPM Package](https://www.npmjs.com/package/ryanlink) • [GitHub](https://github.com/ryanwtf7/ryanlink)

</div>

---

## Overview

Ryanlink is a powerful Lavalink client library designed to simplify music bot development for Discord. Built with modern TypeScript and featuring a unique architecture, it provides an intuitive interface for managing audio playback, queues, and advanced audio processing.

### Key Features

- **Modern Lavalink v4 Support** - Full compatibility with the latest Lavalink API
- **Cross-Runtime Compatibility** - Works seamlessly with Node.js, Bun, and Deno
- **Professional Audio Processing** - 17 built-in EQ presets for instant audio enhancement
- **Advanced Queue Management** - Sort, filter, search, and manipulate tracks with ease
- **Powerful Extensions System** - Autoplay, Lyrics, SponsorBlock, FairPlay, and Persistence
- **Type-Safe** - Complete TypeScript definitions with full IntelliSense support
- **Production Ready** - Comprehensive error handling, automatic reconnection, and session management
- **Flexible Architecture** - Feature-based organization for better maintainability

### Supported Platforms

Ryanlink supports audio from 20+ streaming platforms through LavaSrc integration:

<div align="center">

| Platform     | Support | Platform  | Support | Platform     | Support |
| ------------ | ------- | --------- | ------- | ------------ | ------- |
| YouTube      | ✓       | Spotify   | ✓       | Apple Music  | ✓       |
| SoundCloud   | ✓       | Deezer    | ✓       | Tidal        | ✓       |
| Bandcamp     | ✓       | Twitch    | ✓       | Amazon Music | ✓       |
| Yandex Music | ✓       | JioSaavn  | ✓       | Pandora      | ✓       |
| Qobuz        | ✓       | Audiomack | ✓       | Mixcloud     | ✓       |
| Anghami      | ✓       | Audius    | ✓       | Gaana        | ✓       |
| Instagram    | ✓       | Shazam    | ✓       | Direct URLs  | ✓       |

</div>

## Installation

```bash
# npm
npm install ryanlink

# yarn
yarn add ryanlink

# pnpm
pnpm add ryanlink

# bun
bun add ryanlink
```

### Deno

```typescript
import { RyanlinkPlayer } from "npm:ryanlink@latest";
```

## Quick Start

```typescript
import { Client } from "discord.js";
import { RyanlinkPlayer } from "ryanlink";

const client = new Client({ intents: ["Guilds", "GuildVoiceStates"] });

const player = new RyanlinkPlayer({
    nodes: [
        {
            name: "main",
            host: "localhost",
            port: 2333,
            password: "youshallnotpass",
            secure: false,
        },
    ],
    forwardVoiceUpdate: async (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
});

client.on("ready", async () => {
    await player.init(client.user.id);
    console.log(`${client.user.tag} is ready!`);
});

client.on("raw", (packet) => {
    player.voices.handleDispatch(packet);
});

client.login("YOUR_BOT_TOKEN");
```

## Core Concepts

### Playing Music

```typescript
// Play from URL or search query
const queue = await player.play("Never Gonna Give You Up", {
    guildId: interaction.guildId,
    voiceId: interaction.member.voice.channelId,
    textId: interaction.channelId,
});

// Play from direct URL
await player.play("https://open.spotify.com/track/...", {
    guildId: interaction.guildId,
    voiceId: interaction.member.voice.channelId,
});

// Search with specific source
const results = await player.search("ytsearch:Rick Astley");
```

### Queue Management

```typescript
const queue = player.getQueue(guildId);

// Basic controls
await queue.pause();
await queue.resume();
await queue.stop();
await queue.skip();
await queue.previous();

// Volume control
await queue.setVolume(0.5); // 50%

// Repeat modes
await queue.setRepeatMode("track"); // Repeat current track
await queue.setRepeatMode("queue"); // Repeat entire queue
await queue.setRepeatMode("off"); // No repeat

// Shuffle
await queue.shuffle();
await queue.shuffle(true); // Include previous tracks

// Seek
await queue.seek(60000); // Seek to 1 minute
```

### Advanced Queue Operations

```typescript
// Sort tracks
await queue.sortBy("duration", "desc");
await queue.sortBy("title", "asc");
await queue.sortBy((a, b) => a.duration - b.duration);

// Filter tracks
const longTracks = queue.filterTracks({
    duration: { min: 180000 }, // 3+ minutes
});

const rockTracks = queue.filterTracks({
    title: "rock",
});

// Find specific track
const track = queue.findTrack({ title: "Never Gonna" });

// Move tracks
await queue.move(5, 0); // Move track at index 5 to front

// Remove tracks
await queue.remove(3); // Remove track at index 3

// Get track range
const nextTen = queue.getTracks(0, 10);
```

### Audio Filters

```typescript
// Apply EQ preset
await queue.filters.setEQPreset("BassboostHigh");
await queue.filters.setEQPreset("Rock");
await queue.filters.setEQPreset("Nightcore");

// Get available presets
const presets = queue.filters.getEQPresetNames();
// ["BassboostEarrape", "BassboostHigh", "BassboostMedium", "BassboostLow",
//  "Rock", "Classic", "Pop", "Electronic", "Gaming", "Nightcore",
//  "Vaporwave", "TrebleBass", "HighQuality", "BetterMusic", "FullSound",
//  "Soft", "TV", "Radio", "Normalization"]

// Custom filters
await queue.filters.apply({
    equalizer: [
        { band: 0, gain: 0.2 },
        { band: 1, gain: 0.15 },
    ],
    timescale: { speed: 1.5, pitch: 1.2 },
    volume: 1.0,
});

// Individual filter control
await queue.filters.set("timescale", { speed: 1.5 });
await queue.filters.delete("timescale");
await queue.filters.clear();
```

## Extensions

### Autoplay Extension

Automatically plays related tracks when the queue ends.

```typescript
import { AutoplayExtension } from "ryanlink";

const player = new RyanlinkPlayer({
    plugins: [
        new AutoplayExtension({
            enabled: true,
            maxHistory: 50,
            sources: {
                spotify: true,
                youtube: true,
                youtubemusic: true,
                soundcloud: false,
            },
        }),
    ],
});
```

### Lyrics Extension

Fetch synchronized lyrics from multiple sources.

```typescript
import { LyricsExtension } from "ryanlink";

const player = new RyanlinkPlayer({
    plugins: [
        new LyricsExtension({
            sources: ["lrclib", "genius", "musixmatch"],
            cache: true,
        }),
    ],
});

// Get lyrics
const lyrics = await queue.getLyrics();
```

### SponsorBlock Extension

Skip sponsored segments in YouTube videos.

```typescript
import { SponsorBlockExtension } from "ryanlink";

const player = new RyanlinkPlayer({
    plugins: [
        new SponsorBlockExtension({
            categories: ["sponsor", "intro", "outro", "selfpromo"],
            autoSkip: true,
        }),
    ],
});
```

### FairPlay Extension

Limit tracks per user for fair queue distribution.

```typescript
import { FairPlayExtension } from "ryanlink";

const player = new RyanlinkPlayer({
    plugins: [
        new FairPlayExtension({
            maxPerUser: 3,
            enforceLimit: true,
        }),
    ],
});
```

### Persistence Extension

Save and restore queues across bot restarts.

```typescript
import { PersistenceExtension } from "ryanlink";

const player = new RyanlinkPlayer({
    plugins: [
        new PersistenceExtension({
            autoSave: true,
            saveInterval: 60000, // 1 minute
        }),
    ],
});
```

## Events

```typescript
// Track events
player.on("trackStart", (queue, track) => {
    console.log(`Now playing: ${track.title}`);
});

player.on("trackFinish", (queue, track, reason) => {
    console.log(`Finished: ${track.title} (${reason})`);
});

player.on("trackError", (queue, track, error) => {
    console.error(`Error: ${error.message}`);
});

player.on("trackStuck", (queue, track, threshold) => {
    console.warn(`Track stuck: ${track.title}`);
});

// Queue events
player.on("queueCreate", (queue) => {
    console.log(`Queue created for guild ${queue.guildId}`);
});

player.on("queueFinish", (queue) => {
    console.log("Queue finished!");
});

player.on("queueDestroy", (queue, reason) => {
    console.log(`Queue destroyed: ${reason}`);
});

// Node events
player.on("nodeConnect", (node, reconnects) => {
    console.log(`Node ${node.name} connected`);
});

player.on("nodeReady", (node, resumed, sessionId) => {
    console.log(`Node ${node.name} ready`);
});

player.on("nodeDisconnect", (node, code, reason) => {
    console.log(`Node ${node.name} disconnected`);
});

player.on("nodeError", (node, error) => {
    console.error(`Node error: ${error.message}`);
});
```

## TypeScript Support

Ryanlink is built with TypeScript and provides complete type definitions.

### Module Augmentation

Extend types for custom data:

```typescript
declare module "ryanlink" {
    interface QueueContext {
        textChannelId: string;
        requesterId: string;
    }

    interface CommonUserData {
        id: string;
        username: string;
        requestedAt: number;
    }

    interface CommonPluginInfo {
        customField?: string;
    }
}
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher
- **Deno**: 1.30.0 or higher
- **Lavalink**: 4.0.0 or higher

## Architecture

Ryanlink uses a feature-based architecture for better organization:

```
src/
├── core/          # Player and plugin system
├── lavalink/      # Lavalink connection and HTTP client
├── audio/         # Queue, tracks, and filters
├── voice/         # Voice connection management
├── extensions/    # Built-in extensions
├── config/        # Configuration and constants
├── utils/         # Utility functions
└── types/         # TypeScript definitions
```

## Performance

- **Efficient Memory Usage** - Optimized data structures and caching
- **Fast Track Loading** - Parallel track resolution
- **Minimal Overhead** - Native fetch API, no unnecessary dependencies
- **Smart Reconnection** - Automatic recovery with exponential backoff

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

Ryanlink was inspired by and builds upon concepts from:

- [distube](https://github.com/skick1234/DisTube) - Player-queue design patterns
- [discord.js](https://github.com/discordjs/discord.js) - Manager-cache architecture
- [Hoshimi](https://github.com/Ganyu-Studios/Hoshimi) - Module augmentation patterns
- [discolink](https://github.com/execaman/discolink) - Modern Lavalink client design

## Support

- [Documentation](https://ryanwtf7.github.io/ryanlink)
- [GitHub Issues](https://github.com/ryanwtf7/ryanlink/issues)
- [GitHub Discussions](https://github.com/ryanwtf7/ryanlink/discussions)

---

<div align="center">
  Made with ❤️ by RY4N
</div>
