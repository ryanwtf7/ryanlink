import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DestroyReasons, DebugEvents } from '../src/config/Constants'

describe('RyanlinkManager Comprehensive', () => {
  let manager: RyanlinkManager

  beforeEach(() => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: vi.fn(),
      playerOptions: {
        onDisconnect: {
          autoReconnect: true,
          autoReconnectOnlyWithTracks: true
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('init() handles node connection failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const MockNode = Array.from(manager.nodeManager.nodes.values())[0]
    vi.spyOn(MockNode, 'connect').mockRejectedValue(new Error('Connect failed'))
    
    await manager.init({ id: 'bot123' })
    expect(errorSpy).toHaveBeenCalled()
    expect(manager.initiated).toBe(false)
  })

  it('provideVoiceUpdate() handles uninitiated manager', async () => {
    const debugSpy = vi.spyOn(manager as any, '_debugNoAudio')
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: {} } as any)
    expect(debugSpy).toHaveBeenCalledWith('log', expect.stringContaining('initated'), expect.anything())
  })

  it('provideVoiceUpdate() handles missing session/channel ID', async () => {
    await manager.init({ id: 'bot123' })
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    const debugSpy = vi.spyOn(manager as any, '_debugNoAudio')

    // Missing token/session_id
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('error', expect.stringContaining('token'), expect.anything())

    // Missing session_id for VOICE_SERVER_UPDATE
    await manager.provideVoiceUpdate({ t: 'VOICE_SERVER_UPDATE', d: { guild_id: 'g1', token: 't' } } as any)
    expect(debugSpy).toHaveBeenCalledWith('error', expect.stringContaining('sessionId'), expect.anything())
  })

  it('provideVoiceUpdate() handles autoPauseOnMute logic', async () => {
    await manager.init({ id: 'bot123' })
    manager.options.playerOptions.autoPauseOnMute = true
    const player = manager.createPlayer({ guildId: 'pause1', voiceChannelId: 'v1' })
    const pauseSpy = vi.spyOn(player, 'pause').mockResolvedValue(player)
    const resumeSpy = vi.spyOn(player, 'resume').mockResolvedValue(player)

    // Mute on
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'pause1', channel_id: 'v1', user_id: 'bot123', session_id: 's1', self_mute: true } 
    } as any)
    expect(pauseSpy).toHaveBeenCalled()

    // Mute off
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'pause1', channel_id: 'v1', user_id: 'bot123', session_id: 's1', self_mute: false } 
    } as any)
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('provideVoiceUpdate() handles autoReconnect track dependency', async () => {
    await manager.init({ id: 'bot123' })
    const player = manager.createPlayer({ guildId: 'recon1', voiceChannelId: 'v1' })
    const connectSpy = vi.spyOn(player, 'connect').mockResolvedValue(player)
    
    // Disconnect without tracks (should not reconnect due to autoReconnectOnlyWithTracks: true)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'recon1', channel_id: null, user_id: 'bot123', session_id: 's1' } 
    } as any)
    expect(connectSpy).not.toHaveBeenCalled()

    // Add track and disconnect (should reconnect)
    player.queue.add({ encoded: 'e' } as any)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'recon1', channel_id: null, user_id: 'bot123', session_id: 's1' } 
    } as any)
    expect(connectSpy).toHaveBeenCalled()
  })

  it('provideVoiceUpdate() handles playerVoiceJoin/Leave', async () => {
    await manager.init({ id: 'bot123' })
    const player = manager.createPlayer({ guildId: 'voice1', voiceChannelId: 'v1' })
    const emitSpy = vi.spyOn(manager, 'emit')

    // Join
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'voice1', channel_id: 'v1', user_id: 'other_user', session_id: 's1' } 
    } as any)
    expect(emitSpy).toHaveBeenCalledWith('playerVoiceJoin', player, 'other_user')

    // Leave
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'voice1', channel_id: 'v2', user_id: 'other_user', session_id: 's1' } 
    } as any)
    expect(emitSpy).toHaveBeenCalledWith('playerVoiceLeave', player, 'other_user')
  })
})
