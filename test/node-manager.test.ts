import { NodeManager } from '../src/node/NodeManager'
import { RyanlinkManager } from '../src/core/Manager'
import { RyanlinkNode } from '../src/node/Node'
import { NodeLinkNode } from '../src/node/NodeLink'
import { DestroyReasons, DisconnectReasons } from '../src/config/Constants'

describe('NodeManager', () => {
  let manager: RyanlinkManager
  let nodeManager: NodeManager

  beforeEach(() => {
    manager = new RyanlinkManager({
      nodes: [],
      client: { id: '123' },
      sendToShard: vi.fn(),
    })
    nodeManager = manager.nodeManager
  })

  it('creates and retrieves nodes', () => {
    const node = nodeManager.createNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'n1' })
    expect(node).toBeInstanceOf(RyanlinkNode)
    expect(nodeManager.nodes.has('n1')).toBe(true)
    
    // Retrieve existing
    const existing = nodeManager.createNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'n1' })
    expect(existing).toBe(node)

    // getNode
    expect(nodeManager.getNode('n1')).toBe(node)
    expect(nodeManager.getNode('n2')).toBeUndefined()
  })

  it('creates NodeLink nodes', () => {
    const node = nodeManager.createNode({ host: 'localhost', port: 2334, authorization: 'pw', nodeType: 'NodeLink', id: 'nl1' })
    expect(node).toBeInstanceOf(NodeLinkNode)
  })

  it('connects and disconnects all nodes', async () => {
    const n1 = nodeManager.createNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'n1' })
    const n2 = nodeManager.createNode({ host: 'localhost', port: 2334, authorization: 'pw', id: 'n2' })

    const connectSpy1 = vi.spyOn(n1, 'connect').mockResolvedValue({} as any)
    const connectSpy2 = vi.spyOn(n2, 'connect').mockResolvedValue({} as any)

    await nodeManager.connectAll()
    expect(connectSpy1).toHaveBeenCalled()
    expect(connectSpy2).toHaveBeenCalled()

    // Mock connected status
    // @ts-ignore
    n1.socket = { readyState: 1 }
    // @ts-ignore
    n2.socket = { readyState: 1 }

    const disconnectSpy1 = vi.spyOn(n1, 'disconnect').mockResolvedValue(undefined as any)
    const disconnectSpy2 = vi.spyOn(n2, 'disconnect').mockResolvedValue(undefined as any)

    await nodeManager.disconnectAll(false, false)
    expect(disconnectSpy1).toHaveBeenCalledWith(DisconnectReasons.DisconnectAllNodes)
    expect(disconnectSpy2).toHaveBeenCalledWith(DisconnectReasons.DisconnectAllNodes)
  })

  it('reconnects all nodes', async () => {
    const n = nodeManager.createNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'n1' })
    const destroySpy = vi.spyOn(n, 'destroy').mockResolvedValue(undefined as any)
    const connectSpy = vi.spyOn(n, 'connect').mockResolvedValue({} as any)

    await nodeManager.reconnectAll()
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.ReconnectAllNodes, false)
    expect(connectSpy).toHaveBeenCalled()
  })

  describe('leastUsedNodes', () => {
    let n1: RyanlinkNode, n2: RyanlinkNode

    beforeEach(() => {
      n1 = nodeManager.createNode({ host: 'localhost', port: 1, authorization: 'pw', id: 'low' })
      n2 = nodeManager.createNode({ host: 'localhost', port: 2, authorization: 'pw', id: 'high' })
      // @ts-ignore
      n1.socket = { readyState: 1 }
      // @ts-ignore
      n2.socket = { readyState: 1 }
      
      n1.stats = { players: 1, playingPlayers: 1, memory: { used: 100 }, cpu: { audioLoad: 0.1, systemLoad: 0.1 } } as any
      n2.stats = { players: 10, playingPlayers: 5, memory: { used: 1000 }, cpu: { audioLoad: 0.9, systemLoad: 0.9 } } as any
      n1.calls = 5
      n2.calls = 50
    })

    it('sorts by players (default)', () => {
      const nodes = nodeManager.leastUsedNodes()
      expect(nodes[0].id).toBe('low')
    })

    it('sorts by memory', () => {
      const nodes = nodeManager.leastUsedNodes('memory')
      expect(nodes[0].id).toBe('low')
    })

    it('sorts by cpuLavalink', () => {
      const nodes = nodeManager.leastUsedNodes('cpuLavalink')
      expect(nodes[0].id).toBe('low')
    })

    it('sorts by cpuSystem', () => {
      const nodes = nodeManager.leastUsedNodes('cpuSystem')
      expect(nodes[0].id).toBe('low')
    })

    it('sorts by calls', () => {
      const nodes = nodeManager.leastUsedNodes('calls')
      expect(nodes[0].id).toBe('low')
    })

    it('sorts by playingPlayers', () => {
      const nodes = nodeManager.leastUsedNodes('playingPlayers')
      expect(nodes[0].id).toBe('low')
    })
  })

  it('deletes nodes', () => {
    const n = nodeManager.createNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'n1' })
    const destroySpy = vi.spyOn(n, 'destroy').mockResolvedValue(undefined as any)
    
    nodeManager.deleteNode('n1')
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.NodeDeleted, true, false)
    expect(nodeManager.nodes.has('n1')).toBe(false)
  })

  it('throws on invalid disconnect/connect calls', async () => {
    expect(nodeManager.disconnectAll()).rejects.toThrow('no nodes')
    expect(nodeManager.connectAll()).rejects.toThrow('no nodes')
    expect(nodeManager.reconnectAll()).rejects.toThrow('no nodes')
  })
})
