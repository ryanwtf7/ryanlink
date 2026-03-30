<div align="center">
  <img alt="ryanlink" src="assets/ryanlink.png" width="120" />
  
  # Ryanlink
  
  A modern, high-performance audio client for Node.js, Bun, and Deno.
  
  <br/>
  
  [![NPM Version](https://img.shields.io/npm/v/ryanlink?style=flat&logo=npm)](https://www.npmjs.com/package/ryanlink)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
  [![Node Version](https://img.shields.io/node/v/ryanlink)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
  [![Codecov Coverage](https://img.shields.io/codecov/c/github/ryanwtf7/ryanlink?label=codecov&logo=codecov)](https://discord.gg/W2GheK3F9m)
  
  [Documentation](https://ryanwtf7.github.io/ryanlink/) • [NPM Package](https://www.npmjs.com/package/ryanlink) • [Coverage](http://app.codecov.io/gh/ryanwtf7/ryanlink) • [GitHub](https://github.com/ryanwtf7/ryanlink)

</div>

---

## Overview

**Ryanlink** is a premium, feature-rich lavalink-v4 wrapper designed for speed, flexibility, and developer experience. It provides a robust architecture for Discord music bots with first-class TypeScript support and cross-runtime compatibility.

### Key Features

- **Lavalink v4 Protocol** - Full support for the latest lavalink features, filters, and SponsorBlock.
- **Cross-Runtime Ready** - Optimized for **Node.js**, **Bun**, and **Deno**.
- **Advanced Queue Persistence** - Built-in drivers for **Redis**, **Local Disk**, and **In-Memory** storage.
- **High-Performance Audio** - Native fetch, efficient memory management, and parallel track loading.
- **Dynamic Filter Stacking** - Non-destructive filter layering with built-in presets (**Hardcore**, **Nightcore**, etc.).
- **Proactive Automation** - Smart auto-pause/resume, empty channel handling, and resolution self-healing.
- **Memory-Optimized Registry** - Industry-leading `TrackRegistry` for zero-overhead large queue management.
- **Strictly Type-Safe** - 100% TypeScript with advanced module augmentation support.

---

## Smart Engine

Introduces a **Proactive Smart Layer** that reduces developer boilerplate by automating session and queue management.

- **Zero-Config Persistence** — Automated queue saving and millisecond-precise session recovery across bot restarts.
- **Atomic Migration** — Seamless node failover during disconnections with zero audio interruption for your users.
- **TrackRegistry** — Memory-optimized reference mapping for handling massive queues (10k+ tracks) with minimal RAM overhead.
- **Self-Healing Resolution** — Automated retry logic for unresolved tracks, ensuring playback stability even with flaky external sources.
- **Smart Context Hooks** — Integrated `onTrackStart`, `onQueueEnd`, and `onNodeFailover` hooks for rapid, reliable development.

---

## Installation

```bash
# npm
npm install ryanlink

# bun
bun add ryanlink

# pnpm
pnpm add ryanlink
```

---

## Quick Start

```typescript
import { Client, GatewayIntentBits } from 'discord.js'
import { RyanlinkManager } from 'ryanlink'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
})

client.ryanlink = new RyanlinkManager({
  nodes: [
    {
      name: 'main',
      host: 'localhost',
      port: 2333,
      authorization: 'youshallnotpass',
      secure: false,
    },
  ],
  sendToShard: (guildId, payload) => {
    client.guilds.cache.get(guildId)?.shard.send(payload)
  },
  client: {
    id: process.env.CLIENT_ID,
    username: 'RyanlinkBot',
  },
})

client.on('ready', () => {
  client.ryanlink.init({ ...client.user })
  console.log(`${client.user.tag} is online and connected to ryanlink`)
})

client.on('raw', (packet) => {
  client.ryanlink.provideVoiceUpdate(packet)
})

client.login('YOUR_BOT_TOKEN')
```

---

## Core Usage

### Playing Audio

```typescript
const player = client.ryanlink.createPlayer({
  guildId: interaction.guildId,
  voiceChannelId: interaction.member.voice.channelId,
  textChannelId: interaction.channelId,
})

const res = await player.search('Never Gonna Give You Up', interaction.user)
player.queue.add(res.tracks[0])

if (!player.playing) await player.play()

console.log(`Added: ${res.tracks[0].info.title}`)
```

### Queue Controls

```typescript
const player = client.ryanlink.players.get(guildId)

await player.pause()
await player.resume()
await player.skip()
await player.setVolume(50) // 0 - 100
player.setRepeatMode('queue') // "off" | "track" | "queue"
```

### Lifecycle Hooks

```typescript
const player = client.ryanlink.createPlayer({
  guildId: '...',
  voiceChannelId: '...',
  // Smart Engine Hooks
  onTrackStart: (p, track) => console.log(`Now playing: ${track.info.title}`),
  onQueueEnd: (p) => console.log('Queue has finished!'),
  onNodeFailover: (p, oldNode, targetNode) => console.log(`Migrated to ${targetNode.id}`),
})
```

### Audio Filters

```typescript
// Apply Professional EQ Presets
await player.filterManager.setPreset('BassBoost') // or 'Pop', 'Electronic', etc.

// Apply Immersive DSP Presets
await player.filterManager.setPreset('8D') // 360° Rotation
await player.filterManager.setPreset('Lofi') // Chill, Low-Fi vibes
await player.filterManager.setPreset('Radio') // Broadcast simulation

// Reset all filters atomically
await player.filterManager.setPreset('Clear')
```
```

---

## Diagnostic Metadata

Access library information dynamically:

```typescript
import { version } from 'ryanlink'

console.log(`Ryanlink v${version}`)
```

---

## Architecture

Ryanlink is organized into modular features for maximum maintainability:

- `src/` - Core library source files including:
  - `core/Manager.ts` - Main entry point
  - `node/Node.ts` - Connection and REST interfaces
  - `audio/Player.ts` - Audio playback and queue controller
  - `audio/Queue.ts` - Advanced track management

---

## Requirements

- **Lavalink**: 4.0.0+
- **Node.js**: 18.0.0+ (Support for Bun/Deno)
- **TypeScript**: 5.4+ (Standardized)

---

## License

Licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for more information.

<div align="center">
  Made with care by RY4N
</div>
