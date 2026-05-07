import { RyanlinkManager, RyanlinkNode } from '../src'

function makeManager() {
  return new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn() })
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1, close: jest.fn(), removeAllListeners: jest.fn(), terminate: jest.fn(), ping: jest.fn(), on: jest.fn() }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  // @ts-ignore
  node.destroyPlayer = jest.fn().mockResolvedValue(undefined)
  return node
}

describe('RyanlinkNode - validate()', () => {
  it('throws when no authorization', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', port: 80 } as any, m.nodeManager)).toThrow("requires 'authorization'")
  })

  it('throws when no host', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ authorization: 'pw', port: 80 } as any, m.nodeManager)).toThrow("requires 'host'")
  })

  it('throws when no port', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', authorization: 'pw' } as any, m.nodeManager)).toThrow("requires 'port'")
  })

  it('throws when port out of range', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', authorization: 'pw', port: 99999 } as any, m.nodeManager)).toThrow('port must be a number')
  })

  it('throws when closeOnError is not boolean', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', authorization: 'pw', port: 80, closeOnError: 'yes' } as any, m.nodeManager)).toThrow('closeOnError')
  })

  it('throws when retryDelay is not number', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', authorization: 'pw', port: 80, retryDelay: 'bad' } as any, m.nodeManager)).toThrow('retryDelay')
  })

  it('throws when regions is not array of strings', () => {
    const m = makeManager()
    expect(() => new RyanlinkNode({ host: 'h', authorization: 'pw', port: 80, regions: [1, 2] } as any, m.nodeManager)).toThrow('regions')
  })
})

describe('RyanlinkNode - nodeMetricSummary', () => {
  it('returns zeros when not connected', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    const summary = node.nodeMetricSummary()
    expect(summary.cpuLoad).toBe(0)
    expect(summary.players).toBe(0)
  })

  it('returns metrics when connected and alive', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.isAlive = true
    node.stats.cpu.systemLoad = 0.5
    node.stats.cpu.audioLoad = 0.3
    node.stats.memory.used = 500
    node.stats.memory.allocated = 1000
    node.stats.players = 5
    node.stats.playingPlayers = 3
    node.stats.uptime = 10000
    const summary = node.nodeMetricSummary()
    expect(summary.systemLoad).toBe(0.5)
    expect(summary.cpuLoad).toBe(0.3)
    expect(summary.memoryUsage).toBe(50)
    expect(summary.players).toBe(5)
  })
})

describe('RyanlinkNode - getHealthStatus', () => {
  it('returns offline when not connected', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    const health = node.getHealthStatus()
    expect(health.status).toBe('offline')
    expect(health.needsRestart).toBe(true)
    expect(health.penaltyScore).toBe(999999)
  })

  it('returns healthy when connected with low load', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.isAlive = true
    node.stats.cpu.systemLoad = 0.1
    node.stats.cpu.audioLoad = 0.1
    node.stats.memory.used = 100
    node.stats.memory.allocated = 1000
    node.stats.players = 2
    const health = node.getHealthStatus()
    expect(health.status).toBe('healthy')
    expect(health.isOverloaded).toBe(false)
  })

  it('returns degraded when overloaded', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.isAlive = true
    node.stats.cpu.systemLoad = 0.9
    node.stats.cpu.audioLoad = 0.9
    node.stats.memory.used = 900
    node.stats.memory.allocated = 1000
    node.stats.players = 100
    const health = node.getHealthStatus()
    expect(['degraded', 'critical']).toContain(health.status)
    expect(health.isOverloaded).toBe(true)
  })

  it('accepts custom thresholds', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    node.isAlive = true
    const health = node.getHealthStatus({
      cpu: { excellent: 0.1, good: 0.2, fair: 0.3, poor: 0.4 },
      memory: { excellent: 10, good: 20, fair: 30, poor: 40 },
      ping: { excellent: 10, good: 20, fair: 30, poor: 40 },
    })
    expect(health).toBeDefined()
    expect(health.status).toBeDefined()
  })
})

describe('RyanlinkNode - isRyanlinkNode', () => {
  it('returns true for Core node', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    expect(node.isRyanlinkNode()).toBe(true)
  })
})

describe('RyanlinkNode - isNodeReconnecting', () => {
  it('returns false when IDLE', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    expect(node.isNodeReconnecting).toBe(false)
  })
})

describe('RyanlinkNode - reconnectionAttemptCount', () => {
  it('returns 0 initially', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    expect(node.reconnectionAttemptCount).toBe(0)
  })
})

describe('RyanlinkNode - hasXMPlugin', () => {
  it('returns false when no info', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    expect(node.hasXMPlugin()).toBe(false)
  })

  it('returns true when lava-xm-plugin present', () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    // @ts-ignore
    node.info = { plugins: [{ name: 'lava-xm-plugin' }] }
    expect(node.hasXMPlugin()).toBe(true)
  })
})

describe('RyanlinkNode - routePlannerApi', () => {
  it('routePlannerApi.getStatus() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.routePlannerApi.getStatus()).rejects.toThrow()
  })

  it('routePlannerApi.unmarkFailedAddress() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.routePlannerApi.unmarkFailedAddress('1.2.3.4')).rejects.toThrow()
  })

  it('routePlannerApi.unmarkAllFailedAddresses() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.routePlannerApi.unmarkAllFailedAddresses()).rejects.toThrow()
  })
})

describe('RyanlinkNode - timedLyrics', () => {
  it('timedLyrics.getCurrent() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.timedLyrics.getCurrent('g')).rejects.toThrow()
  })

  it('timedLyrics.getByVideoId() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.timedLyrics.getByVideoId('vid1')).rejects.toThrow()
  })

  it('timedLyrics.search() throws without sessionId', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.sessionId = null
    await expect(node.timedLyrics.search('hello')).rejects.toThrow()
  })
})

describe('RyanlinkNode - fetchStats/fetchInfo/fetchVersion', () => {
  it('fetchStats() throws when not connected', async () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    await expect(node.fetchStats()).rejects.toThrow()
  })

  it('fetchInfo() throws when not connected', async () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    await expect(node.fetchInfo()).rejects.toThrow()
  })

  it('fetchVersion() throws when not connected', async () => {
    const m = makeManager()
    const node = new RyanlinkNode({ host: 'h', port: 80, authorization: 'pw' } as any, m.nodeManager)
    await expect(node.fetchVersion()).rejects.toThrow()
  })

  it('fetchConnectionMetrics() throws when not nodelink', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    node.info = { isNodelink: false }
    await expect(node.fetchConnectionMetrics()).rejects.toThrow()
  })
})

describe('RyanlinkNode - message handling', () => {
  it('processes stats message', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const payload = JSON.stringify({ op: 'stats', players: 5, playingPlayers: 2, memory: {}, cpu: {}, uptime: 1000 })
    // @ts-ignore
    await node.message(payload)
    expect(node.stats.players).toBe(5)
  })

  it('processes ready message', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const listener = jest.fn()
    m.nodeManager.on('nodeReady', listener)
    const payload = JSON.stringify({ op: 'ready', sessionId: 'new_sess', resumed: false })
    // @ts-ignore
    await node.message(payload)
    expect(node.sessionId).toBe('new_sess')
    expect(listener).toHaveBeenCalled()
  })

  it('processes playerUpdate message', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'n1' })
    const listener = jest.fn()
    m.on('playerUpdate', listener)
    // Patch player to allow position assignment (it's a computed getter in source)
    const player = m.getPlayer('g')
    Object.defineProperty(player, 'position', { get: () => 0, set: () => {}, configurable: true })
    const payload = JSON.stringify({
      op: 'playerUpdate',
      guildId: 'g',
      state: { position: 5000, connected: true, ping: 10 },
    })
    // @ts-ignore
    await node.message(payload)
    expect(listener).toHaveBeenCalled()
  })

  it('handles invalid JSON gracefully', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const listener = jest.fn()
    m.nodeManager.on('nodeError', listener)
    // @ts-ignore
    await node.message('not valid json')
    expect(listener).toHaveBeenCalled()
  })

  it('ignores messages without op', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    await node.message(JSON.stringify({ data: 'no op' }))
    // no error
  })

  it('emits nodeError for unknown op', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const listener = jest.fn()
    m.nodeManager.on('nodeError', listener)
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'unknownOp', data: {} }))
    expect(listener).toHaveBeenCalled()
  })

  it('emits nodeRaw for all messages', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const listener = jest.fn()
    m.nodeManager.on('nodeRaw', listener)
    // @ts-ignore
    await node.message(JSON.stringify({ op: 'stats', players: 0, playingPlayers: 0, memory: {}, cpu: {}, uptime: 0 }))
    expect(listener).toHaveBeenCalled()
  })

  it('handles Buffer input', async () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const payload = Buffer.from(JSON.stringify({ op: 'stats', players: 3, playingPlayers: 1, memory: {}, cpu: {}, uptime: 0 }))
    // @ts-ignore
    await node.message(payload)
    expect(node.stats.players).toBe(3)
  })
})

describe('RyanlinkNode - syncPlayerData', () => {
  it('updates player paused state', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'n1' })
    // @ts-ignore
    node.syncPlayerData({ guildId: 'g', playerOptions: { paused: true } })
    expect(player.paused).toBe(true)
    expect(player.playing).toBe(false)
  })

  it('updates player position', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'n1' })
    // @ts-ignore
    node.syncPlayerData({ guildId: 'g', playerOptions: { position: 5000 } })
    expect(player.lastPosition).toBe(5000)
  })

  it('updates player volume', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    const player = m.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'n1' })
    // @ts-ignore
    node.syncPlayerData({ guildId: 'g', playerOptions: { volume: 80 } })
    expect(player.volume).toBe(80)
  })

  it('does nothing for unknown guildId', () => {
    const m = makeManager()
    const node = makeConnectedNode(m)
    // @ts-ignore
    expect(() => node.syncPlayerData({ guildId: 'unknown', playerOptions: { paused: true } })).not.toThrow()
  })
})
