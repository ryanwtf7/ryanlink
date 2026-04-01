import fs from 'node:fs'
import { EventEmitter } from 'node:events'

function debugLog(msg: string) {
  try {
    fs.appendFileSync('/tmp/test.log', msg + '\n')
  } catch {}
}

export class MockWebSocket extends EventEmitter {
  public readyState: number = 0 // CONNECTING
  public static OPEN = 1
  public static CLOSED = 3

  constructor(public url: string, public options: any) {
    super()
    debugLog(`MockWebSocket created for ${url}`)
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      debugLog(`MockWebSocket opening ${url}`)
      this.emit('open')
      // Simulate Lavalink "ready" message
      this.emit('message', JSON.stringify({
        op: 'ready',
        sessionId: '123',
        resumed: false,
        info: {
          version: { semver: '4.0.0' },
          sourceManagers: ['youtube', 'spotify', 'soundcloud', 'bandcamp'],
          plugins: [{ name: 'lyrics-plugin', version: '1.0' }, { name: 'sponsorblock-plugin', version: '1.0' }]
        }
      }))
    }, 10)
  }

  send(data: string) {
    this.emit('sent', JSON.parse(data))
  }

  close(code: number, reason: string) {
    this.readyState = MockWebSocket.CLOSED
    this.emit('close', code, reason)
  }

  terminate() {
    this.close(1006, 'Terminated')
  }
}

if (!(global as any).__LAVALINK_MOCK_RESPONSES__) {
  ;(global as any).__LAVALINK_MOCK_RESPONSES__ = new Map<string, any>()
}
const responses: Map<string, any> = (global as any).__LAVALINK_MOCK_RESPONSES__

export class LavalinkMock {
  static setup() {
    debugLog('LavalinkMock.setup() starting')
    responses.clear()
    // Default responses
    this.setResponse('info', {
      version: { semver: '4.0.0', major: 4, minor: 0, patch: 0, preRelease: null, build: null },
      sourceManagers: ['youtube', 'spotify', 'soundcloud'],
      filters: ['volume', 'equalizer', 'karaoke', 'timescale', 'tremolo', 'vibrato', 'distortion', 'rotation', 'channelMix', 'lowPass'],
      plugins: []
    })
    this.setResponse('version', '4.0.0')
    this.setResponse('sessions', { draining: false, resuming: false, timeout: 60 })
    this.setResponse('stats', {
      players: 0,
      playingPlayers: 0,
      uptime: 0,
      memory: { free: 1e9, used: 1e8, allocated: 2e9, reservable: 3e9 },
      cpu: { cores: 8, systemLoad: 0.1, audioLoad: 0.01 },
      frameStats: { sent: 0, nulled: 0, deficit: 0 }
    })
    debugLog(`LavalinkMock.setup() finished. Keys: ${Array.from(responses.keys()).join(', ')}`)

    // Mock fetch
    globalThis.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      const normPath = path.toLowerCase()
      const method = options?.method || 'GET'
      debugLog(`MockFetch: ${method} ${path} (orig: ${url})`)
      
      // Find matching response
      const keys = Array.from(responses.keys())
      debugLog(`Searching for match for ${path} in keys: ${keys.join(', ')}`)
      for (const [pattern, response] of responses.entries()) {
        const p = pattern.startsWith('/') ? pattern : `/${pattern}`
        const normP = p.toLowerCase()
        const normPattern = pattern.toLowerCase()
        
        if (normPath === normP || normPath === `/v4${normP}` || normPath.includes(normPattern)) {
          const status = response?._status || 200
          const data = response?._status ? response.data : response
          debugLog(`Matched ${pattern} for ${path}`)
          return {
            status: status,
            ok: status >= 200 && status < 300,
            json: async () => data,
            text: async () => typeof data === 'string' ? data : JSON.stringify(data),
            headers: new Headers({ 'Content-Type': 'application/json' }),
          }
        }
      }

      // Final Fallback for info/version/stats
      if (normPath.includes('info')) {
        return {
          status: 200, ok: true,
          json: async () => ({
            version: { semver: '4.0.0', major: 4, minor: 0, patch: 0, preRelease: null, build: null },
            sourceManagers: ['youtube', 'spotify', 'soundcloud'],
            filters: ['volume', 'equalizer', 'karaoke', 'timescale', 'tremolo', 'vibrato', 'distortion', 'rotation', 'channelMix', 'lowPass'],
            plugins: []
          }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }
      }
      if (normPath.includes('version')) {
        return {
          status: 200, ok: true,
          text: async () => '4.0.0',
          headers: new Headers({ 'Content-Type': 'application/json' }),
        }
      }

      return {
        status: 404,
        ok: false,
        json: async () => ({ error: 'Not Found', path }),
        text: async () => `Not Found: ${path}`,
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }
    }) as any
  }

  static setResponse(pattern: string, data: any) {
    responses.set(pattern, data)
  }

  static clearResponses() {
    responses.clear()
  }
}
