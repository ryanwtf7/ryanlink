import type { ManagerQueueOptions, QueueChangesWatcher, QueueStoreManager, StoredQueue } from '../types/Queue'
import type { Track, UnresolvedTrack } from '../types/Track'
import { RyanlinkUtils, AudioQueueSymbol } from '../utils/Utils'
import { MemoryQueueStore, DefaultQueueStore } from './QueueStore'
export { MemoryQueueStore, DefaultQueueStore };

export class QueueSaver {
  private _: QueueStoreManager

  public options: {
    maxPreviousTracks: number
  }
  constructor(options: ManagerQueueOptions) {
    this._ = options?.queueStore || new MemoryQueueStore()
    this.options = {
      maxPreviousTracks: options?.maxPreviousTracks || 25,
    }
  }

  async get(guildId: string) {
    return this._.parse(await this._.get(guildId))
  }

  async delete(guildId: string) {
    return this._.delete(guildId)
  }

  async set(guildId: string, valueToStringify: StoredQueue) {
    return this._.set(guildId, await this._.stringify(valueToStringify))
  }

  async sync(guildId: string) {
    return this.get(guildId)
  }
}



export class Queue {
  public readonly tracks: (Track | UnresolvedTrack)[] = []
  public readonly previous: Track[] = []
  public current: Track | null = null
  public options = { maxPreviousTracks: 25 }
  public position: number = 0
  private readonly guildId: string = ''
  private readonly QueueSaver: QueueSaver | null = null
  private managerUtils = new RyanlinkUtils()
  private queueChanges: QueueChangesWatcher | null

  constructor(guildId: string, data: Partial<StoredQueue> = {}, queueSaver?: QueueSaver, queueOptions?: ManagerQueueOptions) {
    this.queueChanges = queueOptions?.queueChangesWatcher || null
    this.guildId = guildId
    this.QueueSaver = queueSaver
    this.position = data.position || 0

    this.current = this.managerUtils.isTrack(data.current) ? data.current : null
    this.previous =
      Array.isArray(data.previous) && data.previous.some((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        ? data.previous.filter((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        : []
    this.tracks =
      Array.isArray(data.tracks) && data.tracks.some((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        ? data.tracks.filter((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        : []

    const createShadowListener = (target: any[]) => {
      return new Proxy(target, {
        set: (obj, prop, value) => {
          const ret = Reflect.set(obj, prop, value)
          if (prop !== 'length') this.utils.save().catch(() => {})
          return ret
        },
        deleteProperty: (obj, prop) => {
          const ret = Reflect.deleteProperty(obj, prop)
          this.utils.save().catch(() => {})
          return ret
        },
      })
    }

    this.tracks = createShadowListener(this.tracks)
    this.previous = createShadowListener(this.previous)

    Object.defineProperty(this, AudioQueueSymbol, { configurable: true, value: true })
    if (queueOptions?.resuming?.enabled) {
      this.utils.sync().catch(() => {})
    }
  }

  public utils = {
    save: async () => {
      if (this.previous.length > this.options.maxPreviousTracks) this.previous.splice(this.options.maxPreviousTracks, this.previous.length)
      return await this.QueueSaver.set(this.guildId, this.utils.toJSON())
    },

    sync: async (override = true, dontSyncCurrent = true) => {
      const data = await this.QueueSaver.get(this.guildId)
      if (!data) throw new Error(`No data found to sync for guildId: ${this.guildId}`)
      if (!dontSyncCurrent && !this.current && this.managerUtils.isTrack(data.current)) this.current = data.current
      if (
        Array.isArray(data.tracks) &&
        data?.tracks.length &&
        data.tracks.some((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
      )
        this.tracks.splice(
          override ? 0 : this.tracks.length,
          override ? this.tracks.length : 0,
          ...data.tracks.filter((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        )
      if (
        Array.isArray(data.previous) &&
        data?.previous.length &&
        data.previous.some((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
      )
        this.previous.splice(
          0,
          override ? this.previous.length : 0,
          ...data.previous.filter((track) => this.managerUtils.isTrack(track) || this.managerUtils.isUnresolvedTrack(track))
        )

      await this.utils.save()

      return
    },

    destroy: async () => {
      return await this.QueueSaver.delete(this.guildId)
    },

    toJSON: (): StoredQueue => {
      if (this.previous?.length > this.options?.maxPreviousTracks)
        this.previous?.splice(this.options?.maxPreviousTracks, this.previous.length)
      return {
        current: this.current ? { ...this.current } : null,
        previous: this.previous ? [...this.previous] : [],
        tracks: this.tracks ? [...this.tracks] : [],
        position: this.position,
      }
    },

    totalDuration: () => {
      return this.tracks.reduce((acc: number, cur) => acc + (cur.info.duration || 0), this.current?.info.duration || 0)
    },

    filterTracks: (
      predicate:
        | ((track: Track | UnresolvedTrack, index: number) => boolean)
        | {
            title?: string
            author?: string
            duration?: number | { min?: number; max?: number }
            uri?: string
            identifier?: string
            sourceName?: string
            isStream?: boolean
            isSeekable?: boolean
          }
    ): Array<{ track: Track | UnresolvedTrack; index: number }> => {
      if (typeof predicate === 'function') {
        return this.tracks.map((track, index) => ({ track, index })).filter(({ track, index }) => predicate(track, index))
      }

      return this.tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => {
          if (predicate.title && !track.info?.title?.toLowerCase().includes(predicate.title.toLowerCase())) {
            return false
          }

          if (predicate.author && !track.info?.author?.toLowerCase().includes(predicate.author.toLowerCase())) {
            return false
          }

          if (predicate.duration !== undefined) {
            const duration = track.info?.duration || 0
            if (typeof predicate.duration === 'number') {
              if (duration !== predicate.duration) return false
            } else {
              if (predicate.duration.min !== undefined && duration < predicate.duration.min) return false
              if (predicate.duration.max !== undefined && duration > predicate.duration.max) return false
            }
          }

          if (predicate.uri && track.info?.uri !== predicate.uri) {
            return false
          }

          if (predicate.identifier && track.info?.identifier !== predicate.identifier) {
            return false
          }

          if (predicate.sourceName && track.info?.sourceName?.toLowerCase() !== predicate.sourceName.toLowerCase()) {
            return false
          }

          if (predicate.isStream !== undefined && track.info?.isStream !== predicate.isStream) {
            return false
          }

          if (predicate.isSeekable !== undefined && track.info?.isSeekable !== predicate.isSeekable) {
            return false
          }

          return true
        })
    },

    findTrack: (
      predicate:
        | ((track: Track | UnresolvedTrack, index: number) => boolean)
        | {
            title?: string
            author?: string
            duration?: number | { min?: number; max?: number }
            uri?: string
            identifier?: string
            sourceName?: string
            isStream?: boolean
            isSeekable?: boolean
          }
    ): { track: Track | UnresolvedTrack; index: number } | null => {
      const results = this.utils.filterTracks(predicate)
      return results.length > 0 ? results[0] : null
    },
  }

  public async shuffle() {
    const oldStored = typeof this.queueChanges?.shuffled === 'function' ? this.utils.toJSON() : null

    if (this.tracks.length <= 1) return this.tracks.length

    this.managerUtils.shuffle(this.tracks)

    if (typeof this.queueChanges?.shuffled === 'function') this.queueChanges.shuffled(this.guildId, oldStored, this.utils.toJSON())

    await this.utils.save()
    return this.tracks.length
  }

  public async clear() {
    const oldStored = typeof this.queueChanges?.tracksRemoved === 'function' ? this.utils.toJSON() : null
    const removed = this.tracks.splice(0, this.tracks.length)

    if (typeof this.queueChanges?.tracksRemoved === 'function')
      try {
        this.queueChanges.tracksRemoved(this.guildId, removed, 0, oldStored, this.utils.toJSON())
      } catch {
        void 0;
      }

    await this.utils.save()
    return removed.length
  }

  public async add(TrackOrTracks: Track | UnresolvedTrack | (Track | UnresolvedTrack)[], index?: number) {
    if (typeof index === 'number' && index >= 0 && index < this.tracks.length) {
      return await this.splice(
        index,
        0,
        (Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
          .flat(2)
          .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v))
      )
    }

    const oldStored = typeof this.queueChanges?.tracksAdd === 'function' ? this.utils.toJSON() : null

    this.tracks.push(
      ...(Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
        .flat(2)
        .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v))
    )

    if (typeof this.queueChanges?.tracksAdd === 'function')
      try {
        this.queueChanges.tracksAdd(
          this.guildId,
          (Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
            .flat(2)
            .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v)),
          this.tracks.length,
          oldStored,
          this.utils.toJSON()
        )
      } catch {
        void 0;
      }

    await this.utils.save()

    return this.tracks.length
  }

  public async splice(index: number, amount: number, TrackOrTracks?: Track | UnresolvedTrack | (Track | UnresolvedTrack)[]) {
    const oldStored =
      typeof this.queueChanges?.tracksAdd === 'function' || typeof this.queueChanges?.tracksRemoved === 'function' ? this.utils.toJSON() : null

    if (!this.tracks.length) {
      if (TrackOrTracks) return await this.add(TrackOrTracks)
      return null
    }

    if (TrackOrTracks && typeof this.queueChanges?.tracksAdd === 'function')
      try {
        this.queueChanges.tracksAdd(
          this.guildId,
          (Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
            .flat(2)
            .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v)),
          index,
          oldStored,
          this.utils.toJSON()
        )
      } catch {
        void 0;
      }

    const spliced = TrackOrTracks
      ? this.tracks.splice(
          index,
          amount,
          ...(Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
            .flat(2)
            .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v))
        )
      : this.tracks.splice(index, amount)

    if (typeof this.queueChanges?.tracksRemoved === 'function')
      try {
        this.queueChanges.tracksRemoved(this.guildId, spliced, index, oldStored, this.utils.toJSON())
      } catch {
        void 0;
      }

    await this.utils.save()

    return spliced.length === 1 ? spliced[0] : spliced
  }

  public async remove<T extends Track | UnresolvedTrack | number | Track[] | UnresolvedTrack[] | number[] | (number | Track | UnresolvedTrack)[]>(
    removeQueryTrack: T
  ): Promise<{ removed: (Track | UnresolvedTrack)[] } | null> {
    if (removeQueryTrack === null || removeQueryTrack === undefined || (Array.isArray(removeQueryTrack) && removeQueryTrack.length === 0)) {
      return null
    }

    const oldStored = typeof this.queueChanges?.tracksRemoved === 'function' ? this.utils.toJSON() : null
    if (typeof removeQueryTrack === 'number') {
      const toRemove = this.tracks[removeQueryTrack]
      if (!toRemove) return null

      const removed = this.tracks.splice(removeQueryTrack, 1)

      if (typeof this.queueChanges?.tracksRemoved === 'function')
        try {
          this.queueChanges.tracksRemoved(this.guildId, removed, removeQueryTrack, oldStored, this.utils.toJSON())
        } catch {
        void 0;
      }

      await this.utils.save()

      return { removed }
    }

    if (Array.isArray(removeQueryTrack)) {
      if (removeQueryTrack.every((v) => typeof v === 'number')) {
        const removed = []
        const sortedIndexes = (removeQueryTrack as number[]).sort((a, b) => b - a)
        for (const i of sortedIndexes) {
          if (this.tracks[i]) {
            removed.unshift(...this.tracks.splice(i, 1))
          }
        }
        if (!removed.length) return null

        if (typeof this.queueChanges?.tracksRemoved === 'function')
          try {
            this.queueChanges.tracksRemoved(this.guildId, removed, removeQueryTrack as number[], oldStored, this.utils.toJSON())
          } catch {
        void 0;
      }

        await this.utils.save()

        return { removed }
      }

      const tracksToRemove = this.tracks
        .map((v, i) => ({ v, i }))
        .filter(({ v, i }) =>
          removeQueryTrack.find(
            (t) =>
              (typeof t === 'number' && t === i) ||
              (typeof t === 'object' &&
                ((t.encoded && t.encoded === v.encoded) ||
                  (t.info?.identifier && t.info.identifier === v.info?.identifier) ||
                  (t.info?.uri && t.info.uri === v.info?.uri) ||
                  (t.info?.title && t.info.title === v.info?.title) ||
                  (t.info?.isrc && t.info.isrc === v.info?.isrc) ||
                  (t.info?.artworkUrl && t.info.artworkUrl === v.info?.artworkUrl)))
          )
        )

      if (!tracksToRemove.length) return null

      const removed = []

      tracksToRemove.sort((a, b) => b.i - a.i)
      for (const { i } of tracksToRemove) {
        if (this.tracks[i]) {
          removed.unshift(...this.tracks.splice(i, 1))
        }
      }

      if (typeof this.queueChanges?.tracksRemoved === 'function')
        try {
          this.queueChanges.tracksRemoved(
            this.guildId,
            removed,
            tracksToRemove.map((v) => v.i),
            oldStored,
            this.utils.toJSON()
          )
        } catch {
        void 0;
      }

      await this.utils.save()

      return { removed }
    }
    const toRemove = this.tracks.findIndex(
      (v) =>
        (removeQueryTrack.encoded && removeQueryTrack.encoded === v.encoded) ||
        (removeQueryTrack.info?.identifier && removeQueryTrack.info.identifier === v.info?.identifier) ||
        (removeQueryTrack.info?.uri && removeQueryTrack.info.uri === v.info?.uri) ||
        (removeQueryTrack.info?.title && removeQueryTrack.info.title === v.info?.title) ||
        (removeQueryTrack.info?.isrc && removeQueryTrack.info.isrc === v.info?.isrc) ||
        (removeQueryTrack.info?.artworkUrl && removeQueryTrack.info.artworkUrl === v.info?.artworkUrl)
    )

    if (toRemove < 0) return null

    const removed = this.tracks.splice(toRemove, 1)

    if (typeof this.queueChanges?.tracksRemoved === 'function')
      try {
        this.queueChanges.tracksRemoved(this.guildId, removed, toRemove, oldStored, this.utils.toJSON())
      } catch {
        void 0;
      }

    await this.utils.save()

    return { removed }
  }

  public async shiftPrevious() {
    const removed = this.previous.shift()
    if (removed) await this.utils.save()
    return removed ?? null
  }

  public filter(
    predicate:
      | ((track: Track | UnresolvedTrack, index: number) => boolean)
      | {
          title?: string
          author?: string
          duration?: number | { min?: number; max?: number }
          uri?: string
          identifier?: string
          sourceName?: string
          isStream?: boolean
          isSeekable?: boolean
        }
  ): Array<{ track: Track | UnresolvedTrack; index: number }> {
    return this.utils.filterTracks(predicate)
  }

  public find(
    predicate:
      | ((track: Track | UnresolvedTrack, index: number) => boolean)
      | {
          title?: string
          author?: string
          duration?: number | { min?: number; max?: number }
          uri?: string
          identifier?: string
          sourceName?: string
          isStream?: boolean
          isSeekable?: boolean
        }
  ): { track: Track | UnresolvedTrack; index: number } | null {
    return this.utils.findTrack(predicate)
  }

  public async sortBy(
    sortBy: 'duration' | 'title' | 'author' | ((a: Track | UnresolvedTrack, b: Track | UnresolvedTrack) => number),
    order: 'asc' | 'desc' = 'asc'
  ): Promise<this> {
    if (typeof sortBy === 'function') {
      this.tracks.sort(sortBy)
    } else {
      this.tracks.sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case 'duration':
            comparison = (a.info?.duration || 0) - (b.info?.duration || 0)
            break
          case 'title':
            comparison = (a.info?.title || '').localeCompare(b.info?.title || '')
            break
          case 'author':
            comparison = (a.info?.author || '').localeCompare(b.info?.author || '')
            break
          default:
            return 0
        }

        return order === 'desc' ? -comparison : comparison
      })
    }

    await this.utils.save()
    return this
  }

  public toSortedBy(
    sortBy: 'duration' | 'title' | 'author' | ((a: Track | UnresolvedTrack, b: Track | UnresolvedTrack) => number),
    order: 'asc' | 'desc' = 'asc'
  ): (Track | UnresolvedTrack)[] {
    const tracksCopy = [...this.tracks]

    if (typeof sortBy === 'function') {
      return tracksCopy.sort(sortBy)
    }

    return tracksCopy.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'duration':
          comparison = (a.info?.duration || 0) - (b.info?.duration || 0)
          break
        case 'title':
          comparison = (a.info?.title || '').localeCompare(b.info?.title || '')
          break
        case 'author':
          comparison = (a.info?.author || '').localeCompare(b.info?.author || '')
          break
        default:
          return 0
      }

      return order === 'desc' ? -comparison : comparison
    })
  }

  public getTracks(start: number, end?: number): (Track | UnresolvedTrack)[] {
    return this.tracks.slice(start, end)
  }
}
