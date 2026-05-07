import type { ManagerQueueOptions, QueueChangesWatcher, StoredQueue } from '../types/Queue'
import type { Track, UnresolvedTrack } from '../types/Track'
import { RyanlinkUtils, AudioQueueSymbol } from '../utils/Utils'

export class Queue {
  public tracks: (Track | UnresolvedTrack)[] = []
  public previous: Track[] = []
  public current: Track | null = null
  public options = { maxPreviousTracks: 25 }
  public position: number = 0
  private readonly guildId: string = ''
  private managerUtils = new RyanlinkUtils()
  private queueChanges: QueueChangesWatcher | null
  private player: any | null = null

  constructor(
    guildId: string,
    queueOptions?: ManagerQueueOptions,
    player?: any
  ) {
    this.player = player || null
    this.queueChanges = queueOptions?.queueChangesWatcher || null
    this.guildId = guildId
    this.options.maxPreviousTracks = queueOptions?.maxPreviousTracks ?? 25

    Object.defineProperty(this, AudioQueueSymbol, { configurable: true, value: true })
  }

  /**
   * Get the size of the queue
   */
  public get size() {
    return this.tracks.length
  }

  /**
   * Get the first track in the queue
   */
  public get first() {
    return this.tracks[0] ?? null
  }

  /**
   * Get the last track in the queue
   */
  public get last() {
    return this.tracks[this.tracks.length - 1] ?? null
  }

  /**
   * Get the total duration of the queue including the current track
   */
  public get totalDuration() {
    return this.tracks.reduce((acc, cur) => acc + (cur.info.duration || 0), this.current?.info.duration || 0)
  }

  /**
   * Add tracks to the queue
   */
  public add(TrackOrTracks: Track | UnresolvedTrack | (Track | UnresolvedTrack)[], index?: number) {
    const tracks = (Array.isArray(TrackOrTracks) ? TrackOrTracks : [TrackOrTracks])
      .flat(2)
      .filter((v) => this.managerUtils.isTrack(v) || this.managerUtils.isUnresolvedTrack(v))

    if (!tracks.length) return this.tracks.length

    const oldQueue = this.toJSON()

    if (typeof index === 'number' && index >= 0 && index <= this.tracks.length) {
      this.tracks.splice(index, 0, ...tracks)
    } else {
      this.tracks.push(...tracks)
    }

    if (this.queueChanges?.tracksAdd) {
      this.queueChanges.tracksAdd(this.guildId, tracks, index ?? this.tracks.length - tracks.length, oldQueue, this.toJSON())
    }

    return this.tracks.length
  }

  /**
   * Remove tracks from the queue
   */
  public remove(index: number, amount: number = 1) {
    const oldQueue = this.toJSON()
    const removed = this.tracks.splice(index, amount)

    if (removed.length > 0 && this.queueChanges?.tracksRemoved) {
      this.queueChanges.tracksRemoved(this.guildId, removed, index, oldQueue, this.toJSON())
    }

    return removed
  }

  /**
   * Clear the queue
   */
  public clear(includePrevious: boolean = false) {
    const oldQueue = this.toJSON()
    const removed = this.tracks.splice(0, this.tracks.length)
    if (includePrevious) this.previous.splice(0, this.previous.length)

    if (removed.length > 0 && this.queueChanges?.tracksRemoved) {
      this.queueChanges.tracksRemoved(this.guildId, removed, 0, oldQueue, this.toJSON())
    }

    return removed.length
  }

  /**
   * Shuffle the queue
   */
  public shuffle() {
    if (this.tracks.length <= 1) return this.tracks.length
    const oldQueue = this.toJSON()

    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]]
    }

    if (this.queueChanges?.shuffled) {
      this.queueChanges.shuffled(this.guildId, oldQueue, this.toJSON())
    }

    return this.tracks.length
  }

  /**
   * Move a track from one position to another
   */
  public move(from: number, to: number) {
    if (from < 0 || from >= this.tracks.length || to < 0 || to >= this.tracks.length) return false
    const track = this.tracks.splice(from, 1)[0]
    this.tracks.splice(to, 0, track)
    return true
  }

  /**
   * Skip to a specific track in the queue
   */
  public skipTo(index: number) {
    if (index < 0 || index >= this.tracks.length) return null
    this.tracks.splice(0, index)
    if (this.current) {
        this.previous.unshift(this.current)
        if (this.previous.length > this.options.maxPreviousTracks) this.previous.pop()
    }
    this.current = (this.tracks.shift() as Track) || null
    return this.current
  }

  /**
   * Add a track to the previous tracks list
   */
  public addPrevious(track: Track) {
    this.previous.unshift(track)
    if (this.previous.length > this.options.maxPreviousTracks) this.previous.pop()
  }

  public toJSON(): StoredQueue {
    return {
      current: this.current ? { ...this.current } : null,
      previous: [...this.previous],
      tracks: [...this.tracks],
      position: this.position,
      voiceChannel: this.player?.voiceChannelId || null,
      textChannel: this.player?.textChannelId || null,
      paused: this.player?.paused || false,
      volume: this.player?.volume || 100,
      nodeId: this.player?.node?.id || null,
    }
  }

  // Functional methods
  public find(predicate: (track: Track | UnresolvedTrack, index: number) => boolean) {
    return this.tracks.find(predicate)
  }

  public filter(predicate: (track: Track | UnresolvedTrack, index: number) => boolean) {
    return this.tracks.filter(predicate)
  }

  public map<T>(callback: (track: Track | UnresolvedTrack, index: number) => T) {
    return this.tracks.map(callback)
  }

  public some(predicate: (track: Track | UnresolvedTrack, index: number) => boolean) {
    return this.tracks.some(predicate)
  }

  public every(predicate: (track: Track | UnresolvedTrack, index: number) => boolean) {
    return this.tracks.every(predicate)
  }
}
