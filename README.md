<div align="center">
  <img alt="ryanlink" src="assets/ryanlink.png" width="120" />

  # Ryanlink

  High-performance Lavalink v4 wrapper for Discord bots.

  <br/>

  [![NPM Version](https://img.shields.io/npm/v/ryanlink?style=flat&logo=npm)](https://www.npmjs.com/package/ryanlink)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
  [![Node Version](https://img.shields.io/node/v/ryanlink)](https://nodejs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)

  [Documentation](https://ryanwtf7.github.io/ryanlink/) • [NPM](https://www.npmjs.com/package/ryanlink) • [GitHub](https://github.com/ryanwtf7/ryanlink)
</div>

---

## Installation

```bash
npm install ryanlink
# or
bun add ryanlink
```

## Quick Start

```typescript
import { Client, GatewayIntentBits } from 'discord.js'
import { RyanlinkManager } from 'ryanlink'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
})

const manager = new RyanlinkManager({
  nodes: [{
    id: 'main',
    host: 'localhost',
    port: 2333,
    authorization: 'youshallnotpass',
  }],
  sendToShard: (guildId, payload) => {
    client.guilds.cache.get(guildId)?.shard?.send(payload)
  },
  client: { id: process.env.CLIENT_ID },
})

client.once('ready', () => manager.init({ id: client.user.id }))
client.on('raw', (packet) => manager.provideVoiceUpdate(packet))
client.login('YOUR_BOT_TOKEN')
```

## Usage

```typescript
// Create player and connect
const player = manager.createPlayer({
  guildId: interaction.guildId,
  voiceChannelId: interaction.member.voice.channelId,
  textChannelId: interaction.channelId,
  selfDeaf: true,
})
await player.connect()

// Search and play
const result = await manager.search({ query: 'never gonna give you up', source: 'ytsearch' }, interaction.user)
player.queue.add(result.tracks[0])
if (!player.playing) await player.play()

// Controls
await player.pause(true)
await player.pause(false)
await player.seek(30000)
await player.skip()
await player.setVolume(80)
await player.setRepeatMode('queue') // 'off' | 'track' | 'queue'

// Filters
await player.filterManager.toggleNightcore()
await player.filterManager.setSpeed(1.2)
await player.filterManager.setEQ(player.filterManager.constructor.EQList.BassboostHigh)
await player.filterManager.resetFilters()
```

## Requirements

- **Node.js** 18+ or **Bun** 1.1+
- **Lavalink** 4.0+

## License

[Apache-2.0](LICENSE)

<div align="center">
  Made with care by RY4N
</div>
