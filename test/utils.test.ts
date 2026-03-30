import { RyanlinkUtils, parseConnectionUrl, MiniMap, queueTrackEnd } from '../src/utils/Utils'
import { RyanlinkManager } from '../src/core/Manager'

describe('RyanlinkUtils', () => {
  let utils: RyanlinkUtils
  let manager: RyanlinkManager

  beforeEach(async () => {
    manager = new RyanlinkManager({
      nodes: [{ host: 'localhost', port: 2333, authorization: 'pw', id: 'local' }],
      client: { id: '123', username: 'bot' },
      sendToShard: vi.fn(),
    })
    utils = new RyanlinkUtils(manager)
    const node = manager.nodeManager.nodes.get('local')!
    // @ts-ignore
    node.socket = { readyState: 1 } 
  })

  describe('parseConnectionUrl', () => {
    it('parses ryanlink url', () => {
      const parsed = parseConnectionUrl('ryanlink://user:pass@localhost:2333')
      expect(parsed).toEqual({
        authorization: 'pass',
        nodeType: 'Core',
        id: 'user',
        host: 'localhost',
        port: 2333,
      })
    })

    it('parses nodelink url', () => {
      const parsed = parseConnectionUrl('nodelink://user:pass@localhost:2333')
      expect(parsed.nodeType).toBe('NodeLink')
    })
  })

  describe('buildTrack', () => {
    const rawTrack = {
      encoded: 'base64',
      info: {
        identifier: 'id',
        title: 'title',
        author: 'author',
        length: 1000,
        uri: 'uri',
        sourceName: 'youtube',
        isSeekable: true,
        isStream: false,
      }
    }

    it('builds a valid track', () => {
      const track = utils.buildTrack(rawTrack as any, { id: 'user' })
      expect(track.encoded).toBe('base64')
      expect(track.requester).toEqual({ id: 'user' })
    })

    it('uses requesterTransformer if provided', () => {
      manager.options.playerOptions.requesterTransformer = (u: any) => ({ name: u.username })
      const track = utils.buildTrack(rawTrack as any, { username: 'test' })
      expect(track.requester).toEqual({ name: 'test' })
    })
  })

  describe('unresolved tracks', () => {
    it('builds unresolved track', () => {
      const ut = utils.buildUnresolvedTrack({ title: 'test', author: 'auth' }, { id: '1' })
      expect(utils.isUnresolvedTrack(ut)).toBe(true)
    })

    it('resolves unresolved track', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'test' }, { id: '1' })
      const player = manager.createPlayer({ guildId: '1', voiceChannelId: '1' })
      
      vi.spyOn(player, 'search').mockResolvedValue({
        loadType: 'search',
        tracks: [{ encoded: 'enc', info: { title: 'Resolved', duration: 1000 } } as any],
        playlist: null,
        exception: null,
        pluginInfo: {}
      } as any)

      await ut.resolve(player)
      expect(ut.encoded).toBe('enc')
      expect(utils.isTrack(ut)).toBe(true)
    })
  })

  describe('validations', () => {
    it('identifies tracks correctly', () => {
      expect(utils.isTrack({ encoded: 'a', info: {} } as any)).toBe(true)
      expect(utils.isTrack(null as any)).toBe(false)
    })

    it('validates query strings', () => {
      const mockNode = { 
        info: { sourceManagers: ['youtube'] },
        _checkForSources: true 
      } as any
      
      expect(() => utils.validateQueryString(mockNode, '  ')).toThrow('Query string is empty')
      
      mockNode.info.sourceManagers = []
      expect(() => utils.validateQueryString(mockNode, 'https://youtube.com/watch?v=abc')).toThrow(/no sourceManagers enabled/)
    })

    it('handles blacklists and whitelists', () => {
      const mockNode = { info: { sourceManagers: ['youtube'] } } as any
      manager.options.linksBlacklist = ['badsite.com']
      expect(() => utils.validateQueryString(mockNode, 'https://badsite.com/foo')).toThrow('blacklisted')
      
      manager.options.linksBlacklist = []
      manager.options.linksWhitelist = ['goodsite.com']
      expect(() => utils.validateQueryString(mockNode, 'https://othersite.com')).toThrow('whitelisted')
    })
  })

  describe('query transformations', () => {
    it('transforms queries', () => {
      const transformed = utils.transformQuery('ytsearch:hello')
      expect(transformed.source).toBe('ytsearch')
      expect(transformed.query).toBe('hello')
    })

    it('transforms audio search queries', () => {
      const transformed = utils.transformAudioSearchQuery({ query: 'test', types: ['track'], source: 'ymsearch' })
      expect(transformed.types).toContain('track')
    })
  })

  describe('getClosestTrack', () => {
    it('finds track by ISRC', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'T', author: 'A', isrc: 'I123' }, { id: '1' })
      const player = manager.createPlayer({ guildId: 'gc1', voiceChannelId: 'v1' })
      
      const searchSpy = vi.spyOn(player, 'search').mockResolvedValue({
        loadType: 'search',
        tracks: [{ encoded: 'e1', info: { title: 'Other', author: 'Other', isrc: 'I123', duration: 1000 } } as any]
      } as any)

      const result = await utils.getClosestTrack(ut, player)
      expect(result.encoded).toBe('e1')
      expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ query: 'T by A' }), { id: '1' })
    })

    it('finds track by title and author', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'Real Title', author: 'Real Author', duration: 1000 }, { id: '1' })
      const player = manager.createPlayer({ guildId: 'gc2', voiceChannelId: 'v1' })
      
      vi.spyOn(player, 'search').mockResolvedValue({
        loadType: 'search',
        tracks: [
          { encoded: 'wrong', info: { title: 'Wrong', author: 'Auth', duration: 1000 } } as any,
          { encoded: 'right', info: { title: 'Real Title', author: 'Real Author', duration: 1000 } } as any
        ]
      } as any)

      const result = await utils.getClosestTrack(ut, player)
      expect(result.encoded).toBe('right')
    })

    it('finds track by duration if no exact title match', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'T', author: 'A', duration: 5000 }, { id: '1' })
      const player = manager.createPlayer({ guildId: 'gc3', voiceChannelId: 'v1' })
      
      vi.spyOn(player, 'search').mockResolvedValue({
        loadType: 'search',
        tracks: [
          { encoded: 'far', info: { title: 'Other', author: 'Other', duration: 10000 } } as any,
          { encoded: 'close', info: { title: 'Other', author: 'Other', duration: 4900 } } as any
        ]
      } as any)

      const result = await utils.getClosestTrack(ut, player)
      expect(result.encoded).toBe('close')
    })

    it('resolves by URI if provided', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'T', uri: 'https://uri.com' }, { id: '1' })
      const player = manager.createPlayer({ guildId: 'gc4', voiceChannelId: 'v1' })
      
      const searchSpy = vi.spyOn(player, 'search').mockResolvedValue({
        loadType: 'track',
        tracks: [{ encoded: 'e_uri', info: { title: 'T' } } as any]
      } as any)

      const result = await utils.getClosestTrack(ut, player)
      expect(result.encoded).toBe('e_uri')
      expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ query: 'https://uri.com' }), { id: '1' })
    })

    it('resolves by encoded base64 if provided', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'T', encoded: 'e64' } as any, { id: '1' })
      const player = manager.createPlayer({ guildId: 'gc5', voiceChannelId: 'v1' })
      
      // @ts-ignore
      const decodeSpy = vi.spyOn(player.node.decode, 'singleTrack').mockResolvedValue({ encoded: 'e64', info: { title: 'T' } } as any)

      const result = await utils.getClosestTrack(ut, player)
      expect(result.encoded).toBe('e64')
      expect(decodeSpy).toHaveBeenCalledWith('e64', { id: '1' })
    })

    it('throws if missing required fields', async () => {
      const ut = utils.buildUnresolvedTrack({ title: 'T' }, { id: '1' })
      // @ts-ignore
      delete ut.info.title
      const player = manager.createPlayer({ guildId: 'gc6', voiceChannelId: 'v1' })
      await expect(utils.getClosestTrack(ut, player)).rejects.toThrow(/required for unresolved tracks/)
    })
  })

  describe('MiniMap', () => {
    it('filters correctly', () => {
      const map = new MiniMap<string, number>([['a', 1], ['b', 2], ['c', 3]])
      const filtered = map.filter((v) => v > 1)
      expect(filtered.size).toBe(2)
    })

    it('maps correctly', () => {
      const map = new MiniMap<string, number>([['a', 1], ['b', 2]])
      const mapped = map.map((v) => v * 2)
      expect(mapped).toEqual([2, 4])
    })
  })

  describe('queueTrackEnd', () => {
    it('shifts queue and sets current track', async () => {
      const player = manager.createPlayer({ guildId: 'q1', voiceChannelId: 'v1' })
      const track1 = { encoded: 't1', info: { title: 'T1' } } as any
      const track2 = { encoded: 't2', info: { title: 'T2' } } as any
      player.queue.current = track1
      player.queue.tracks.push(track2)
      
      await queueTrackEnd(player)
      
      expect(player.queue.current).toBe(track2)
      expect(player.queue.previous[0]).toBe(track1)
      expect(player.queue.tracks.length).toBe(0)
    })

    it('handles queue repeat mode', async () => {
      const player = manager.createPlayer({ guildId: 'q2', voiceChannelId: 'v1' })
      player.repeatMode = 'queue'
      const track1 = { encoded: 't1', info: { title: 'T1' } } as any
      const track2 = { encoded: 't2', info: { title: 'T2' } } as any
      player.queue.current = track1
      player.queue.tracks.push(track2)
      
      await queueTrackEnd(player)
      // track1 should be pushed to the end of tracks, and track2 should become current
      expect(player.queue.current).toBe(track2)
      expect(player.queue.tracks).toContain(track1)
    })
  })
})
