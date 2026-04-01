// Unified mock function that works in both vitest and jest
// vitest provides `vi` globally when globals:true; jest provides `jest` globally
declare const vi: any
declare const jest: any

export function fn(impl?: (...args: any[]) => any): any {
  if (typeof vi !== 'undefined') return vi.fn(impl)
  if (typeof jest !== 'undefined') return jest.fn(impl)
  return ((...args: any[]) => impl?.(...args)) as any
}

export const mock: any = (typeof vi !== 'undefined' ? vi : (globalThis as any).jest) || (typeof jest !== 'undefined' ? jest : {});

export const spyOn = (obj: any, method: string) => mock.spyOn(obj, method);
export const useFakeTimers = () => mock.useFakeTimers();
export const advanceTimersByTime = (ms: number) => mock.advanceTimersByTime(ms);
export const useRealTimers = () => mock.useRealTimers();
