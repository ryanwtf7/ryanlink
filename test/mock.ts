// Unified mock function that works in both vitest and jest
// vitest provides `vi` globally when globals:true; jest provides `jest` globally
declare const vi: any
declare const jest: any

export function fn(impl?: (...args: any[]) => any): any {
  if (typeof vi !== 'undefined') return vi.fn(impl)
  if (typeof jest !== 'undefined') return jest.fn(impl)
  // fallback: plain spy
  const calls: any[][] = []
  const mock = (...args: any[]) => {
    calls.push(args)
    return impl?.(...args)
  }
  ;(mock as any).mock = { calls }
  return mock
}
