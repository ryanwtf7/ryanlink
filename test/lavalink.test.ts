import { SourceMappings, BuiltinSources, LinkMatchers } from '../src/node/Sources'

describe('Lavalink', () => {
  describe('SourceMappings', () => {
    it('maps youtube aliases to ytsearch', () => {
      expect(SourceMappings['youtube']).toBe('ytsearch')
      expect(SourceMappings['yt']).toBe('ytsearch')
      expect(SourceMappings['ytsearch']).toBe('ytsearch')
    })

    it('maps youtube music aliases to ytmsearch', () => {
      expect(SourceMappings['youtube music']).toBe('ytmsearch')
      expect(SourceMappings['youtubemusic']).toBe('ytmsearch')
      expect(SourceMappings['ytm']).toBe('ytmsearch')
    })

    it('maps soundcloud aliases to scsearch', () => {
      expect(SourceMappings['soundcloud']).toBe('scsearch')
      expect(SourceMappings['sc']).toBe('scsearch')
    })

    it('maps spotify aliases to spsearch', () => {
      expect(SourceMappings['spotify']).toBe('spsearch')
      expect(SourceMappings['sp']).toBe('spsearch')
    })

    it('maps deezer aliases to dzsearch', () => {
      expect(SourceMappings['deezer']).toBe('dzsearch')
      expect(SourceMappings['dz']).toBe('dzsearch')
    })

    it('maps apple music aliases to amsearch', () => {
      expect(SourceMappings['apple music']).toBe('amsearch')
      expect(SourceMappings['apple']).toBe('amsearch')
    })

    it('maps tidal aliases to tdsearch', () => {
      expect(SourceMappings['tidal']).toBe('tdsearch')
      expect(SourceMappings['td']).toBe('tdsearch')
    })

    it('maps local/http/https to themselves', () => {
      expect(SourceMappings['local']).toBe('local')
      expect(SourceMappings['http']).toBe('http')
      expect(SourceMappings['https']).toBe('https')
    })

    it('maps bandcamp to bcsearch', () => {
      expect(SourceMappings['bandcamp']).toBe('bcsearch')
      expect(SourceMappings['bc']).toBe('bcsearch')
    })

    it('maps jiosaavn to jssearch', () => {
      expect(SourceMappings['jiosaavn']).toBe('jssearch')
      expect(SourceMappings['js']).toBe('jssearch')
    })

    it('maps audiomack aliases to admsearch', () => {
      expect(SourceMappings['audiomack']).toBe('admsearch')
      expect(SourceMappings['adm']).toBe('admsearch')
      expect(SourceMappings['admsearch']).toBe('admsearch')
    })

    it('maps shazam aliases to shsearch', () => {
      expect(SourceMappings['shazam']).toBe('shsearch')
      expect(SourceMappings['sh']).toBe('shsearch')
      expect(SourceMappings['shsearch']).toBe('shsearch')
    })

    it('maps instagram aliases to igsearch', () => {
      expect(SourceMappings['instagram']).toBe('igsearch')
      expect(SourceMappings['ig']).toBe('igsearch')
    })

    it('maps bilibili aliases to blsearch', () => {
      expect(SourceMappings['bilibili']).toBe('blsearch')
      expect(SourceMappings['bl']).toBe('blsearch')
    })

    it('maps lastfm aliases to lfsearch', () => {
      expect(SourceMappings['lastfm']).toBe('lfsearch')
      expect(SourceMappings['last.fm']).toBe('lfsearch')
      expect(SourceMappings['lf']).toBe('lfsearch')
    })

    it('maps amazon music aliases to amzsearch', () => {
      expect(SourceMappings['amazon music']).toBe('amzsearch')
      expect(SourceMappings['amazonmusic']).toBe('amzsearch')
      expect(SourceMappings['amz']).toBe('amzsearch')
    })

    it('maps gaana aliases to gnsearch', () => {
      expect(SourceMappings['gaana']).toBe('gnsearch')
      expect(SourceMappings['gn']).toBe('gnsearch')
    })

    it('maps yandex music aliases to ymsearch', () => {
      expect(SourceMappings['yandex music']).toBe('ymsearch')
      expect(SourceMappings['yandex']).toBe('ymsearch')
      expect(SourceMappings['ymsearch']).toBe('ymsearch')
    })

    it('maps vk aliases to vksearch', () => {
      expect(SourceMappings['vk']).toBe('vksearch')
      expect(SourceMappings['vksearch']).toBe('vksearch')
    })

    it('maps qobuz aliases to qbsearch', () => {
      expect(SourceMappings['qobuz']).toBe('qbsearch')
      expect(SourceMappings['qbsearch']).toBe('qbsearch')
    })

    it('maps pandora aliases to pdsearch', () => {
      expect(SourceMappings['pandora']).toBe('pdsearch')
      expect(SourceMappings['pd']).toBe('pdsearch')
    })

    it('maps tts aliases correctly', () => {
      expect(SourceMappings['speak']).toBe('speak')
      expect(SourceMappings['tts']).toBe('tts')
      expect(SourceMappings['ftts']).toBe('ftts')
      expect(SourceMappings['flowery']).toBe('ftts')
    })

    it('maps mixcloud to mcsearch', () => {
      expect(SourceMappings['mixcloud']).toBe('mcsearch')
      expect(SourceMappings['mcsearch']).toBe('mcsearch')
    })

    it('maps songlink aliases to slsearch', () => {
      expect(SourceMappings['songlink']).toBe('slsearch')
      expect(SourceMappings['odesli']).toBe('slsearch')
      expect(SourceMappings['slsearch']).toBe('slsearch')
    })

    it('maps audius to ausearch', () => {
      expect(SourceMappings['audius']).toBe('ausearch')
      expect(SourceMappings['ausearch']).toBe('ausearch')
    })

    it('maps anghami to agsearch', () => {
      expect(SourceMappings['anghami']).toBe('agsearch')
      expect(SourceMappings['agsearch']).toBe('agsearch')
    })

    it('maps bluesky to bksearch', () => {
      expect(SourceMappings['bluesky']).toBe('bksearch')
      expect(SourceMappings['bksearch']).toBe('bksearch')
    })

    it('has no undefined values', () => {
      for (const [key, val] of Object.entries(SourceMappings)) {
        expect(val).toBeDefined()
        expect(typeof val).toBe('string')
      }
    })
  })

  describe('BuiltinSources', () => {
    it('has DuncteBot_Plugin', () => {
      expect(BuiltinSources.DuncteBot_Plugin).toBe('skybot-lavalink-plugin')
    })

    it('has LavaSrc', () => {
      expect(BuiltinSources.LavaSrc).toBe('lavasrc-plugin')
    })

    it('has LavaSearch', () => {
      expect(BuiltinSources.LavaSearch).toBe('lavasearch-plugin')
    })

    it('has GoogleCloudTTS', () => {
      expect(BuiltinSources.GoogleCloudTTS).toBe('tts-plugin')
    })

    it('has SponsorBlock', () => {
      expect(BuiltinSources.SponsorBlock).toBe('sponsorblock-plugin')
    })

    it('has LavaLyrics', () => {
      expect(BuiltinSources.LavaLyrics).toBe('lavalyrics-plugin')
    })

    it('has all expected plugin keys', () => {
      const keys = [
        'DuncteBot_Plugin',
        'LavaSrc',
        'GoogleCloudTTS',
        'LavaSearch',
        'LavaLyrics',
        'SponsorBlock',
        'LavaDSPX',
        'Filter_Engine',
        'TimedLyrics_Engine'
      ]
      for (const key of keys) {
        expect(BuiltinSources).toHaveProperty(key)
      }
    })
  })

  describe('LinkMatchers', () => {
    describe('YoutubeRegex', () => {
      it('matches youtube watch URL', () => {
        expect(LinkMatchers.YoutubeRegex.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      })

      it('matches youtu.be short URL', () => {
        expect(LinkMatchers.YoutubeRegex.test('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
      })

      it('does not match non-youtube URL', () => {
        expect(LinkMatchers.YoutubeRegex.test('https://soundcloud.com/track')).toBe(false)
      })
    })

    describe('YoutubeMusicRegex', () => {
      it('matches music.youtube.com URL', () => {
        expect(LinkMatchers.YoutubeMusicRegex.test('https://music.youtube.com/watch?v=abc')).toBe(true)
      })
    })

    describe('SoundCloudRegex', () => {
      it('matches soundcloud.com URL', () => {
        expect(LinkMatchers.SoundCloudRegex.test('https://soundcloud.com/artist/track')).toBe(true)
      })

      it('does not match youtube URL', () => {
        expect(LinkMatchers.SoundCloudRegex.test('https://youtube.com/watch?v=abc')).toBe(false)
      })
    })

    describe('SpotifySongRegex', () => {
      it('matches spotify track URL', () => {
        expect(LinkMatchers.SpotifySongRegex.test('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(true)
      })

      it('does not match spotify playlist URL', () => {
        expect(LinkMatchers.SpotifySongRegex.test('https://open.spotify.com/playlist/abc')).toBe(false)
      })
    })

    describe('SpotifyPlaylistRegex', () => {
      it('matches spotify playlist URL', () => {
        expect(LinkMatchers.SpotifyPlaylistRegex.test('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
      })
    })

    describe('SpotifyAlbumRegex', () => {
      it('matches spotify album URL', () => {
        expect(LinkMatchers.SpotifyAlbumRegex.test('https://open.spotify.com/album/4vS7XAsiYvF7uP9v6v9v6v')).toBe(true)
      })
    })

    describe('AllSpotifyRegex', () => {
      it('matches track', () => {
        expect(LinkMatchers.AllSpotifyRegex.test('https://open.spotify.com/track/abc')).toBe(true)
      })

      it('matches album', () => {
        expect(LinkMatchers.AllSpotifyRegex.test('https://open.spotify.com/album/abc')).toBe(true)
      })

      it('matches artist', () => {
        expect(LinkMatchers.AllSpotifyRegex.test('https://open.spotify.com/artist/abc')).toBe(true)
      })

      it('matches show/episode', () => {
        expect(LinkMatchers.AllSpotifyRegex.test('https://open.spotify.com/show/abc')).toBe(true)
        expect(LinkMatchers.AllSpotifyRegex.test('https://open.spotify.com/episode/abc')).toBe(true)
      })
    })

    describe('DeezerTrackRegex', () => {
      it('matches deezer track URL', () => {
        expect(LinkMatchers.DeezerTrackRegex.test('https://www.deezer.com/track/123456')).toBe(true)
      })
    })

    describe('AllDeezerRegex', () => {
      it('matches deezer track', () => {
        expect(LinkMatchers.AllDeezerRegex.test('https://www.deezer.com/track/123')).toBe(true)
      })

      it('matches deezer playlist', () => {
        expect(LinkMatchers.AllDeezerRegex.test('https://www.deezer.com/playlist/123')).toBe(true)
      })

      it('matches deezer album', () => {
        expect(LinkMatchers.AllDeezerRegex.test('https://www.deezer.com/album/123')).toBe(true)
      })

      const LinkMatchersAny = LinkMatchers as any;
      if (LinkMatchersAny.DeezerPageLinkRegex) {
        it('matches deezer page link', () => {
          expect(LinkMatchersAny.DeezerPageLinkRegex.test('https://deezer.page.link/abc')).toBe(true)
        })
      }
    })

    describe('appleMusic', () => {
      it('matches apple music URL', () => {
        expect(LinkMatchers.appleMusic.test('https://music.apple.com/us/album/test/123')).toBe(true)
      })
    })

    describe('mp3Url', () => {
      it('matches direct mp3 URL', () => {
        expect(LinkMatchers.mp3Url.test('https://example.com/audio/song.mp3')).toBe(true)
      })

      it('does not match non-mp3 URL', () => {
        expect(LinkMatchers.mp3Url.test('https://example.com/audio/song.wav')).toBe(false)
      })
    })

    describe('tidal', () => {
      it('matches tidal.tidal.com track URL', () => {
        expect(LinkMatchers.tidal.test('https://tidal.tidal.com/track/12345')).toBe(true)
      })

      it('matches listen.tidal.com track URL', () => {
        expect(LinkMatchers.tidal.test('https://listen.tidal.com/album/abc123')).toBe(true)
      })
    })

    describe('PandoraRegex', () => {
      it('matches pandora track URL', () => {
        expect(LinkMatchers.PandoraTrackRegex.test('https://www.pandora.com/artist/name/album/TR123')).toBe(true)
      })
      it('matches all pandora regex', () => {
        expect(LinkMatchers.AllPandoraRegex.test('https://www.pandora.com/playlist/PL:123')).toBe(true)
      })
    })

    describe('SocialMedia & Others', () => {
      it('matches tiktok', () => {
        expect(LinkMatchers.tiktok.test('https://www.tiktok.com/@user/video/123')).toBe(true)
      })
      it('matches mixcloud', () => {
        expect(LinkMatchers.mixcloud.test('https://www.mixcloud.com/artist/mix/')).toBe(true)
      })
      it('matches yandex music', () => {
        expect(LinkMatchers.musicYandex.test('https://music.yandex.ru/album/123/track/456')).toBe(true)
      })
    })

    describe('bandcamp', () => {
      it('matches bandcamp artist URL', () => {
        expect(LinkMatchers.bandcamp.test('https://artist.bandcamp.com/track/name')).toBe(true)
      })
    })

    describe('Twitch & Vimeo', () => {
      it('matches twitch tv', () => {
        expect(LinkMatchers.TwitchTv.test('https://www.twitch.tv/user')).toBe(true)
      })
      it('matches vimeo', () => {
        expect(LinkMatchers.vimeo.test('https://vimeo.com/123456')).toBe(true)
      })
    })
  })
})
