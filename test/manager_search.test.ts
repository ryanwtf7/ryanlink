import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'

describe('RyanlinkManager.search', () => {
  let manager: RyanlinkManager
  const BOT_ID = 'bot123'

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: BOT_ID, username: 'Ryanlink' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: vi.fn(),
    })
    await manager.init({ id: BOT_ID })
    
    // Connect the node manually for testing
    const node = manager.nodeManager.nodes.get('local')!
    // Mock connectivity
    vi.spyOn(node, 'connected', 'get').mockReturnValue(true)
    // @ts-ignore
    node.socket = { readyState: 1 }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('delegates search to the least used node when no node is provided', async () => {
    const searchResult = { loadType: 'search', tracks: [], playlist: null, pluginInfo: {}, exception: null }
    const node = manager.nodeManager.nodes.get('local')!
    const searchSpy = vi.spyOn(node, 'search').mockResolvedValue(searchResult as any)

    const result = await manager.search('test query')

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test query', source: 'ytsearch' }),
      undefined,
      false
    )
    expect(result).toEqual(searchResult)
  })

  it('handles search prefixes automatically (e.g., spsearch:)', async () => {
    const searchResult = { loadType: 'search', tracks: [], playlist: null, pluginInfo: {}, exception: null }
    const node = manager.nodeManager.nodes.get('local')!
    const searchSpy = vi.spyOn(node, 'search').mockResolvedValue(searchResult as any)

    await manager.search('spsearch:test query')

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test query', source: 'spsearch' }),
      undefined,
      false
    )
  })

  it('throws an error if no nodes are available', async () => {
    const node = manager.nodeManager.nodes.get('local')!
    // Mock disconnect
    vi.spyOn(node, 'connected', 'get').mockReturnValue(false)

    await expect(manager.search('test')).rejects.toThrow('No nodes are available / connected to perform a search.')
  })

  it('supports object-based searching queries', async () => {
    const searchResult = { loadType: 'search', tracks: [], playlist: null, pluginInfo: {}, exception: null }
    const node = manager.nodeManager.nodes.get('local')!
    const searchSpy = vi.spyOn(node, 'search').mockResolvedValue(searchResult as any)

    const result = await manager.search({ query: 'lofi girl', source: 'spotify' })

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'lofi girl', source: 'spsearch' }),
      undefined,
      false
    )
    expect(result).toEqual(searchResult)
  })

  it('supports object-based searching with extra parameters', async () => {
    const searchResult = { loadType: 'search', tracks: [], playlist: null, pluginInfo: {}, exception: null }
    const node = manager.nodeManager.nodes.get('local')!
    const searchSpy = vi.spyOn(node, 'search').mockResolvedValue(searchResult as any)

    const params = new URLSearchParams({ limit: '1' })
    await manager.search({ query: 'test', extraQueryUrlParams: params })

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test', extraQueryUrlParams: params }),
      undefined,
      false
    )
  })

  it('uses specific node if provided', async () => {
    const searchResult = { loadType: 'search', tracks: [], playlist: null, pluginInfo: {}, exception: null }
    const node = manager.nodeManager.nodes.get('local')!
    const searchSpy = vi.spyOn(node, 'search').mockResolvedValue(searchResult as any)

    await manager.search('test', 'user', node)

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test' }),
      'user',
      false
    )
  })
})
