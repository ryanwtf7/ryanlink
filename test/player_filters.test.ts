import { RyanlinkManager } from '../src/core/Manager'

jest.mock('ws', () => {
  const { EventEmitter } = require('node:events')
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1
    public static CLOSED = 3
    public readyState = 1
    send = jest.fn()
    close = jest.fn()
    terminate = jest.fn()
    ping = jest.fn()
  }
  return { __esModule: true, default: MockWebSocket, WebSocket: MockWebSocket }
})

describe('Player Filters and State', () => {
  let manager: RyanlinkManager
  let player: any

  beforeEach(async () => {
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn()
    })
    manager.nodeManager.on('error', () => {})
    await manager.init({ id: 'bot123' })
    player = manager.createPlayer({ 
      guildId: 'g1', 
      voiceChannelId: 'v1',
      instaFixFilter: true 
    })
    player.node.sessionId = 'mock-session'
    player.node.info = { filters: ['volume', 'equalizer', 'timescale', 'tremolo', 'vibrato', 'rotation', 'karaoke', 'lowPass', 'distortion', 'channelMix'] } as any
    
    // MOCK NETWORK CALLS
    jest.spyOn(player.node, 'updatePlayer').mockResolvedValue({})
    jest.spyOn(player.node, 'request').mockResolvedValue({})
    jest.spyOn(player.node, 'rawRequest').mockResolvedValue({})
    jest.spyOn(player.node, 'isNodeLink').mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const n of manager.nodeManager.nodes.values()) n.destroy()
  })

  it('setVolume with decrementer', async () => {
    manager.options.playerOptions.volumeDecrementer = 0.5
    const updateSpy = player.node.updatePlayer
    await player.setVolume(120) // Change from 100 to avoid early return
    expect(player.volume).toBe(120)
    expect(player.internalVolume).toBe(60)
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      playerOptions: expect.objectContaining({ volume: 60 })
    }))
  })

  it('setVolume as filter', async () => {
    manager.options.playerOptions.applyVolumeAsFilter = true
    const updateSpy = player.node.updatePlayer
    await player.setVolume(120) // Change from 100
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      playerOptions: expect.objectContaining({ filters: expect.objectContaining({ volume: 1.2 }) })
    }))
  })

  it('setSpeed / setPitch / setRate', async () => {
    const updateSpy = player.node.updatePlayer
    await player.filterManager.setSpeed(1.5)
    expect(player.filterManager.data.timescale.speed).toBe(1.5)
    await player.filterManager.setPitch(1.2)
    expect(player.filterManager.data.timescale.pitch).toBe(1.2)
    await player.filterManager.setRate(0.8)
    expect(player.filterManager.data.timescale.rate).toBe(0.8)
    expect(updateSpy).toHaveBeenCalledTimes(3)
  })

  it('toggleRotation / vibrato / tremolo', async () => {
    const updateSpy = player.node.updatePlayer
    await player.filterManager.toggleRotation(0.5)
    expect(player.filterManager.filters.rotation).toBe(true)
    await player.filterManager.toggleVibrato(10, 2)
    expect(player.filterManager.filters.vibrato).toBe(true)
    await player.filterManager.toggleTremolo(5, 0.5)
    expect(player.filterManager.filters.tremolo).toBe(true)
    expect(updateSpy).toHaveBeenCalledTimes(3)
  })

  it('toggleNightcore / vaporwave', async () => {
    await player.filterManager.toggleNightcore()
    expect(player.filterManager.filters.nightcore).toBe(true)
    expect(player.filterManager.filters.vaporwave).toBe(false)
    
    await player.filterManager.toggleVaporwave()
    expect(player.filterManager.filters.vaporwave).toBe(true)
    expect(player.filterManager.filters.nightcore).toBe(false)
  })

  it('setEQ and clearEQ', async () => {
    const updateSpy = player.node.updatePlayer
    await player.filterManager.setEQ([{ band: 0, gain: 0.5 }])
    expect(player.filterManager.equalizerBands[0].gain).toBe(0.5)
    
    await player.filterManager.clearEQ()
    expect(player.filterManager.equalizerBands[0].gain).toBe(0)
    expect(updateSpy).toHaveBeenCalled()
  })

  it('setAudioOutput', async () => {
    await player.filterManager.setAudioOutput('mono')
    expect(player.filterManager.filters.audioOutput).toBe('mono')
    await expect(player.filterManager.setAudioOutput('invalid' as any)).rejects.toThrow()
  })

  it('resetFilters and clear', async () => {
    await player.filterManager.toggleNightcore()
    await player.filterManager.resetFilters()
    expect(player.filterManager.filters.nightcore).toBe(false)
    
    player.filterManager.equalizerBands = [{ band: 0, gain: 0.5 }]
    await player.filterManager.clear()
    expect(player.filterManager.equalizerBands).toEqual([])
  })

  it('setPreset', async () => {
    await player.filterManager.setPreset('Nightcore')
    expect(player.filterManager.filters.nightcore).toBe(true)
    await player.filterManager.setPreset('Clear')
    expect(player.filterManager.filters.nightcore).toBe(false)
  })

  it('play unresolved track with retry limit', async () => {
    const unresolved = {
      resolve: jest.fn().mockRejectedValue(new Error('fail')),
      info: { title: 'T' }
    } as any
    // @ts-ignore
    player.options.trackResolveRetryLimit = 1
    const emitSpy = jest.spyOn(manager, 'emit')
    
    await player.play({ clientTrack: unresolved })
    expect(emitSpy).toHaveBeenCalledWith('queueErrorReport', expect.anything(), unresolved, expect.anything())
  })

  it('autoResume', async () => {
    player.queue.current = { encoded: 'abc', info: { title: 'T' } } as any
    const playSpy = jest.spyOn(player, 'play').mockResolvedValue(player)
    await player.autoResume()
    expect(playSpy).toHaveBeenCalled()
  })

  it('data methods', () => {
    player.set('key', 'val')
    expect(player.get('key')).toBe('val')
    player.deleteData('key')
    expect(player.get('key')).toBeUndefined()
    
    player.setData('internal_test', 123)
    player.clearData()
    expect(player.getData('internal_test')).toBe(123) // internal data stays
  })
})
