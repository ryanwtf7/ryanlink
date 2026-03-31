import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Queue Comprehensive', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ 
        host: 'localhost', id: 'local', port: 2333, authorization: 'pw',
        autoChecks: { sourcesValidations: true }
      }],
      sendToShard: vi.fn(),
    })
    await manager.init({ id: 'bot123' })
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.socket = { readyState: 1 }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles queueChanges callback errors (splice)', async () => {
    const player = manager.createPlayer({ guildId: 'q1', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 't1', info: { title: 'T1' } } as any, 'user')
    await player.queue.add(track)
    
    // Set callback that throws
    // @ts-ignore
    player.queue.queueChanges = {
      tracksRemoved: vi.fn().mockImplementation(() => { throw new Error('Callback Error') }),
      tracksAdd: vi.fn(),
      shuffled: vi.fn()
    }

    // Splice (removes track) - should not throw
    await player.queue.splice(0, 1)
    expect(player.queue.tracks.length).toBe(0)
    // @ts-ignore
    expect(player.queue.queueChanges.tracksRemoved).toHaveBeenCalled()
  })

  it('handles queueChanges callback errors (remove)', async () => {
    const player = manager.createPlayer({ guildId: 'q2', voiceChannelId: 'v1' })
    const track = manager.utils.buildTrack({ encoded: 't1', info: { title: 'T1' } } as any, 'user')
    await player.queue.add(track)
    
    // @ts-ignore
    player.queue.queueChanges = {
      tracksRemoved: vi.fn().mockImplementation(() => { throw new Error('Callback Error') }),
      tracksAdd: vi.fn(),
      shuffled: vi.fn()
    }

    // Remove track - should not throw
    await player.queue.remove(0)
    expect(player.queue.tracks.length).toBe(0)
  })

  it('handles sortBy all cases', async () => {
    const player = manager.createPlayer({ guildId: 'q3', voiceChannelId: 'v1' })
    const tracks = [
      { encoded: 'e1', info: { title: 'C', author: 'Z', duration: 300 } },
      { encoded: 'e2', info: { title: 'A', author: 'Y', duration: 100 } },
      { encoded: 'e3', info: { title: 'B', author: 'X', duration: 200 } },
    ].map(t => manager.utils.buildTrack(t as any, 'user'))
    await player.queue.add(tracks)

    // Sort by duration DESC
    await player.queue.sortBy('duration', 'desc')
    expect(player.queue.tracks[0].info.duration).toBe(300)

    // Sort by title ASC
    await player.queue.sortBy('title', 'asc')
    expect(player.queue.tracks[0].info.title).toBe('A')

    // Sort by author ASC
    await player.queue.sortBy('author', 'asc')
    expect(player.queue.tracks[0].info.author).toBe('X')

    // Custom sort function
    await player.queue.sortBy((a: any, b: any) => b.info.duration - a.info.duration)
    expect(player.queue.tracks[0].info.duration).toBe(300)
  })

  it('handles toSortedBy all cases', async () => {
    const player = manager.createPlayer({ guildId: 'q4', voiceChannelId: 'v1' })
    const tracks = [
      { encoded: 'e1', info: { title: 'C', author: 'Z' } },
      { encoded: 'e2', info: { title: 'A', author: 'Y' } },
    ].map(t => manager.utils.buildTrack(t as any, 'user'))
    await player.queue.add(tracks)

    const sortedByTitle = player.queue.toSortedBy('title', 'asc')
    expect(sortedByTitle[0].info.title).toBe('A')
    
    const sortedByAuthor = player.queue.toSortedBy('author', 'desc')
    expect(sortedByAuthor[0].info.author).toBe('Z')

    const customSorted = player.queue.toSortedBy((a: any, b: any) => a.info.title.localeCompare(b.info.title))
    expect(customSorted[0].info.title).toBe('A')

    // Verify original queue is not changed by toSortedBy
    expect(player.queue.tracks[0].info.title).toBe('C')
  })

  it('handles find and filter by object predicate', async () => {
    const player = manager.createPlayer({ guildId: 'q5', voiceChannelId: 'v1' })
    const tracks = [
      { encoded: 't1', info: { title: 'Song 1', author: 'Artist A', duration: 100, sourceName: 'youtube' } },
      { encoded: 't2', info: { title: 'Song 2', author: 'Artist B', duration: 200, sourceName: 'spotify' } },
      { encoded: 't3', info: { title: 'Other', author: 'Artist A', duration: 150, sourceName: 'youtube' } },
    ].map(t => manager.utils.buildTrack(t as any, 'user'))
    await player.queue.add(tracks)

    // Find by title
    expect(player.queue.utils.filterTracks({ title: 'Song' }).length).toBe(2)
    // Find by author
    expect(player.queue.utils.filterTracks({ author: 'Artist B' }).length).toBe(1)
    // Find by duration range
    expect(player.queue.utils.filterTracks({ duration: { min: 120, max: 180 } }).length).toBe(1)
    // Find by source
    expect(player.queue.utils.filterTracks({ sourceName: 'spotify' }).length).toBe(1)
    // Find by predicate function
    expect(player.queue.utils.filterTracks((t: any) => t.info.duration > 120).length).toBe(2)

    // findTrack method
    expect(player.queue.utils.findTrack({ title: 'Other' })?.track.info.title).toBe('Other')
  })

  it('handles shuffle and shuffled callback', async () => {
    const player = manager.createPlayer({ guildId: 'q6', voiceChannelId: 'v1' })
    const tracks = Array(10).fill(0).map((_, i) => manager.utils.buildTrack({ encoded: `e${i}`, info: { title: `T${i}` } } as any, 'user'))
    await player.queue.add(tracks)
    
    // @ts-ignore
    player.queue.queueChanges = {
      shuffled: vi.fn(),
      tracksAdd: vi.fn(),
      tracksRemoved: vi.fn()
    }

    await player.queue.shuffle()
    // @ts-ignore
    expect(player.queue.queueChanges.shuffled).toHaveBeenCalled()
  })

  it('handles clear and remove by index', async () => {
    const player = manager.createPlayer({ guildId: 'q7', voiceChannelId: 'v1' })
    await player.queue.add(Array(5).fill(0).map((_, i) => manager.utils.buildTrack({ encoded: `e${i}`, info: { title: `T${i}` } } as any, 'user')))
    
    await player.queue.remove(0)
    expect(player.queue.tracks.length).toBe(4)
    
    await player.queue.splice(0, player.queue.tracks.length)
    expect(player.queue.tracks.length).toBe(0)
  })
})
