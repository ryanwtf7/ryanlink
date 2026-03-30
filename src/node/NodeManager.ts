import { EventEmitter } from 'node:events'

import { DestroyReasons, DisconnectReasons } from '../config/Constants'
import type { RyanlinkManager } from '../core/Manager'
import { RyanlinkNode } from './Node'
import { NodeLinkNode } from './NodeLink'
import type { RyanlinkNodeIdentifier, NodeConfiguration, NodeManagerEvents } from '../types/Node'
import { MiniMap } from '../utils/Utils'

export class NodeManager extends EventEmitter {
  emit<Event extends keyof NodeManagerEvents>(event: Event, ...args: Parameters<NodeManagerEvents[Event]>): boolean {
    return super.emit(event, ...args)
  }

  on<Event extends keyof NodeManagerEvents>(event: Event, listener: NodeManagerEvents[Event]): this {
    return super.on(event, listener)
  }

  once<Event extends keyof NodeManagerEvents>(event: Event, listener: NodeManagerEvents[Event]): this {
    return super.once(event, listener)
  }

  off<Event extends keyof NodeManagerEvents>(event: Event, listener: NodeManagerEvents[Event]): this {
    return super.off(event, listener)
  }

  removeListener<Event extends keyof NodeManagerEvents>(event: Event, listener: NodeManagerEvents[Event]): this {
    return super.removeListener(event, listener)
  }

  public RyanlinkManager: RyanlinkManager

  public nodes = new MiniMap<string, RyanlinkNode | NodeLinkNode>()

  constructor(RyanlinkManager: RyanlinkManager) {
    super()
    this.RyanlinkManager = RyanlinkManager

    if (this.RyanlinkManager.options.nodes)
      this.RyanlinkManager.options.nodes.forEach((node) => {
        this.createNode(node)
      })
  }

  public async disconnectAll(deleteAllNodes = false, destroyPlayers = true) {
    if (!this.nodes.size) throw new Error('There are no nodes to disconnect (no nodes in the nodemanager)')
    if (!this.nodes.filter((v) => v.connected).size) throw new Error('There are no nodes to disconnect (all nodes disconnected)')
    let counter = 0
    for (const node of this.nodes.values()) {
      if (!node.connected) continue
      if (destroyPlayers) {
        await node.destroy(DestroyReasons.DisconnectAllNodes, deleteAllNodes)
      } else {
        await node.disconnect(DisconnectReasons.DisconnectAllNodes)
      }
      counter++
    }
    return counter
  }

  public async connectAll(): Promise<number> {
    if (!this.nodes.size) throw new Error('There are no nodes to connect (no nodes in the nodemanager)')
    if (!this.nodes.filter((v) => !v.connected).size) throw new Error('There are no nodes to connect (all nodes connected)')
    let counter = 0
    for (const node of this.nodes.values()) {
      if (node.connected) continue
      await node.connect()
      counter++
    }
    return counter
  }

  public async reconnectAll(): Promise<number> {
    if (!this.nodes.size) throw new Error('There are no nodes to reconnect (no nodes in the nodemanager)')
    let counter = 0
    for (const node of this.nodes.values()) {
      const sessionId = node.sessionId ? `${node.sessionId}` : undefined
      await node.destroy(DestroyReasons.ReconnectAllNodes, false)
      await node.connect(sessionId)
      counter++
    }
    return counter
  }

  public createNode<T extends RyanlinkNode | NodeLinkNode>(options: NodeConfiguration): T {
    if (this.nodes.has(options.id || `${options.host}:${options.port}`)) return this.nodes.get(options.id || `${options.host}:${options.port}`) as T
    const newNode = options.nodeType === 'NodeLink' ? new NodeLinkNode(options, this) : new RyanlinkNode(options, this)
    this.nodes.set(newNode.id, newNode)
    return newNode as T
  }

  public leastUsedNodes(
    sortType: 'memory' | 'cpuLavalink' | 'cpuSystem' | 'calls' | 'playingPlayers' | 'players' | 'weighted' = 'players'
  ): RyanlinkNode[] {
    const connectedNodes = Array.from(this.nodes.values()).filter((node) => node.connected)
    switch (sortType) {
      case 'memory':
        {
          return connectedNodes.sort((a, b) => (a.stats?.memory?.used || 0) - (b.stats?.memory?.used || 0))
        }
        break
      case 'cpuLavalink':
        {
          return connectedNodes.sort((a, b) => (a.stats?.cpu?.audioLoad || 0) - (b.stats?.cpu?.audioLoad || 0))
        }
        break
      case 'cpuSystem':
        {
          return connectedNodes.sort((a, b) => (a.stats?.cpu?.systemLoad || 0) - (b.stats?.cpu?.systemLoad || 0))
        }
        break
      case 'calls':
        {
          return connectedNodes.sort((a, b) => a.calls - b.calls)
        }
        break
      case 'playingPlayers':
        {
          return connectedNodes.sort((a, b) => (a.stats?.playingPlayers || 0) - (b.stats?.playingPlayers || 0))
        }
        break
      case 'weighted':
        {
          return (connectedNodes as RyanlinkNode[]).sort((a, b) => a.weightedScore - b.weightedScore)
        }
        break
      case 'players':
      default:
        {
          return connectedNodes.sort((a, b) => (a.stats?.players || 0) - (b.stats?.players || 0))
        }
        break
    }
  }

  public deleteNode(node: RyanlinkNodeIdentifier | RyanlinkNode | NodeLinkNode, movePlayers: boolean = false): void {
    const decodeNode = typeof node === 'string' ? this.nodes.get(node) : node
    if (!(decodeNode instanceof RyanlinkNode)) throw new RangeError("nodeManager.deleteNode: The node you provided is not valid or doesn't exist.")
    if (typeof movePlayers !== 'boolean') throw new TypeError('nodeManager.deleteNode: movePlayers must be a boolean')
    decodeNode.destroy(DestroyReasons.NodeDeleted, true, movePlayers)
    this.nodes.delete(decodeNode.id)
    return
  }

  public getNode(node: RyanlinkNodeIdentifier | RyanlinkNode | NodeLinkNode): RyanlinkNode | NodeLinkNode | undefined {
    const decodeNode = typeof node === 'string' ? this.nodes.get(node) : node
    if (!decodeNode) return undefined
    if (decodeNode.nodeType === 'NodeLink') return decodeNode as NodeLinkNode
    return decodeNode as RyanlinkNode
  }
}
