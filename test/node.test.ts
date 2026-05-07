import { RyanlinkNode, RyanlinkManager } from '../src'

describe('Node', () => {
  let manager: RyanlinkManager
  let node: RyanlinkNode

  beforeEach(() => {
    manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
  })

  it('instantiates and validates', () => {
    expect(node.id).toBe('local')
    expect(() => new RyanlinkNode({} as any, manager.nodeManager)).toThrow()
  })

  it('handles stats update', () => {
    const stats = { players: 1, playingPlayers: 1, memory: {}, cpu: {}, uptime: 100 }
    node.stats = stats as any
    expect(node.stats.players).toBe(1)
  })

  it('identifies connection status', () => {
    // @ts-ignore
    node.socket = { readyState: 1 }
    expect(node.connectionStatus).toBe('OPEN')
    // @ts-ignore
    node.socket.readyState = 3
    expect(node.connectionStatus).toBe('CLOSED')
  })
})