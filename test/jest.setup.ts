import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LavalinkMock } from './mocks/LavalinkMock'
import { TrackRegistry } from '../src/utils/TrackRegistry'

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

console.log = jest.fn()
console.error = jest.fn()
console.warn = jest.fn()
console.debug = jest.fn()


  ; (globalThis as any).$clientName = pkg.name
  ; (globalThis as any).$clientVersion = pkg.version
  ; (globalThis as any).$clientRepository = pkg.repository.url.replace(/\.git$/, '')

beforeAll(() => {
  // Global beforeAll
})

afterAll(() => {
  // Global afterAll
})

process.on('unhandledRejection', () => { })
process.on('uncaughtException', () => { })

afterEach(() => {
  jest.clearAllMocks()
  LavalinkMock.clearResponses()
  TrackRegistry.clear()
})
