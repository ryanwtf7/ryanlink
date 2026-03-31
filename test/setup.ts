import { vi, beforeAll, afterAll, afterEach } from 'vitest'
import { LavalinkMock } from './mocks/LavalinkMock'
import { TrackRegistry } from '../src/utils/TrackRegistry'

beforeAll(() => {})

afterAll(() => {})

afterEach(() => {
  vi.clearAllMocks();
  LavalinkMock.clearResponses();
  TrackRegistry.clear();
})
