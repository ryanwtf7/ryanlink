import { RyanlinkManager, RyanlinkNode } from '../src'

function makeSetup() {
  const manager = new RyanlinkManager({
    nodes: [], client: { id: 'bot1' }, sendToShard: jest.fn().mockResolvedValue(undefined),
  })
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
  manager.initiated = true
  return { manager, node }
}

describe('Manager - provideVoiceUpdate - CHANNEL_DELETE', () => {
  it('destroys player when channel matches', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({ t: 'CHANNEL_DELETE', d: { guild_id: 'g', id: 'vc1' } } as any)
    expect(destroySpy).toHaveBeenCalled()
  })

  it('does nothing when channel does not match', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({ t: 'CHANNEL_DELETE', d: { guild_id: 'g', id: 'vc2' } } as any)
    expect(destroySpy).not.toHaveBeenCalled()
  })
})

describe('Manager - provideVoiceUpdate - VOICE_STATE_UPDATE', () => {
  it('stores session_id for bot user', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc1',
        user_id: 'bot1',
        session_id: 'new_session',
      },
    } as any)
    expect(player.getData('internal_voiceSessionId')).toBe('new_session')
  })

  it('updates player voiceChannelId on channel change', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc2',
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
    expect(player.voiceChannelId).toBe('vc2')
  })

  it('emits playerDisconnect when bot leaves channel', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    const listener = jest.fn()
    manager.on('playerDisconnect', listener)
    // Configure to not destroy on disconnect
    manager.options.playerOptions.onDisconnect.destroyPlayer = false
    manager.options.playerOptions.onDisconnect.autoReconnect = false
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: null,
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
    expect(listener).toHaveBeenCalled()
  })

  it('destroys player on disconnect when destroyPlayer=true', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    manager.options.playerOptions.onDisconnect.destroyPlayer = true
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: null,
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
    expect(destroySpy).toHaveBeenCalled()
  })

  it('skips update when player is destroying', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.setData('internal_destroystatus', true)
    // Should not throw
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc1',
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
  })

  it('handles other user voice state update', async () => {
    const { manager } = makeSetup()
    manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    // Should not throw for other users
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc1',
        user_id: 'other_user',
        session_id: 'sess',
        deaf: false,
        mute: false,
      },
    } as any)
  })

  it('returns early when no player found', async () => {
    const { manager } = makeSetup()
    // No player for guild 'unknown'
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'unknown',
        channel_id: 'vc1',
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
    // no error
  })

  it('emits playerMove when bot moves channels', async () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voiceChannelId = 'vc1'
    player.voice.sessionId = 'sess'
    const listener = jest.fn()
    manager.on('playerMove', listener)
    await manager.provideVoiceUpdate({
      t: 'VOICE_STATE_UPDATE',
      d: {
        guild_id: 'g',
        channel_id: 'vc2',
        user_id: 'bot1',
        session_id: 'sess',
      },
    } as any)
    expect(listener).toHaveBeenCalledWith(player, 'vc1', 'vc2')
  })
})

describe('Manager - provideVoiceUpdate - VOICE_SERVER_UPDATE', () => {
  it('throws when node has no sessionId', async () => {
    const { manager, node } = makeSetup()
    manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    // @ts-ignore
    node.sessionId = null
    await expect(manager.provideVoiceUpdate({
      t: 'VOICE_SERVER_UPDATE',
      d: {
        guild_id: 'g',
        token: 'tok',
        endpoint: 'endpoint.discord.gg',
      },
    } as any)).rejects.toThrow()
  })

  it('sends voice update when all data present', async () => {
    const { manager, node } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.voice.sessionId = 'sess'
    player.voice.channelId = 'vc1'
    await manager.provideVoiceUpdate({
      t: 'VOICE_SERVER_UPDATE',
      d: {
        guild_id: 'g',
        token: 'tok',
        endpoint: 'endpoint.discord.gg',
      },
    } as any)
    // @ts-ignore
    expect(node.updatePlayer).toHaveBeenCalled()
  })
})

describe('Manager - deletePlayer edge cases', () => {
  it('deletePlayer() throws when player is connected and not destroying', () => {
    const { manager } = makeSetup()
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.connected = true
    expect(() => manager.deletePlayer('g')).toThrow()
  })

  it('deletePlayer() succeeds when dontThrowError=true', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      advancedOptions: { debugOptions: { playerDestroy: { dontThrowError: true } } },
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'vc1', node: 'local' })
    player.connected = true
    expect(() => manager.deletePlayer('g')).not.toThrow()
  })
})
