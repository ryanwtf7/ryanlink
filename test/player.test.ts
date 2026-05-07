import { Player, RyanlinkManager, RyanlinkNode } from '../src'

describe('Player', () => {
  let manager: RyanlinkManager
  let player: Player
  let node: RyanlinkNode

  beforeEach(() => {
    manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
    node = new RyanlinkNode({ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }, manager.nodeManager)
    // @ts-ignore
    node.socket = { readyState: 1 }
    // @ts-ignore
    node.sessionId = 'sess'
    manager.nodeManager.nodes.set('local', node)
    player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v', node: 'local' })
  })

  it('updates volume with fade', async () => {
    // @ts-ignore
    node.updatePlayer = jest.fn().mockResolvedValue({})
    await player.setVolume(50)
    expect(player.volume).toBe(50)
  })

  it('handles filters', async () => {
    // @ts-ignore
    node.updatePlayer = jest.fn().mockResolvedValue({})
    await player.filterManager.setSpeed(1.2)
    expect(player.filterManager.data.timescale.speed).toBe(1.2)
    
    await player.filterManager.toggleNightcore()
    expect(player.filterManager.filters.nightcore).toBe(true)
  })

  it('handles pause and resume', async () => {
     // @ts-ignore
     node.updatePlayer = jest.fn().mockResolvedValue({})
     await player.pause(true)
     expect(player.paused).toBe(true)
     await player.pause(false)
     expect(player.paused).toBe(false)
  })
})