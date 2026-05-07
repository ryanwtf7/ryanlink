import { RyanlinkManager, RyanlinkNode } from '../src'
import { NodeManager } from '../src/node/NodeManager'

function makeManager(nodes: any[] = []) {
  return new RyanlinkManager({ nodes, client: { id: '1' }, sendToShard: () => {} })
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1, close: jest.fn(), removeAllListeners: jest.fn() }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  return node
}

describe('NodeManager', () => {
  let manager: RyanlinkManager
  let nm: NodeManager

  beforeEach(() => {
    manager = makeManager()
    nm = manager.nodeManager
  })

  it('instantiates with empty nodes', () => {
    expect(nm.nodes.size).toBe(0)
  })

  it('RyanlinkManager getter returns manager', () => {
    expect(nm.RyanlinkManager).toBe(manager)
  })

  it('createNode() creates a RyanlinkNode', () => {
    const node = nm.createNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' })
    expect(node).toBeInstanceOf(RyanlinkNode)
    expect(nm.nodes.has('n1')).toBe(true)
  })

  it('createNode() returns existing node if already exists', () => {
    const n1 = nm.createNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' })
    const n2 = nm.createNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' })
    expect(n1).toBe(n2)
  })

  it('createNode() uses host:port as id when no id provided', () => {
    const node = nm.createNode({ host: 'myhost', port: 9999, authorization: 'pw' } as any)
    expect(nm.nodes.has('myhost:9999')).toBe(true)
  })

  it('getNode() returns node by string id', () => {
    makeConnectedNode(manager, 'n1')
    const node = nm.getNode('n1')
    expect(node).toBeDefined()
    expect(node.id).toBe('n1')
  })

  it('getNode() returns node by node object', () => {
    const node = makeConnectedNode(manager, 'n1')
    expect(nm.getNode(node)).toBe(node)
  })

  it('getNode() returns undefined for unknown id', () => {
    expect(nm.getNode('nonexistent')).toBeUndefined()
  })

  it('toJSON() returns node count and keys', () => {
    makeConnectedNode(manager, 'n1')
    makeConnectedNode(manager, 'n2')
    const json = nm.toJSON()
    expect(json.nodeCount).toBe(2)
    expect(json.nodes).toContain('n1')
    expect(json.nodes).toContain('n2')
  })

  it('leastUsedNodes() returns empty array when no connected nodes', () => {
    nm.createNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' })
    expect(nm.leastUsedNodes()).toEqual([])
  })

  it('leastUsedNodes() sorts by players (default)', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.players = 5
    n2.stats.players = 2
    const sorted = nm.leastUsedNodes('players')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by memory', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.memory.used = 100
    n2.stats.memory.used = 50
    const sorted = nm.leastUsedNodes('memory')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by cpuLavalink', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.cpu.audioLoad = 0.8
    n2.stats.cpu.audioLoad = 0.2
    const sorted = nm.leastUsedNodes('cpuLavalink')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by cpuSystem', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.cpu.systemLoad = 0.9
    n2.stats.cpu.systemLoad = 0.1
    const sorted = nm.leastUsedNodes('cpuSystem')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by calls', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.calls = 10
    n2.calls = 3
    const sorted = nm.leastUsedNodes('calls')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by playingPlayers', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.playingPlayers = 4
    n2.stats.playingPlayers = 1
    const sorted = nm.leastUsedNodes('playingPlayers')
    expect(sorted[0].id).toBe('n2')
  })

  it('leastUsedNodes() sorts by weighted', () => {
    const n1 = makeConnectedNode(manager, 'n1')
    const n2 = makeConnectedNode(manager, 'n2')
    n1.stats.cpu.systemLoad = 0.9
    n2.stats.cpu.systemLoad = 0.1
    const sorted = nm.leastUsedNodes('weighted')
    expect(sorted[0].id).toBe('n2')
  })

  it('deleteNode() throws for invalid node', () => {
    expect(() => nm.deleteNode('nonexistent')).toThrow()
  })

  it('deleteNode() throws for non-boolean movePlayers', () => {
    const node = makeConnectedNode(manager, 'n1')
    expect(() => nm.deleteNode(node, 'yes' as any)).toThrow()
  })

  it('deleteNode() removes node', () => {
    const node = makeConnectedNode(manager, 'n1')
    // @ts-ignore
    node.destroy = jest.fn()
    nm.deleteNode(node)
    expect(nm.nodes.has('n1')).toBe(false)
  })

  it('disconnectAll() throws when no nodes', async () => {
    await expect(nm.disconnectAll()).rejects.toThrow()
  })

  it('disconnectAll() throws when all nodes disconnected', async () => {
    nm.createNode({ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' })
    await expect(nm.disconnectAll()).rejects.toThrow()
  })

  it('connectAll() throws when no nodes', async () => {
    await expect(nm.connectAll()).rejects.toThrow()
  })

  it('connectAll() throws when all nodes already connected', async () => {
    makeConnectedNode(manager, 'n1')
    await expect(nm.connectAll()).rejects.toThrow()
  })

  it('reconnectAll() throws when no nodes', async () => {
    await expect(nm.reconnectAll()).rejects.toThrow()
  })

  it('emits nodeCreate event on createNode', () => {
    const listener = jest.fn()
    nm.on('nodeCreate', listener)
    nm.createNode({ host: 'localhost', id: 'evt1', port: 2333, authorization: 'pw' })
    expect(listener).toHaveBeenCalled()
  })

  it('on/once/off/removeListener work', () => {
    const listener = jest.fn()
    nm.on('nodeCreate', listener)
    nm.off('nodeCreate', listener)
    nm.createNode({ host: 'localhost', id: 'evt2', port: 2333, authorization: 'pw' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('once() fires only once', () => {
    const listener = jest.fn()
    nm.once('nodeCreate', listener)
    nm.createNode({ host: 'localhost', id: 'once1', port: 2333, authorization: 'pw' })
    nm.createNode({ host: 'localhost', id: 'once2', port: 2333, authorization: 'pw' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('removeListener() removes listener', () => {
    const listener = jest.fn()
    nm.on('nodeCreate', listener)
    nm.removeListener('nodeCreate', listener)
    nm.createNode({ host: 'localhost', id: 'rl1', port: 2333, authorization: 'pw' })
    expect(listener).not.toHaveBeenCalled()
  })
})
