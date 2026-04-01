// import { describe, it, expect } from 'vitest'
import { version } from '../src/index'

describe('Sanity Check', () => {
  it('should have a version defined', () => {
    expect(version).toBeDefined()
    expect(typeof version).toBe('string')
    console.log(`Current version: ${version}`)
  })

  it('should access global defines', () => {
    expect((globalThis as any).$clientName).toBeDefined()
    expect((globalThis as any).$clientVersion).toBeDefined()
  })
})
