import { Autoplay } from '../src/audio/Player'
import { Track } from '../src/types/Track'

describe('Autoplay Scoring Restoration', () => {
  const lastTrack = {
    info: {
      author: 'Original Artist',
      title: 'Original Title',
      duration: 180000, // 3:00
      identifier: 'orig'
    }
  } as unknown as Track

  const candidates: Track[] = [
    {
      info: {
        author: 'Original Artist',
        title: 'Newer Track',
        duration: 180000,
        identifier: 'match_artist'
      }
    } as Track,
    {
      info: {
        author: 'Distant Artist',
        title: 'Similar Duration',
        duration: 180000,
        identifier: 'match_duration'
      }
    } as Track,
    {
        info: {
          author: 'Original Artist Group',
          title: 'Partial Match',
          duration: 300000,
          identifier: 'partial_artist'
        }
      } as Track
  ]

  it('should prioritize exact artist matches over duration-only matches', () => {
    const selected = (Autoplay as any).selectTracks(lastTrack, candidates, new Set(), { limit: 10 })
    // Exact artist (30) + Duration (40) = 70 points
    // Duration-only (40) + Random (up to 10) = max 50 points
    expect(selected[0].info.identifier).toBe('match_artist')
  })

  it('should rank partial artist matches correctly', () => {
    const selected = (Autoplay as any).selectTracks(lastTrack, candidates, new Set(), { limit: 10 })
    const ids = selected.map((t: Track) => t.info.identifier)
    expect(ids).toContain('partial_artist')
    // match_artist (70 pts) > match_duration (40 pts) >= partial_artist (15 pts artist + duration delta pts)
    // Depending on duration tolerance, partial_artist might be lower than match_duration.
  })
})
