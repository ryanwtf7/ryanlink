import { RyanlinkManager } from '../src/core/Manager'
import { LavalinkMock } from './mocks/LavalinkMock'

describe('Utils Expanded Coverage', () => {
  let manager: RyanlinkManager

  beforeEach(async () => {
    LavalinkMock.setup()
    manager = new RyanlinkManager({
      client: { id: 'bot123' },
      nodes: [{ host: 'localhost', id: 'local', port: 2333, authorization: 'pw' }],
      sendToShard: jest.fn(),
      advancedOptions: { enableDebugEvents: true }
    })
    manager.nodeManager.on('error', () => {}) // Prevent unhandled error crashes
    await manager.init({ id: 'bot123' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    LavalinkMock.clearResponses()
  })

  it('handles isNodeOptions', () => {
    // @ts-ignore
    expect(manager.utils.isNodeOptions({ host: 'h', port: 2333, authorization: 'pw' })).toBe(true)
    // @ts-ignore
    expect(manager.utils.isNodeOptions('string')).toBe(false)
  })

  it('handles transformQuery for various inputs', () => {
    expect(manager.utils.transformQuery('test')).toEqual({ query: 'test', source: 'ytsearch' })
    // @ts-ignore
    expect(manager.utils.transformQuery({ query: 'test', source: 'spotify' })).toEqual({ query: 'test', source: 'spsearch' })
  })

  it('handles isTrack and isUnresolvedTrack', () => {
    const track = { encoded: 'abc', info: { title: 'T' } }
    // @ts-ignore
    expect(manager.utils.isTrack(track)).toBe(true)
    // @ts-ignore
    expect(manager.utils.isTrack({})).toBe(false)
    // @ts-ignore
    expect(manager.utils.isUnresolvedTrack({ info: { title: 'T' }, resolve: () => {} })).toBe(true)
  })

  it('handles findSourceOfQuery', () => {
    expect(manager.utils.findSourceOfQuery('ytsearch:test')).toBe('ytsearch')
    expect(manager.utils.findSourceOfQuery('unknown:test')).toBeUndefined()
  })

  it('handles buildTrack errors', () => {
    const emitSpy = jest.spyOn(manager, 'emit')
    // @ts-ignore
    expect(() => manager.utils.buildTrack(null, 'user')).toThrow()
  })

  it('handles getTransformedRequester', () => {
    manager.options.playerOptions.requesterTransformer = (u: any) => u.name
    expect(manager.utils.getTransformedRequester({ name: 'Ryan' })).toBe('Ryan')
    
    // Test error branch
    manager.options.playerOptions.requesterTransformer = () => { throw new Error('Fail') }
    const emitSpy = jest.spyOn(manager, 'emit')
    manager.utils.getTransformedRequester({})
    expect(emitSpy).toHaveBeenCalledWith('debug', 'TransformRequesterFunctionFailed', expect.anything())
  })
})
