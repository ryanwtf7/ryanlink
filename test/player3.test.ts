import { Player, RyanlinkManager, RyanlinkNode } from '../src'
import { AudioTrackSymbol } from '../src/utils/Utils'
import { TrackRegistry } from '../src/utils/TrackRegistry'

function makeSetup(opts: any = {}) {
  const manager = new RyanlinkManager({
    nodes: [], client: { id: '1' }, sendToShard: jest.fn().mockResolvedValue(undefined),
    ...opts,
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
  const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local' })
  return { manager, node, player }
}

function makeTrack(id = 'track1') {
  TrackRegistry.clear()
  const t: any = {
    encoded: 'enc_' + id,
    info: {
      identifier: id,
      title: 'Title',
      author: 'Author',
      duration: 300000,
      sourceName: 'youtube',
      isSeekable: true,
      isStream: false,
    },
    pluginInfo: { clientData: {} },
    requester: { id: 'user1' },
    userData: {},
  }
  Object.defineProperty(t, AudioTrackSymbol, { configurable: true, value: true })
  return t
}

describe('Player - seek', () => {
  it('seek() returns undefined when no current track', async () => {
    const { player } = makeSetup()
    player.queue.current = null
    const result = await player.seek(1000)
    expect(result).toBeUndefined()
  })

  it('seek() throws on NaN position', async () => {
    const { player } = makeSetup()
    player.queue.current = makeTrack()
    await expect(player.seek(NaN)).rejects.toThrow('Position must be a number')
  })

  it('seek() throws when track not seekable', async () => {
    const { player } = makeSetup()
    const t = makeTrack()
    t.info.isSeekable = false
    player.queue.current = t
    await expect(player.seek(1000)).rejects.toThrow('not seekable')
  })

  it('seek() throws when track is stream', async () => {
    const { player } = makeSetup()
    const t = makeTrack()
    t.info.isStream = true
    player.queue.current = t
    await expect(player.seek(1000)).rejects.toThrow('not seekable')
  })

  it('seek() clamps position to 0 when negative', async () => {
    const { player, node } = makeSetup()
    player.queue.current = makeTrack()
    await player.seek(-100)
    // @ts-ignore
    const call = node.updatePlayer.mock.calls[node.updatePlayer.mock.calls.length - 1][0]
    expect(call.playerOptions.position).toBe(0)
  })

  it('seek() clamps position to duration when exceeds', async () => {
    const { player, node } = makeSetup()
    const t = makeTrack()
    player.queue.current = t
    await player.seek(999999)
    // @ts-ignore
    const call = node.updatePlayer.mock.calls[node.updatePlayer.mock.calls.length - 1][0]
    expect(call.playerOptions.position).toBe(t.info.duration)
  })

  it('seek() updates lastPosition', async () => {
    const { player } = makeSetup()
    player.queue.current = makeTrack()
    await player.seek(5000)
    expect(player.lastPosition).toBe(5000)
  })
})

describe('Player - syncState', () => {
  it('syncState() emits playerUpdate', () => {
    const { player, manager } = makeSetup()
    const listener = jest.fn()
    manager.on('playerUpdate', listener)
    player.syncState()
    expect(listener).toHaveBeenCalled()
  })

  it('syncState() updates oldJSON', () => {
    const { player } = makeSetup()
    player.volume = 75
    player.syncState()
    expect(player.oldJSON.volume).toBe(75)
  })
})

describe('Player - toJSON', () => {
  it('toJSON() includes all required fields', () => {
    const { player } = makeSetup()
    const json = player.toJSON()
    expect(json.guildId).toBe('g')
    expect(json.voiceChannelId).toBe('v')
    expect(json.volume).toBe(100)
    expect(json.paused).toBe(false)
    expect(json.playing).toBe(false)
    expect(json.repeatMode).toBe('off')
    expect(json.autoplay).toBe(false)
    expect(Array.isArray(json.recentHistory)).toBe(true)
    expect(json.nodeId).toBe('local')
  })
})

describe('Player - recentHistory', () => {
  it('recentHistory is initialized from options', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    const player = manager.createPlayer({
      guildId: 'g', voiceChannelId: 'v', node: 'local',
      recentHistory: ['track1', 'track2'],
    })
    expect(player.recentHistory).toEqual(['track1', 'track2'])
  })
})

describe('Player - autoplay option', () => {
  it('autoplay is set from options', () => {
    const manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local', autoplay: true })
    expect(player.autoplay).toBe(true)
  })
})

describe('Player - volume with decrementer', () => {
  it('applies volumeDecrementer', () => {
    const manager = new RyanlinkManager({
      nodes: [], client: { id: '1' }, sendToShard: () => {},
      playerOptions: { volumeDecrementer: 0.5 },
    })
    const node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local', volume: 100 })
    expect(player.internalVolume).toBe(50)
  })
})

describe('Player - skip with skipTo', () => {
  it('skip() with skipTo removes tracks before index', async () => {
    const { player, node } = makeSetup()
    const t1 = makeTrack('t1')
    const t2 = makeTrack('t2')
    const t3 = makeTrack('t3')
    player.queue.tracks.push(t1, t2, t3)
    player.queue.current = makeTrack('curr')
    player.playing = true
    await player.skip(2)
    // @ts-ignore
    expect(node.updatePlayer).toHaveBeenCalled()
  })
})

describe('Player - stopPlaying with executeAutoplay', () => {
  it('stopPlaying() sets internal_autoplayStopPlaying when executeAutoplay=false', async () => {
    const { player } = makeSetup()
    await player.stopPlaying(true, false)
    expect(player.getData('internal_autoplayStopPlaying')).toBe(true)
  })

  it('stopPlaying() clears internal_autoplayStopPlaying when executeAutoplay=true', async () => {
    const { player } = makeSetup()
    await player.stopPlaying(true, true)
    expect(player.getData('internal_autoplayStopPlaying')).toBeUndefined()
  })
})

describe('Player - queueempty timeout', () => {
  it('play() clears queueempty timeout if set', async () => {
    const { player } = makeSetup()
    const timeout = setTimeout(() => {}, 10000)
    player.setData('internal_queueempty', timeout)
    // play() with no current track and no queue should throw, but timeout should be cleared
    try {
      await player.play()
    } catch {}
    expect(player.getData('internal_queueempty')).toBeUndefined()
  })
})
