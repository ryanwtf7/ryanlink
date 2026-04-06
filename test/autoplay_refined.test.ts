import { Player } from '../src/audio/Player'
import { Autoplay } from '../src/audio/Player'
import { Track } from '../src/types/Track'

describe('Autoplay Refined Logic', () => {
  const mockPlayer = {
    search: jest.fn(),
    recentHistory: [],
    recentHistoryLimit: 15,
  } as any

  const mockTrack = {
    info: {
      identifier: 'abc',
      title: 'Song Title',
      author: 'Author Name',
      duration: 180000,
      uri: 'https://open.spotify.com/track/1234567890123456789012',
      sourceName: 'youtube', // Resolved track
    },
    pluginInfo: {
      artistUrl: 'https://open.spotify.com/artist/ARTIST1234567890123456',
      authors: [
        { name: 'Author Name', url: 'https://open.spotify.com/artist/ARTIST1234567890123456' }
      ]
    }
  } as unknown as Track

  it('should extract Spotify Track ID from URI even if source is youtube', () => {
    const id = (Autoplay as any).extractSpotifyId(mockTrack)
    expect(id).toBe('1234567890123456789012')
  })

  it('should extract Spotify Artist ID from pluginInfo.authors', () => {
    const id = (Autoplay as any).extractSpotifyArtistId(mockTrack)
    expect(id).toBe('ARTIST1234567890123456')
  })

  it('should use sprec: seeds for YouTube tracks with Spotify metadata', async () => {
    mockPlayer.search.mockResolvedValue({ tracks: [] })
    await (Autoplay as any).fetchCandidates(mockPlayer, mockTrack, { limit: 1 })
    
    // Should have called search with sprec: and seeds
    const sprecCall = mockPlayer.search.mock.calls.find(call => call[0].query.startsWith('sprec:'))
    expect(sprecCall).toBeDefined()
    expect(sprecCall[0].query).toContain('seed_tracks=1234567890123456789012')
    expect(sprecCall[0].query).toContain('seed_artists=ARTIST1234567890123456')
  })
})
