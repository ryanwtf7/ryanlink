import { expect } from 'vitest'
import type { RyanlinkNode } from '../src/node/Node'
import type { Player } from '../src/audio/Player'

export async function waitForNode(node: RyanlinkNode, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (node.connected && node.sessionId) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Timeout waiting for node ${node.id} to be ready`)
}

export async function waitForPlayer(player: Player, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (player.connected) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Timeout waiting for player ${player.guildId} to be ready`)
}
