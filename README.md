<div align="center">
  <img alt="Ryanlink" src="assets/ryanlink.jpeg" width="120" />
  
  <br/>
  [API Reference](https://ryanwtf7.github.io/ryanlink) | [Coverage](http://app.codecov.io/gh/ryanwtf7/ryanlink)

![NPM Version](https://img.shields.io/npm/v/ryanlink?style=flat&logo=npm)
![Codecov Coverage](https://img.shields.io/codecov/c/github/ryanwtf7/ryanlink?label=codecov&logo=codecov)

</div>

## 🎯 Purpose

The goal of this library is to abstract away obvious steps involved in the process of acting as an intermediary between [Lavalink](https://lavalink.dev/api) and [Discord](https://discord.com/developers/docs/events/gateway) to give developers a cleaner and intuitive interface to work with.

## 🙌 Motivation

Built with a unique feature-based architecture and professional audio engineering features. Ryanlink provides 17 professional EQ presets, advanced queue operations, and powerful extensions while maintaining clean, intuitive APIs. **This project follows SemVer and an Agile SDLC**.

## ⚙️ Requirements

- **Runtime** - one of the following:
  - [Node.js](https://nodejs.org) v18+
  - [Bun](https://bun.com) v1+
  - [Deno](https://deno.com) v1.30+
- **Library** - any gateway client that supports:
  - sending raw payloads over the connection
  - receiving raw payloads from the connection

## 📝 Implementation

### Examples

<details>
<summary>Basic Setup - JavaScript (ESM)</summary>

```js
import { Client } from "main-lib";
import { RyanlinkPlayer } from "ryanlink";

const client = new Client(...);

const player = new RyanlinkPlayer({
  nodes: [], // add your nodes
  async forwardVoiceUpdate(guildId, payload) {
    // send the given payload to your gateway connection
    client.guilds.cache.get(guildId).shard.send(payload);
  }
});

client.on("raw", (payload) => {
  // call the handler on gateway dispatch
  player.voices.handleDispatch(payload);
});

client.login();
```

</details>

<details>
<summary>Module Augmentation - TypeScript</summary>

```ts
declare module "ryanlink" {
  interface QueueContext {
    textId: string;
  }

  interface CommonUserData {
    id: string;
    username: string;
    displayName: string;
  }

  interface CommonPluginInfo {
    save_uri?: string;
  }

  interface CommonPluginFilters {
    custom: string;
  }
}
```

</details>

<details>
<summary>Custom Plugin (with events) - TypeScript</summary>

```ts
import { PlayerPlugin, type RyanlinkPlayer } from "ryanlink";

export class CustomPlugin extends PlayerPlugin<{
  event: [a: string, b: object];
}> {
  readonly name = "custom"; // 'readonly' is mandatory
  #player!: RyanlinkPlayer; // optional, just for convenience

  init(player: RyanlinkPlayer) {
    this.#player = player;
    player.on("nodeDispatch", this.#onDispatch);
  }

  #onDispatch(this: RyanlinkPlayer, ...args: unknown[]) {
    // work with data
    // e.g. transform -> name event -> dispatch
  }
}
```

</details>

<details>
<summary>EQ Presets - Professional Audio Enhancement</summary>

```ts
// Ryanlink includes 17 professional EQ presets
await queue.filters.setEQPreset("BassboostHigh");
await queue.filters.setEQPreset("Rock");
await queue.filters.setEQPreset("Nightcore");
await queue.filters.setEQPreset("Electronic");

// Get all available presets
const presets = queue.filters.getEQPresetNames();
// ["BassboostEarrape", "BassboostHigh", "BassboostMedium", "BassboostLow",
//  "Rock", "Classic", "Pop", "Electronic", "Gaming", "Nightcore",
//  "Vaporwave", "TrebleBass", "HighQuality", "BetterMusic", "FullSound",
//  "Soft", "TV", "Radio", "Normalization"]
```

</details>

<details>
<summary>Advanced Queue Operations</summary>

```ts
// Sort tracks by duration, title, or custom comparator
await queue.sortBy("duration", "desc");
await queue.sortBy("title", "asc");
await queue.sortBy((a, b) => a.duration - b.duration);

// Filter tracks with flexible predicates
const longTracks = queue.filterTracks({
  duration: { min: 180000 }, // 3+ minutes
});

// Move, splice, and manipulate queue
await queue.move(3, 0); // Move track at index 3 to position 0
await queue.splice(2, 1, newTrack); // Remove 1 track at index 2, add newTrack
```

</details>

### Additional Notes

- Handle track end reasons other than `cleanup` and `finished`
- Handle voice states carefully, e.g. `reconnecting`, `changingNode`, etc.
- Handle queue destruction/relocation, e.g. guild/channel delete, node close/disconnect, etc.

### Session Resumption

Resuming a node's session after your bot restarts requires careful planning, depending on scale. As such, the lib has no plans to provide built-in support for it. Disable both `autoSync` and `relocateQueues` for predictable behavior if you're implementing this feature.

## 🤝 Acknowledgements

Key aspects of this lib were inspired from the following projects:

- [`distube`](https://github.com/skick1234/DisTube) player-queue design
- [`discord.js`](https://github.com/discordjs/discord.js) manager-cache concept
- [`Hoshimi`](https://github.com/Ganyu-Studios/Hoshimi) module augmentation (typings)
- [`discolink`](https://github.com/execaman/discolink) architecture patterns
