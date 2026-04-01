const { EventEmitter } = require('node:events')

class MockWebSocket extends EventEmitter {
  public static OPEN = 1
  public static CLOSED = 3
  public readyState = 1
  public binaryType: BinaryType = 'arraybuffer'
  public bufferedAmount = 0
  public extensions = ''
  public protocol = ''
  public onopen: ((this: WebSocket, ev: Event) => any) | null = null
  public onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null
  public onerror: ((this: WebSocket, ev: Event) => any) | null = null
  public onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null
  public url = 'ws://localhost'

  constructor() {
     super()
  }
  send = jest.fn()
  close = jest.fn()
  ping = jest.fn()
  pong = jest.fn()
}

class MockRyanlinkNode {
  public options: any;
  public manager: any;
  public sessionId: string | undefined;
  public socket: InstanceType<typeof MockWebSocket>;
  public initiated: boolean = false;
  public connected: boolean = false;
  public stats: any = { players: 0, playingPlayers: 0, cpu: {}, memory: {}, uptime: 0, detailedStats: {}, frameStats: {} };

  constructor(options: any, manager: any) {
    this.options = options;
    this.manager = manager;
    this.socket = new MockWebSocket();
  }

  connect = jest.fn();
  disconnect = jest.fn();
  destroy = jest.fn();
  updatePlayer = jest.fn();
  request = jest.fn();
  destroyPlayer = jest.fn();
}

jest.mock('ws', () => ({
  __esModule: true,
  default: MockWebSocket,
  WebSocket: MockWebSocket,
}));

jest.mock('../src/node/Node', () => ({
  __esModule: true,
  RyanlinkNode: MockRyanlinkNode,
}));

import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { DestroyReasons } from '../src/config/Constants'

describe('RyanlinkManager', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    LavalinkMock.setResponse('/info', {
      version: { semver: '4.0.0' },
      sourceManagers: ['youtube'],
      filters: ['volume'],
      plugins: [],
    })
    
    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local' }],
      client: { id: '123' },
      sendToShard: jest.fn(),
      playerOptions: {
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false
        }
      }
    })

    const mockNode = new MockRyanlinkNode({ host: 'localhost', port: 2333, authorization: 'pw', id: 'local' }, manager.nodeManager);
    mockNode.sessionId = 'mock-session';
    mockNode.socket = new MockWebSocket(); // Use the globally defined MockWebSocket
    mockNode.connected = true; // Mark as connected for tests

    manager.nodeManager.nodes.set('local', mockNode as any);
    manager.initiated = true
  })

  it('initializes and manages players', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    expect(manager.getPlayer('g1')).toBe(player)
    await manager.destroyPlayer('g1')
    expect(manager.getPlayer('g1')).toBeUndefined()
  })

  it('handles CHANNEL_DELETE voice update', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const destroySpy = jest.spyOn(player, 'destroy').mockResolvedValue(undefined as any)
    
    await manager.provideVoiceUpdate({ t: 'CHANNEL_DELETE', d: { guild_id: 'g1', id: 'vc1' } } as any)
    expect(destroySpy).toHaveBeenCalledWith(DestroyReasons.ChannelDeleted)
  })

  it('handles VOICE_SERVER_UPDATE', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    player.voice.sessionId = 's1' 
    player.voice.channelId = 'vc1' // MUST be set
    const node = player.node!
    const updateSpy = jest.spyOn(node, 'updatePlayer').mockResolvedValue({} as any)

    await manager.provideVoiceUpdate({ 
      t: 'VOICE_SERVER_UPDATE', 
      d: { guild_id: 'g1', token: 't1', endpoint: 'e1' } 
    } as any)

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      guildId: 'g1',
      playerOptions: {
        voice: expect.objectContaining({
          token: 't1',
          endpoint: 'e1'
        })
      }
    }))
  })

  it('handles VOICE_STATE_UPDATE (user join/leave)', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    
    const joinSpy = jest.fn()
    manager.on('playerVoiceJoin', joinSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc1', user_id: '456', session_id: 's2' } 
    } as any)
    expect(joinSpy).toHaveBeenCalledWith(player, '456')

    const leaveSpy = jest.fn()
    manager.on('playerVoiceLeave', leaveSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc2', user_id: '456', session_id: 's2' } 
    } as any)
    expect(leaveSpy).toHaveBeenCalledWith(player, '456')
  })

  it('handles VOICE_STATE_UPDATE (self move)', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const moveSpy = jest.fn()
    manager.on('playerMove', moveSpy)
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc2', user_id: '123', session_id: 's1' } 
    } as any)
    expect(moveSpy).toHaveBeenCalledWith(player, 'vc1', 'vc2')
    expect(player.voiceChannelId).toBe('vc2')
  })

  it('handles mute/deaf changes', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    const muteSpy = jest.fn()
    manager.on('playerMuteChange', muteSpy)
    
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: 'vc1', user_id: '123', self_mute: true, mute: false, session_id: 's1' } 
    } as any)
    expect(muteSpy).toHaveBeenCalled()
  })

  it('handles autoReconnect on disconnect', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'vc1' })
    jest.spyOn(player, 'play').mockResolvedValue(player as any)
    const connectSpy = jest.spyOn(player, 'connect').mockResolvedValue(true as any)
    
    // Disconnect packet
    await manager.provideVoiceUpdate({ 
      t: 'VOICE_STATE_UPDATE', 
      d: { guild_id: 'g1', channel_id: null, user_id: '123', session_id: 's1' } 
    } as any)
    
    expect(connectSpy).toHaveBeenCalled()
  })

  it('handles invalid voice updates gracefully', async () => {
    await manager.provideVoiceUpdate({} as any)
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'unknown' } } as any)
    await manager.provideVoiceUpdate({ t: 'VOICE_STATE_UPDATE', d: { guild_id: 'g1' } } as any)
  })
})
