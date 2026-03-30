import type { Track, UnresolvedTrack } from './Track'
import type { Awaitable } from './Utils'

export interface StoredQueue {
  current: Track | null
  previous: Track[]
  tracks: (Track | UnresolvedTrack)[]
  position?: number
}

export interface QueueStoreManager {
  get: (guildId: string) => Awaitable<StoredQueue | string | undefined>

  set: (guildId: string, value: StoredQueue | string) => Awaitable<void | boolean>

  delete: (guildId: string) => Awaitable<void | boolean>

  stringify: (value: StoredQueue | string) => Awaitable<StoredQueue | string>

  parse: (value: StoredQueue | string) => Awaitable<Partial<StoredQueue>>
}

export interface ManagerQueueOptions {
  maxPreviousTracks?: number

  queueStore?: QueueStoreManager

  queueChangesWatcher?: QueueChangesWatcher

  resuming?: {
    enabled: boolean
    timeout: number
  }
}

export interface QueueChangesWatcher {
  tracksAdd: (
    guildId: string,
    tracks: (Track | UnresolvedTrack)[],
    position: number,
    oldStoredQueue: StoredQueue,
    newStoredQueue: StoredQueue
  ) => void

  tracksRemoved: (
    guildId: string,
    tracks: (Track | UnresolvedTrack)[],
    position: number | number[],
    oldStoredQueue: StoredQueue,
    newStoredQueue: StoredQueue
  ) => void

  shuffled: (guildId: string, oldStoredQueue: StoredQueue, newStoredQueue: StoredQueue) => void
}
