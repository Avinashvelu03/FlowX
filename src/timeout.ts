// ============================================================================
// FlowX — Promise Timeout with Cleanup
// ============================================================================
import { AbortError, TimeoutError } from './types';

export interface TimeoutOptions<T = unknown> {
  /** Fallback value or factory when timeout occurs */
  fallback?: T | (() => T | Promise<T>);
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
  /** Custom error message */
  message?: string;
}

/**
 * Wrap an async operation with a timeout.
 *
 * @example
 * ```ts
 * const result = await withTimeout(() => fetch('/slow-api'), 5000);
 * ```
 */
export async function withTimeout<T>(
  fn: () => T | Promise<T>,
  ms: number,
  options?: TimeoutOptions<T>,
): Promise<T> {
  if (ms <= 0) {
    throw new RangeError('Timeout must be > 0');
  }

  if (options?.signal?.aborted) {
    throw new AbortError();
  }

  const fnResult = fn(); // call synchronously so sync throws propagate

  return Promise.race([
    Promise.resolve(fnResult),
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        if (options?.fallback !== undefined) {
          const fb = options.fallback;
          if (typeof fb === 'function') {
            try {
              const result = (fb as () => T | Promise<T>)();
              Promise.resolve(result).then(
                (v) => reject({ __resolved: true, value: v } as any),
                reject,
              );
            } catch (err) {
              reject(err);
            }
          } else {
            reject({ __resolved: true, value: fb } as any);
          }
        } else {
          reject(new TimeoutError(options?.message));
        }
      }, ms);

      // If signal aborts, reject the race
      if (options?.signal) {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new AbortError());
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      // Clean up timer when fn resolves
      Promise.resolve(fnResult).then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]).catch((err) => {
    // Handle the fallback resolution hack
    if (err && typeof err === 'object' && '__resolved' in err) {
      return err.value as T;
    }
    throw err;
  });
}
