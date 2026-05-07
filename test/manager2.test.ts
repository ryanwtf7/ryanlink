import { RyanlinkManager, RyanlinkNode } from '../src'

function makeManager() {
  return new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: jest.fn().mockResolvedValue(undefined) })
}

function makeConnectedNode(manager: RyanlinkManager, id = 'n1') {
  const node = new RyanlinkNode({ host: 'localhost', id, port: 2333, authorization: 'pw' }, manager.nodeManager)
  // @ts-ignore
  node.socket = { readyState: 1 }
  // @ts-ignore
  node.sessionId = 'sess'
  manager.nodeManager.nodes.set(id, node)
  // @ts-ignore
  node.updatePlayer = jest.fn().mockResolvedValue({})
  // @ts-ignore
  node.destroyPlayer = jest.fn().mockResolvedValue(undefined)
  return node
}

describe('Manager - constructor validation', () => {
  it('throws when no options', () => {
    expect(() => new RyanlinkManager(null as any)).toThrow()
  })

  it('throws when sendToShard is not a function', () => {
    expect(() => new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: 'bad' as any })).toThrow()
  })

  it('throws when autoSkip is not boolean', () => {
    expect(() => new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {}, autoSkip: 'yes' as any })).toThrow()
  })

  it('throws when autoSkipOnResolveError is not boolean', () => {
    expect(() => new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {}, autoSkipOnResolveError: 'yes' as any })).toThrow()
  })

  it('throws when emitNewSongsOnly is not boolean', () => {
    expect(() => new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {}, emitNewSongsOnly: 'yes' as any })).toThrow()
  })

  it('throws when nodes contains invalid node', () => {
    expect(() => new RyanlinkManager({ nodes: [{ bad: true } as any], client: { id: '1' }, sendToShard: () => {} })).toThrow()
  })
})

describe('Manager - options', () => {
  it('applies default options', () => {
    const m = makeManager()
    expect(m.options.autoMove).toBe(false)
    expect(m.options.autoSkip).toBe(true)
    expect(m.options.playerOptions.defaultSearchPlatform).toBe('ytsearch')
    expect(m.options.playerOptions.volumeDecrementer).toBe(1)
  })

  it('applies custom options', () => {
    const m = new RyanlinkManager({
      nodes: [],
      client: { id: '1', username: 'MyBot' },
      sendToShard: () => {},
      autoMove: true,
      playerOptions: { defaultSearchPlatform: 'scsearch' },
    })
    expect(m.options.autoMove).toBe(true)
    expect(m.options.client.username).toBe('MyBot')
    expect(m.options.playerOptions.defaultSearchPlatform).toBe('scsearch')
  })
})

describe('Manager - player lifecycle', () => {
  it('createPlayer() returns existing player if already exists', () => {
    const m = makeManager()
    const p1 = m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    const p2 = m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(p1).toBe(p2)
  })

  it('getPlayer() returns player by guildId', () => {
    const m = makeManager()
    const p = m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(m.getPlayer('g')).toBe(p)
  })

  it('getPlayer() returns undefined for unknown guildId', () => {
    const m = makeManager()
    expect(m.getPlayer('unknown')).toBeUndefined()
  })

  it('deletePlayer() returns undefined for unknown guildId', () => {
    const m = makeManager()
    expect(m.deletePlayer('unknown')).toBeUndefined()
  })

  it('destroyPlayer() returns undefined for unknown guildId', () => {
    const m = makeManager()
    expect(m.destroyPlayer('unknown')).toBeUndefined()
  })

  it('emits playerCreate event', () => {
    const m = makeManager()
    const listener = jest.fn()
    m.on('playerCreate', listener)
    m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(listener).toHaveBeenCalled()
  })
})

describe('Manager - toJSON', () => {
  it('toJSON() returns manager state', () => {
    const m = makeManager()
    const json = m.toJSON()
    expect(json).toHaveProperty('initiated')
    expect(json).toHaveProperty('playerCount')
    expect(json).toHaveProperty('nodeCount')
  })
})

describe('Manager - useable', () => {
  it('useable returns false when no connected nodes', () => {
    const m = makeManager()
    expect(m.useable).toBe(false)
  })

  it('useable returns true when a node is connected', () => {
    const m = makeManager()
    makeConnectedNode(m, 'n1')
    expect(m.useable).toBe(true)
  })
})

describe('Manager - init', () => {
  it('init() sets client id', async () => {
    const m = makeManager()
    await m.init({ id: 'bot123' })
    expect(m.options.client.id).toBe('bot123')
  })

  it('init() is idempotent when nodes connect', async () => {
    const m = makeManager()
    makeConnectedNode(m, 'n1')
    // @ts-ignore
    m.nodeManager.nodes.get('n1').connect = jest.fn().mockResolvedValue(undefined)
    // manually mark as initiated to test idempotency
    m.initiated = true
    await m.init({ id: 'bot2' })
    // when already initiated, init() returns early without changing client id
    expect(m.options.client.id).toBe('1')
  })

  it('init() throws when no client id', async () => {
    const m = new RyanlinkManager({ nodes: [], client: {} as any, sendToShard: () => {} })
    await expect(m.init({} as any)).rejects.toThrow()
  })
})

describe('Manager - search', () => {
  it('search() throws when no connected nodes', async () => {
    const m = makeManager()
    await expect(m.search('hello')).rejects.toThrow()
  })
})

describe('Manager - event emitter', () => {
  it('on/off/once/removeListener work', () => {
    const m = makeManager()
    const listener = jest.fn()
    m.on('playerCreate', listener)
    m.off('playerCreate', listener)
    m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('once() fires only once', () => {
    const m = makeManager()
    const listener = jest.fn()
    m.once('playerCreate', listener)
    m.createPlayer({ guildId: 'g1', voiceChannelId: 'v' })
    m.createPlayer({ guildId: 'g2', voiceChannelId: 'v' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('removeListener() removes listener', () => {
    const m = makeManager()
    const listener = jest.fn()
    m.on('playerCreate', listener)
    m.removeListener('playerCreate', listener)
    m.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('Manager - voiceStates', () => {
  it('getVoiceStateUsers() returns empty array initially', () => {
    const m = makeManager()
    expect(m.getVoiceStateUsers('g', 'vc')).toEqual([])
  })

  it('getVoiceStateUsers() returns matching users', () => {
    const m = makeManager()
    m.voiceStates.set('g_u1', { guildId: 'g', channelId: 'vc', userId: 'u1', deaf: false, mute: false })
    m.voiceStates.set('g_u2', { guildId: 'g', channelId: 'vc2', userId: 'u2', deaf: false, mute: false })
    const users = m.getVoiceStateUsers('g', 'vc')
    expect(users.length).toBe(1)
    expect(users[0].userId).toBe('u1')
  })
})

describe('Manager - provideVoiceUpdate', () => {
  it('returns early when not initiated', async () => {
    const m = makeManager()
    await m.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: {} } as any)
    // no error thrown
  })

  it('returns early when no t field', async () => {
    const m = makeManager()
    m.initiated = true
    await m.provideVoiceUpdate({} as any)
    // no error thrown
  })

  it('handles CHANNEL_DELETE without guild_id', async () => {
    const m = makeManager()
    m.initiated = true
    await m.provideVoiceUpdate({ t: 'CHANNEL_DELETE', d: {} } as any)
    // no error thrown
  })

  it('handles VOICE_STATE_UPDATE with no update data', async () => {
    const m = makeManager()
    m.initiated = true
    await m.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: null } as any)
    // no error thrown
  })

  it('handles VOICE_STATE_UPDATE tracking user voice state', async () => {
    const m = makeManager()
    m.initiated = true
    await m.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc',
        user_id: 'u1',
        session_id: 'sess',
        deaf: false,
        mute: false,
      },
    } as any)
    expect(m.voiceStates.has('g_u1')).toBe(true)
  })

  it('handles VOICE_STATE_UPDATE removing user when no channel', async () => {
    const m = makeManager()
    m.initiated = true
    m.voiceStates.set('g_u1', { guildId: 'g', channelId: 'vc', userId: 'u1', deaf: false, mute: false })
    await m.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: null,
        user_id: 'u1',
        session_id: 'sess',
      },
    } as any)
    expect(m.voiceStates.has('g_u1')).toBe(false)
  })
})

describe('Manager - nodes created from options', () => {
  it('creates nodes from options.nodes', () => {
    const m = new RyanlinkManager({
      nodes: [{ host: 'localhost', id: 'n1', port: 2333, authorization: 'pw' }],
      client: { id: '1' },
      sendToShard: () => {},
    })
    expect(m.nodeManager.nodes.has('n1')).toBe(true)
  })
})
