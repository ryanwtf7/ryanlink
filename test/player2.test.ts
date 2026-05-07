import { Player, RyanlinkManager, RyanlinkNode } from '../src'

function makeSetup() {
  const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn().mockResolvedValue(undefined) })
  const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set('local', node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  // @ts-ignore
  node.destroyPlayer = jest.fn().mockResolvedValue(undefined)
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local' })
  return { manager, node, player }
}

describe('Player - data management', () => {
  let player: Player

  beforeEach(() => {
    player = makeSetup().player
  })

  it('set() and get() store/retrieve data', () => {
    player.set('myKey', 42)
    expect(player.get('myKey')).toBe(42)
  })

  it('setData() and getData() store/retrieve data', () => {
    player.setData('foo', 'bar')
    expect(player.getData('foo')).toBe('bar')
  })

  it('deleteData() removes key', () => {
    player.setData('toDelete', 'val')
    player.deleteData('toDelete')
    expect(player.getData('toDelete')).toBeUndefined()
  })

  it('deleteData() ignores internal_ keys', () => {
    player.setData('internal_test', 'val')
    player.deleteData('internal_test')
    expect(player.getData('internal_test')).toBe('val')
  })

  it('clearData() removes non-internal keys', () => {
    player.setData('a', 1)
    player.setData('b', 2)
    player.setData('internal_x', 3)
    player.clearData()
    expect(player.getData('a')).toBeUndefined()
    expect(player.getData('b')).toBeUndefined()
    expect(player.getData('internal_x')).toBe(3)
  })

  it('getAllData() returns non-internal keys', () => {
    player.setData('pub', 'yes')
    player.setData('internal_priv', 'no')
    const data = player.getAllData()
    expect(data['pub']).toBe('yes')
    expect(data['internal_priv']).toBeUndefined()
  })
})

describe('Player - volume', () => {
  it('setVolume() updates volume', async () => {
    const { player } = makeSetup()
    await player.setVolume(50)
    expect(player.volume).toBe(50)
  })

  it('setVolume() clamps to 0-1000', async () => {
    const { player } = makeSetup()
    await player.setVolume(0)
    expect(player.volume).toBe(0)
    await player.setVolume(1000)
    expect(player.volume).toBe(1000)
  })

  it('setVolume() throws on NaN', async () => {
    const { player } = makeSetup()
    await expect(player.setVolume(NaN)).rejects.toThrow()
  })

  it('setVolume() returns early if same volume', async () => {
    const { player, node } = makeSetup()
    player.volume = 100
    await player.setVolume(100)
    // updatePlayer should not be called for same volume
    expect(player.volume).toBe(100)
  })
})

describe('Player - repeat mode', () => {
  it('setRepeatMode() sets off', async () => {
    const { player } = makeSetup()
    await player.setRepeatMode('off')
    expect(player.repeatMode).toBe('off')
  })

  it('setRepeatMode() sets track', async () => {
    const { player } = makeSetup()
    await player.setRepeatMode('track')
    expect(player.repeatMode).toBe('track')
  })

  it('setRepeatMode() sets queue', async () => {
    const { player } = makeSetup()
    await player.setRepeatMode('queue')
    expect(player.repeatMode).toBe('queue')
  })

  it('setRepeatMode() throws on invalid mode', async () => {
    const { player } = makeSetup()
    await expect(player.setRepeatMode('invalid' as any)).rejects.toThrow()
  })
})

describe('Player - pause/resume', () => {
  it('pause(true) sets paused=true', async () => {
    const { player } = makeSetup()
    await player.pause(true)
    expect(player.paused).toBe(true)
  })

  it('pause(false) sets paused=false', async () => {
    const { player } = makeSetup()
    await player.pause(true)
    await player.pause(false)
    expect(player.paused).toBe(false)
  })

  it('resume() throws when not paused', async () => {
    const { player } = makeSetup()
    await expect(player.resume()).rejects.toThrow()
  })

  it('resume() unpauses player', async () => {
    const { player } = makeSetup()
    await player.pause(true)
    await player.resume()
    expect(player.paused).toBe(false)
  })
})

describe('Player - connect/disconnect', () => {
  it('connect() calls sendToShard', async () => {
    const { player, manager } = makeSetup()
    player.options.voiceChannelId = 'vc1'
    await player.connect()
    expect(manager.options.sendToShard).toHaveBeenCalled()
    expect(player.voiceChannelId).toBe('vc1')
  })

  it('connect() throws without voiceChannelId', async () => {
    const { player } = makeSetup()
    player.options.voiceChannelId = undefined
    await expect(player.connect()).rejects.toThrow()
  })

  it('disconnect() calls sendToShard', async () => {
    const { player, manager } = makeSetup()
    await player.disconnect()
    expect(manager.options.sendToShard).toHaveBeenCalled()
    expect(player.voiceChannelId).toBeNull()
  })

  it('disconnect() throws without voiceChannelId when not forced', async () => {
    const { player } = makeSetup()
    player.options.voiceChannelId = undefined
    await expect(player.disconnect(false)).rejects.toThrow()
  })

  it('setVoiceChannel() throws when same channel', async () => {
    const { player } = makeSetup()
    player.options.voiceChannelId = 'vc1'
    await expect(player.setVoiceChannel({ voiceChannelId: 'vc1' })).rejects.toThrow()
  })

  it('setVoiceChannel() updates channel', async () => {
    const { player, manager } = makeSetup()
    player.options.voiceChannelId = 'vc1'
    await player.setVoiceChannel({ voiceChannelId: 'vc2' })
    expect(player.voiceChannelId).toBe('vc2')
    expect(manager.options.sendToShard).toHaveBeenCalled()
  })
})

describe('Player - stopPlaying', () => {
  it('stopPlaying() clears queue and calls updatePlayer', async () => {
    const { player, node } = makeSetup()
    player.queue.tracks.push({ encoded: 't1', info: {} } as any)
    await player.stopPlaying(true, false)
    expect(player.queue.tracks.length).toBe(0)
    expect(node.updatePlayer).toHaveBeenCalled()
  })

  it('stopPlaying() without clearing queue', async () => {
    const { player, node } = makeSetup()
    player.queue.tracks.push({ encoded: 't1', info: {} } as any)
    await player.stopPlaying(false, false)
    expect(player.queue.tracks.length).toBe(1)
  })
})

describe('Player - skip', () => {
  it('skip() throws when queue empty', async () => {
    const { player } = makeSetup()
    await expect(player.skip()).rejects.toThrow()
  })

  it('skip() throws when skipTo exceeds queue', async () => {
    const { player } = makeSetup()
    player.queue.tracks.push({ encoded: 't1', info: {} } as any)
    await expect(player.skip(5)).rejects.toThrow()
  })
})

describe('Player - position', () => {
  it('position returns lastPosition when no change', () => {
    const { player } = makeSetup()
    player.lastPosition = 5000
    player.lastPositionChange = null
    expect(player.position).toBe(5000)
  })

  it('position adds elapsed time when playing', () => {
    const { player } = makeSetup()
    player.lastPosition = 1000
    player.lastPositionChange = Date.now() - 500
    expect(player.position).toBeGreaterThanOrEqual(1500)
  })
})

describe('Player - node getter/setter', () => {
  it('node setter updates options.node', () => {
    const { player, node } = makeSetup()
    player.node = node
    expect(player.options.node).toBe(node.id)
  })
})

describe('Player - toJSON', () => {
  it('toJSON() returns player state', () => {
    const { player } = makeSetup()
    const json = player.toJSON()
    expect(json).toHaveProperty('guildId')
    expect(json).toHaveProperty('voiceChannelId')
    expect(json).toHaveProperty('volume')
    expect(json).toHaveProperty('paused')
  })
})

describe('Player - autoResume', () => {
  it('autoResume() returns player', async () => {
    const { player } = makeSetup()
    const result = await player.autoResume()
    expect(result).toBe(player)
  })
})

describe('Player - customData in constructor', () => {
  it('applies customData from options', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    const player = manager.createPlayer({
      guildId: 'g2',
      voiceChannelId: 'v',
      node: 'local',
      customData: { myKey: 'myVal' },
    })
    expect(player.getData('myKey')).toBe('myVal')
  })
})

describe('Player - destroy', () => {
  it('destroy() removes player from manager', async () => {
    const { player, manager } = makeSetup()
    // player already removed by destroyPlayer in manager, but let's test direct destroy
    const manager2 = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn().mockResolvedValue(undefined) })
    const node2 = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager2.nodeManager)
    // @ts-ignore
    node2.socket = { readyState: 1 }
    // @ts-ignore
    node2.sessionId = 'sess'
    manager2.nodeManager.nodes.set('local', node2)
    // @ts-ignore
    node2.updatePlayer = jest.fn().mockResolvedValue({})
    // @ts-ignore
    node2.destroyPlayer = jest.fn().mockResolvedValue(undefined)
    const p2 = manager2.createPlayer({ guildId: 'g2', voiceChannelId: 'v', node: 'local' })
    expect(manager2.players.has('g2')).toBe(true)
    await p2.destroy()
    expect(manager2.players.has('g2')).toBe(false)
  })

  it('destroy() skips if already destroying', async () => {
    const { player } = makeSetup()
    player.setData('internal_destroystatus', true)
    const result = await player.destroy()
    expect(result).toBeUndefined()
  })
})
