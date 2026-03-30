import { beforeAll, afterAll, afterEach, vi } from 'vitest'

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.removeAllListeners('warning')
  process.on('warning', (warning) => {
    if (warning.name === 'PromiseRejectionHandledWarning') return
    console.warn(warning)
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})

afterEach(() => {})
