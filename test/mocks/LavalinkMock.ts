import fs from 'node:fs'
import { vi } from 'vitest'
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

export class LavalinkMock {
  private static responses = new Map<string, any>()

  static setup() {
    // Mock fetch
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      const method = options?.method || 'GET'
      debugLog(`MockFetch: ${method} ${path} (orig: ${url})`)
      
      // Find matching response
      for (const [pattern, response] of this.responses.entries()) {
        const p = pattern.startsWith('/') ? pattern : `/${pattern}`
        // Match exact or with /v4 prefix
        if (path === p || path === `/v4${p}` || path.includes(pattern)) {
          const status = response?._status || 200
          const data = response?._status ? response.data : response
          return {
            status: status,
            ok: status >= 200 && status < 300,
            json: async () => data,
            text: async () => typeof data === 'string' ? data : JSON.stringify(data),
            headers: new Headers({ 'Content-Type': 'application/json' }),
          }
        }
      }

      return {
        status: 404,
        ok: false,
        json: async () => ({ error: 'Not Found', path }),
        text: async () => `Not Found: ${path}`,
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }
    })
  }

  static setResponse(pattern: string, data: any) {
    this.responses.set(pattern, data)
  }

  static clearResponses() {
    this.responses.clear()
  }
}
