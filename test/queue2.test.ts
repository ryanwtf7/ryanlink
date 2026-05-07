import { Queue } from '../src/audio/Queue'

describe('Queue - queueChangesWatcher', () => {
  it('calls tracksAdd watcher on add', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    const track = { encoded: 't1', info: { title: 'T1' } } as any
    queue.add(track)
    expect(watcher.tracksAdd).toHaveBeenCalledWith('g', [track], 0, expect.any(Object), expect.any(Object))
  })

  it('calls tracksRemoved watcher on remove', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    const track = { encoded: 't1', info: { title: 'T1' } } as any
    queue.add(track)
    queue.remove(0)
    expect(watcher.tracksRemoved).toHaveBeenCalled()
  })

  it('calls tracksRemoved watcher on clear', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    const track = { encoded: 't1', info: { title: 'T1' } } as any
    queue.add(track)
    queue.clear()
    expect(watcher.tracksRemoved).toHaveBeenCalled()
  })

  it('calls shuffled watcher on shuffle', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    queue.add([
      { encoded: 't1', info: { title: 'T1' } } as any,
      { encoded: 't2', info: { title: 'T2' } } as any,
      { encoded: 't3', info: { title: 'T3' } } as any,
    ])
    queue.shuffle()
    expect(watcher.shuffled).toHaveBeenCalled()
  })

  it('does not call watcher when remove returns empty', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    queue.remove(0) // nothing to remove
    expect(watcher.tracksRemoved).not.toHaveBeenCalled()
  })

  it('does not call watcher when clear returns empty', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    queue.clear() // nothing to clear
    expect(watcher.tracksRemoved).not.toHaveBeenCalled()
  })

  it('add() with index calls watcher with correct index', () => {
    const watcher = {
      tracksAdd: jest.fn(),
      tracksRemoved: jest.fn(),
      shuffled: jest.fn(),
    }
    const queue = new Queue('g', { maxPreviousTracks: 5, queueChangesWatcher: watcher })
    const t1 = { encoded: 't1', info: { title: 'T1' } } as any
    const t2 = { encoded: 't2', info: { title: 'T2' } } as any
    queue.add(t1)
    queue.add(t2, 0)
    expect(watcher.tracksAdd).toHaveBeenCalledTimes(2)
    const secondCall = watcher.tracksAdd.mock.calls[1]
    expect(secondCall[2]).toBe(0) // index
  })
})

describe('Queue - toJSON with player', () => {
  it('toJSON includes player data when player is set', () => {
    const mockPlayer = {
      voiceChannelId: 'vc1',
      textChannelId: 'tc1',
      paused: true,
      volume: 80,
      node: { id: 'n1' },
    }
    const queue = new Queue('g', {}, mockPlayer as any)
    const json = queue.toJSON()
    expect(json.voiceChannel).toBe('vc1')
    expect(json.textChannel).toBe('tc1')
    expect(json.paused).toBe(true)
    expect(json.volume).toBe(80)
    expect(json.nodeId).toBe('n1')
  })
})

describe('Queue - skipTo with previous limit', () => {
  it('skipTo respects maxPreviousTracks', () => {
    const queue = new Queue('g', { maxPreviousTracks: 2 })
    queue.current = { encoded: 'curr', info: {} } as any
    queue.add([
      { encoded: 't1', info: {} } as any,
      { encoded: 't2', info: {} } as any,
    ])
    queue.skipTo(1)
    expect(queue.previous.length).toBeLessThanOrEqual(2)
  })
})
