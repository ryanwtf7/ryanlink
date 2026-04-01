import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { QueueStoreManager, StoredQueue } from '../types/Queue'
import { MiniMap } from '../utils/Utils'

export class MemoryQueueStore implements QueueStoreManager {
  private data = new MiniMap<string, StoredQueue | string>()

  async get(guildId: string): Promise<StoredQueue | string | undefined> {
    return this.data.get(guildId)
  }

  async set(guildId: string, value: StoredQueue | string): Promise<boolean> {
    this.data.set(guildId, value)
    return true
  }

  async delete(guildId: string): Promise<boolean> {
    return this.data.delete(guildId)
  }

  async stringify(value: StoredQueue | string): Promise<StoredQueue | string> {
    return typeof value === 'object' ? JSON.stringify(value) : value
  }

  async parse(value: StoredQueue | string | undefined): Promise<Partial<StoredQueue>> {
    if (!value) return {}
    try {
      return typeof value === 'string' ? JSON.parse(value) : value
    } catch {
      return {}
    }
  }
}

export class LocalDiskQueueStore implements QueueStoreManager {
  private readonly path: string

  constructor(path: string = './.ryanlink/queues') {
    this.path = path
    if (!existsSync(this.path)) mkdirSync(this.path, { recursive: true })
  }

  private getFilePath(guildId: string) {
    return join(this.path, `${guildId}.json`)
  }

  async get(guildId: string): Promise<string | undefined> {
    const file = this.getFilePath(guildId)
    if (!existsSync(file)) return undefined
    return readFileSync(file, 'utf-8')
  }

  async set(guildId: string, value: string): Promise<void> {
    writeFileSync(this.getFilePath(guildId), value, 'utf-8')
  }

  async delete(guildId: string): Promise<void> {
    const file = this.getFilePath(guildId)
    if (existsSync(file)) unlinkSync(file)
  }

  async stringify(value: StoredQueue | string): Promise<string> {
    return typeof value === 'object' ? JSON.stringify(value) : value
  }

  async parse(value: string | undefined): Promise<Partial<StoredQueue>> {
    if (!value) return {}
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
}

export interface RedisClient {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
  del: (key: string) => Promise<unknown>
}

export class RedisQueueStore implements QueueStoreManager {
  constructor(private redis: RedisClient, private prefix: string = 'ryanlink:queue:') {}

  async get(guildId: string): Promise<string | undefined> {
    return (await this.redis.get(`${this.prefix}${guildId}`)) || undefined
  }

  async set(guildId: string, value: string): Promise<void> {
    await this.redis.set(`${this.prefix}${guildId}`, value)
  }

  async delete(guildId: string): Promise<void> {
    await this.redis.del(`${this.prefix}${guildId}`)
  }

  async stringify(value: StoredQueue | string): Promise<string> {
    return typeof value === 'object' ? JSON.stringify(value) : value
  }

  async parse(value: string | undefined): Promise<Partial<StoredQueue>> {
    if (!value) return {}
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
}

export { MemoryQueueStore as DefaultQueueStore }
