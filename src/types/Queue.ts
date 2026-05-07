import type { Track, UnresolvedTrack } from './Track'

export interface StoredQueue {
  current: Track | null
  previous: Track[]
  tracks: (Track | UnresolvedTrack)[]
  position?: number
  voiceChannel?: string | null
  textChannel?: string | null
  paused?: boolean
  volume?: number
  nodeId?: string
}

export interface ManagerQueueOptions {
  maxPreviousTracks?: number

  queueChangesWatcher?: QueueChangesWatcher
}

export interface QueueChangesWatcher {
  tracksAdd: (
    guildId: string,
    tracks: (Track | UnresolvedTrack)[],
    position: number,
    oldQueue: StoredQueue,
    newQueue: StoredQueue
  ) => void

  tracksRemoved: (
    guildId: string,
    tracks: (Track | UnresolvedTrack)[],
    position: number | number[],
    oldQueue: StoredQueue,
    newQueue: StoredQueue
  ) => void

  shuffled: (guildId: string, oldQueue: StoredQueue, newQueue: StoredQueue) => void
}
