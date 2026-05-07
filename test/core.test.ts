import { RyanlinkManager } from '../src'

describe('Manager', () => {
  let manager: RyanlinkManager

  beforeEach(() => {
    manager = new RyanlinkManager({ nodes: [], client: { id: '1' }, sendToShard: () => {} })
  })

  it('creates and destroys players', () => {
    const player = manager.createPlayer({ guildId: 'g', voiceChannelId: 'v' })
    expect(manager.players.has('g')).toBe(true)
    manager.destroyPlayer('g')
    expect(manager.players.has('g')).toBe(false)
  })

  it('initializes with options', () => {
    manager.init({ id: 'bot123' })
    expect(manager.options.client.id).toBe('bot123')
  })
})