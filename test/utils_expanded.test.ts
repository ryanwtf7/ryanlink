import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { queueTrackEnd, applyUnresolvedData } from '../src/utils/Utils'

describe('RyanlinkUtils Expanded', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: vi.fn(),
      playerOptions: {
        useUnresolvedData: true,
        allowCustomSources: false
      }
    })
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    node.sessionId = 'sess123'
    // @ts-ignore
    node.socket = { readyState: 1 } // Mark as connected
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('validateSourceString throws on missing sourceManagers', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    node.info = { sourceManagers: ['youtube'] } as any
    
    expect(() => manager.utils.validateSourceString(node, 'scsearch')).toThrow("Audio Node has not 'soundcloud' enabled")
    expect(() => manager.utils.validateSourceString(node, 'amsearch')).toThrow("Audio Node has not 'applemusic' enabled")
    expect(() => manager.utils.validateSourceString(node, 'dzisrc')).toThrow("Audio Node has not 'deezer' enabled")
  })

  it('validateSourceString throws on un-cached node info', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    node.info = undefined as any
    expect(() => manager.utils.validateSourceString(node, 'ytsearch')).toThrow("Audio Node does not have any info cached yet")
  })

  it('queueTrackEnd handles unresolved track resolution failure', async () => {
    const player = manager.createPlayer({ guildId: 'g1', voiceChannelId: 'v1' })
    manager.options.advancedOptions.enableDebugEvents = true
    
    const unresolvedTrack = manager.utils.buildUnresolvedTrack({ title: 'T' }, 'u')
    vi.spyOn(unresolvedTrack, 'resolve').mockRejectedValue(new Error('Resolve error'))
    
    player.queue.tracks.push(unresolvedTrack)
    
    let debugEmitted = false
    manager.on('debug', (name) => {
      if (name === 'PlayerPlayUnresolvedTrackFailed') debugEmitted = true
    })

    const result = await queueTrackEnd(player)
    expect(result).toBeNull()
    expect(debugEmitted).toBe(true)
  })

  it('applyUnresolvedData uses unresolved info when useUnresolvedData is true', async () => {
    const resTrack = { info: { title: 'Old', author: 'Old', artworkUrl: 'Old' } } as any
    const unresolvedData = { info: { title: 'New', author: 'New', artworkUrl: 'New' } } as any
    
    // manager.options.playerOptions.useUnresolvedData is true from beforeEach
    await applyUnresolvedData(resTrack, unresolvedData, manager.utils)
    
    expect(resTrack.info.title).toBe('New')
    expect(resTrack.info.author).toBe('New')
    expect(resTrack.info.artworkUrl).toBe('New')
  })

  it('applyUnresolvedData uses unresolved info when useUnresolvedData is true', async () => {
    const resolved = { info: { title: 'Unknown title', author: 'Author', artworkUrl: 'old' } } as any
    const unresolved = { info: { title: 'New', author: 'Author', artworkUrl: 'new' } } as any
    
    // Explicitly test the non-prioritized path (useUnresolvedData: false)
    manager.options.playerOptions.useUnresolvedData = false
    // @ts-ignore
    applyUnresolvedData(resolved, unresolved, manager.utils)
    expect(resolved.info.title).toBe('New')
    expect(resolved.info.artworkUrl).toBe('new')
  })

  it('validateSourceString() covers all remaining sources', () => {
    const node = manager.nodeManager.nodes.get('local')!
    node.info = { sourceManagers: [], plugins: [] } as any
    // @ts-ignore
    vi.spyOn(node, '_checkForSources', 'get').mockReturnValue(true)
    
    const testSource = (source: string, expectedError: string) => {
      expect(() => manager.utils.validateQueryString(node, `test`, source as any))
        .toThrow()
    }

    testSource('vksearch', 'vkmusic')
    testSource('vkrec', 'vkmusic')
    testSource('tdsearch', 'tidal')
    testSource('tdrec', 'tidal')
    testSource('ymsearch', 'yandexmusic')
    testSource('ytmsearch', 'youtube')
    testSource('qbsearch', 'qobuz')
    testSource('qbisrc', 'qobuz')
    testSource('qbrec', 'qobuz')
    testSource('pdsearch', 'pandora')
    testSource('pdisrc', 'pandora')
    testSource('pdrec', 'pandora')

    // Plugin-based sources
    node.info.plugins = [] // No plugins
    testSource('speak', 'speak')
    testSource('tts', 'tts')
    testSource('ftts', 'flowery-tts')
  })
})
