import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DebugEvents } from '../src/config/Constants'

describe('Manager Expanded', () => {
  let manager: RyanlinkManager

  beforeEach(() => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: vi.fn(),
      advancedOptions: { enableDebugEvents: true }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('init() handles total node connection failure', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    vi.spyOn(node, 'connect').mockImplementation(() => Promise.reject(new Error('Connection failed')))
    
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)

    await manager.init({ id: 'bot123' })
    
    expect(manager.initiated).toBe(false)
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.FailedToConnectToNodes, expect.objectContaining({
      state: 'error',
      message: 'Failed to connect to at least 1 Node'
    }))
  })

  it('provideVoiceUpdate() handles uninitiated manager', async () => {
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    // manager.initiated is false by default
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: {} } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: 'Manager is not initated yet'
    }))
  })

  it('provideVoiceUpdate() handles missing "t" in payload', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ d: {} } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: "No 't' in payload-data of the raw event:"
    }))
  })

  it('provideVoiceUpdate() handles missing update data', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE' } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining('No Update data found')
    }))
  })

  it('provideVoiceUpdate() handles missing token and session_id', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("No 'token' nor 'session_id' found")
    }))
  })

  it('provideVoiceUpdate() handles missing player for guild', async () => {
    await manager.init({ id: 'bot123' })
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'not_found', session_id: 's1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("No Audio Player found")
    }))
  })

  it('provideVoiceUpdate() handles missing sessionId or channelId for updatePlayer', async () => {
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'node_sess'

    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    
    const debugSpy = vi.fn()
    manager.on('debug', debugSpy)
    
    // Test Missing sessionId
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("Missing sessionId")
    }))

    // Test Missing channelId
    player.voice.sessionId = 's1'
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    } as any)
    
    expect(debugSpy).toHaveBeenCalledWith(DebugEvents.NoAudioDebug, expect.objectContaining({
      message: expect.stringContaining("Missing channelId")
    }))
  })

  it('provideVoiceUpdate() handles autoPauseOnMute logic', async () => {
    await manager.init({ id: 'bot123' })
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    player.options.autoPauseOnMute = true
    
    const pauseSpy = vi.spyOn(player, 'pause').mockResolvedValue(player)
    const resumeSpy = vi.spyOn(player, 'resume').mockResolvedValue(player)
    
    // Simulate mute
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v1', self_mute: true, user_id: 'bot123' } 
    } as any)
    
    expect(pauseSpy).toHaveBeenCalled()
    
    // Simulate unmute
    player.voiceState.selfMute = true // Ensure change is detected
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', session_id: 's1', channel_id: 'v1', self_mute: false, user_id: 'bot123' } 
    } as any)
    
    expect(resumeSpy).toHaveBeenCalled()
  })
})
