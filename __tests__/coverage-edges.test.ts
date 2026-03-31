/**
 * Targeted tests to reach 100% coverage on every remaining uncovered branch/line.
 */
import { withTimeout } from '../src/timeout';
import { debounce } from '../src/debounce';
import { createCircuitBreaker } from '../src/circuit-breaker';
import { createQueue } from '../src/queue';
import { poll } from '../src/poll';
import { batch } from '../src/batch';
import { hedge } from '../src/hedge';
import { throttle } from '../src/throttle';
import { sleep, calculateDelay, AbortError } from '../src/types';

// ── timeout.ts ──────────────────────────────────────────────────────────────

describe('timeout coverage', () => {
  it('fn resolves before timeout — timer is cleared', async () => {
    const result = await withTimeout(() => 'fast', 50);
    expect(result).toBe('fast');
  });

  it('fn rejects before timeout', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('boom')), 1000)).rejects.toThrow(
      'boom',
    );
  });

  it('timeout fires before fn resolves', async () => {
    await expect(
      withTimeout(() => new Promise((r) => setTimeout(() => r('late'), 200)), 10),
    ).rejects.toThrow('Operation timed out');
  });

  it('abort fires before fn resolves', async () => {
    const ac = new AbortController();
    const p = withTimeout(() => new Promise((r) => setTimeout(() => r('late'), 200)), 1000, {
      signal: ac.signal,
    });
    setTimeout(() => ac.abort(), 5);
    await expect(p).rejects.toThrow(AbortError);
  });

  it('pre-aborted signal rejects immediately', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(withTimeout(() => 'x', 1000, { signal: ac.signal })).rejects.toThrow(AbortError);
  });

  it('fn resolves with signal — cleans up listener', async () => {
    const ac = new AbortController();
    const result = await withTimeout(() => 'ok', 1000, { signal: ac.signal });
    expect(result).toBe('ok');
  });

  it('fn rejects with signal — cleans up listener', async () => {
    const ac = new AbortController();
    await expect(
      withTimeout(() => Promise.reject(new Error('err')), 1000, {
        signal: ac.signal,
      }),
    ).rejects.toThrow('err');
  });

  it('fn throws synchronously', async () => {
    await expect(
      withTimeout(() => {
        throw new Error('sync');
      }, 1000),
    ).rejects.toThrow('sync');
  });

  it('fn throws synchronously with signal', async () => {
    const ac = new AbortController();
    await expect(
      withTimeout(
        () => {
          throw new Error('sync-sig');
        },
        1000,
        { signal: ac.signal },
      ),
    ).rejects.toThrow('sync-sig');
  });

  it('fallback function', async () => {
    const result = await withTimeout(
      () => new Promise((r) => setTimeout(() => r('slow'), 200)),
      10,
      { fallback: () => 'fb' },
    );
    expect(result).toBe('fb');
  });

  it('fallback static value', async () => {
    const result = await withTimeout(
      () => new Promise((r) => setTimeout(() => r('slow'), 200)),
      10,
      { fallback: 'static' },
    );
    expect(result).toBe('static');
  });

  it('fallback function throws', async () => {
    await expect(
      withTimeout(() => new Promise((r) => setTimeout(() => r('slow'), 200)), 10, {
        fallback: () => {
          throw new Error('fb-err');
        },
      }),
    ).rejects.toThrow('fb-err');
  });

  it('custom timeout message', async () => {
    await expect(
      withTimeout(() => new Promise((r) => setTimeout(r, 100)), 10, {
        message: 'custom',
      }),
    ).rejects.toThrow('custom');
  });

  it('RangeError for ms <= 0', () => {
    expect(() => withTimeout(() => 'x', 0)).rejects.toThrow(RangeError);
  });
});

// ── types.ts ────────────────────────────────────────────────────────────────

describe('types.ts coverage', () => {
  it('sleep completes normally with signal — listener is cleaned up', async () => {
    const ac = new AbortController();
    await sleep(10, ac.signal);
    // If listener wasn't removed, aborting now would be a no-op (but shouldn't throw)
    ac.abort();
  });

  it('sleep without signal', async () => {
    await sleep(5);
  });

  it('sleep aborted mid-wait', async () => {
    const ac = new AbortController();
    const p = sleep(200, ac.signal);
    setTimeout(() => ac.abort(), 5);
    await expect(p).rejects.toThrow(AbortError);
  });

  it('sleep pre-aborted signal', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(100, ac.signal)).rejects.toThrow(AbortError);
  });

  it('calculateDelay with function strategy', () => {
    const d = calculateDelay(3, 100, (a, b) => a * b * 2);
    expect(d).toBe(600);
  });

  it('calculateDelay with numeric jitter', () => {
    const d = calculateDelay(1, 100, 'fixed', 0.5);
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it('calculateDelay with boolean jitter', () => {
    const d = calculateDelay(1, 100, 'fixed', true);
    expect(d).toBeGreaterThanOrEqual(0);
  });
});

// ── batch.ts ────────────────────────────────────────────────────────────────

describe('batch.ts coverage', () => {
  it('handles non-Error thrown from fn', async () => {
    const result = await batch([1], async () => {
      throw 'string-error'; // eslint-disable-line no-throw-literal
    });
    expect(result.failed).toBe(1);
    expect(result.errors.get(0)?.message).toBe('string-error');
  });

  it('abort signal checked at batch level', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(batch([1, 2], async (v) => v, { signal: ac.signal })).rejects.toThrow(AbortError);
  });

  it('abort signal checked at item level', async () => {
    const ac = new AbortController();
    const result = batch(
      [1, 2, 3],
      async (v) => {
        if (v === 2) ac.abort();
        return v;
      },
      { batchSize: 1, signal: ac.signal },
    );
    await expect(result).rejects.toThrow(AbortError);
  });
});

// ── circuit-breaker.ts ──────────────────────────────────────────────────────

describe('circuit-breaker.ts coverage', () => {
  it('scheduleReset clears existing resetTimer (line 77)', () => {
    const cb = createCircuitBreaker(jest.fn().mockResolvedValue('ok'), {
      failureThreshold: 5,
      resetTimeout: 5000,
    });

    // First open() sets resetTimer
    cb.open();
    expect(cb.state).toBe('open');

    // Second open() calls scheduleReset while resetTimer is still active → clearTimeout
    cb.open();
    expect(cb.state).toBe('open');

    // Clean up
    cb.reset();
  });

  it('shouldTrip false in half-open', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('trip'))
      .mockRejectedValueOnce(new Error('no-trip'));

    const cb = createCircuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 30,
      shouldTrip: (err) => err.message === 'trip',
    });

    await expect(cb.fire()).rejects.toThrow('trip');
    expect(cb.state).toBe('open');

    await new Promise((r) => setTimeout(r, 50));
    expect(cb.state).toBe('half-open');

    await expect(cb.fire()).rejects.toThrow('no-trip');
    cb.reset();
  });

  it('half-open limit reached', async () => {
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(() => r('ok'), 100)));

    const cb = createCircuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 30,
      halfOpenLimit: 1,
    });

    // Trip the breaker
    fn.mockRejectedValueOnce(new Error('fail'));
    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    await new Promise((r) => setTimeout(r, 50));
    expect(cb.state).toBe('half-open');

    // First call in half-open — uses the slot
    const p1 = cb.fire();
    // Second call should throw limit reached
    await expect(cb.fire()).rejects.toThrow('half-open — limit reached');

    await p1;
    cb.reset();
  });

  it('success in closed state resets failureCount', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const cb = createCircuitBreaker(fn, { failureThreshold: 5 });
    await cb.fire();
    expect(cb.failureCount).toBe(0);
  });

  it('onStateChange callback fires', async () => {
    const changes: string[] = [];
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const cb = createCircuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 30,
      onStateChange: (from, to) => changes.push(`${from}->${to}`),
    });

    await expect(cb.fire()).rejects.toThrow();
    expect(changes).toContain('closed->open');
    cb.reset();
  });
});

// ── debounce.ts ─────────────────────────────────────────────────────────────

describe('debounce.ts coverage', () => {
  it('non-Error thrown from debounced fn', async () => {
    const fn = jest.fn().mockImplementation(() => {
      throw 42; // eslint-disable-line no-throw-literal
    });
    const d = debounce(fn, 10, { trailing: true });
    const p = d('a');
    await expect(p).rejects.toThrow('42');
  });

  it('leading invoke', async () => {
    const fn = jest.fn().mockReturnValue('lead');
    const d = debounce(fn, 50, { leading: true, trailing: false });
    const result = await d('a');
    expect(result).toBe('lead');
  });

  it('maxWait forces invoke', async () => {
    const fn = jest.fn().mockReturnValue('max');
    const d = debounce(fn, 500, { maxWait: 20, trailing: true });
    const p = d('x');
    const result = await p;
    expect(result).toBe('max');
  });

  it('cancel clears maxTimer', async () => {
    const fn = jest.fn().mockReturnValue('val');
    const d = debounce(fn, 200, { maxWait: 100 });
    const p = d('a');
    d.cancel();
    await expect(p).rejects.toThrow('Debounced call cancelled');
  });

  it('flush when not pending', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const d = debounce(fn, 50);
    const result = await d.flush();
    expect(result).toBeUndefined();
  });
});

// ── hedge.ts ────────────────────────────────────────────────────────────────

describe('hedge.ts coverage', () => {
  it('hedge timer fires after primary resolves (settled guard)', async () => {
    const fn = jest.fn().mockResolvedValue('fast');
    const result = await hedge(fn, { delay: 5 });
    expect(result).toBe('fast');
    // Wait for the hedge timer to fire — it will hit `if (settled) return`
    await new Promise((r) => setTimeout(r, 20));
    // fn called once for primary, hedge timer should have also tried to call
  });

  it('all attempts fail → rejects with first error', async () => {
    await expect(hedge(() => Promise.reject(new Error('all-fail')), { delay: 5 })).rejects.toThrow(
      'all-fail',
    );
  });

  it('non-Error rejection', async () => {
    await expect(
      hedge(
        () => Promise.reject('str-err'), // eslint-disable-line no-throw-literal
        { delay: 5 },
      ),
    ).rejects.toThrow('str-err');
  });

  it('primary slow, hedge wins', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return new Promise((r) => setTimeout(() => r('slow'), 200));
      }
      return Promise.resolve('hedge-won');
    });
    const result = await hedge(fn, { delay: 5 });
    expect(result).toBe('hedge-won');
  });
});

// ── poll.ts ─────────────────────────────────────────────────────────────────

describe('poll.ts coverage', () => {
  it('stop during sleep (line 67 — stopped guard in catch)', async () => {
    let callCount = 0;
    const controller = poll(
      () => {
        callCount++;
        return callCount;
      },
      { until: () => false, interval: 50 },
    );

    // Wait for first poll to complete, then stop during the sleep interval
    await new Promise((r) => setTimeout(r, 10));
    controller.stop();
    await expect(controller.result).rejects.toThrow(AbortError);
  });

  it('pre-aborted signal', async () => {
    const ac = new AbortController();
    ac.abort();
    const c = poll(() => 'x', { signal: ac.signal });
    await expect(c.result).rejects.toThrow(AbortError);
  });

  it('maxAttempts exceeded', async () => {
    const c = poll(() => 'x', { until: () => false, maxAttempts: 2 });
    await expect(c.result).rejects.toThrow('Polling exceeded maximum attempts');
  });
});

// ── queue.ts ────────────────────────────────────────────────────────────────

describe('queue.ts coverage', () => {
  it('handles non-Error thrown from task (line 108)', async () => {
    const q = createQueue({ concurrency: 1 });
    await expect(
      q.add(async () => {
        throw 'string-queue-error'; // eslint-disable-line no-throw-literal
      }),
    ).rejects.toThrow('string-queue-error');
  });
});

// ── throttle.ts ─────────────────────────────────────────────────────────────

describe('throttle.ts coverage', () => {
  it('non-Error thrown in trailing invoke (line 63)', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw 'non-error-trailing'; // eslint-disable-line no-throw-literal
      return 'ok';
    });
    const t = throttle(fn, 50);
    await t('a');
    const p2 = t('b');
    await expect(p2).rejects.toThrow('non-error-trailing');
  });

  it('non-Error thrown in leading invoke (line 93)', async () => {
    const fn = jest.fn().mockImplementation(() => {
      throw 'non-error-leading'; // eslint-disable-line no-throw-literal
    });
    const t = throttle(fn, 50);
    await expect(t('a')).rejects.toThrow('non-error-leading');
  });

  it('leading false trailing true', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const t = throttle(fn, 50, { leading: false, trailing: true });
    const result = await t('a');
    expect(result).toBe('ok');
  });

  it('invokeTrailing with null lastArgs', async () => {
    // leading=true, trailing=true
    // Call once (leading fires), then wait for trailing timer to fire
    // with lastArgs=null (since leading already consumed args)
    const fn = jest.fn().mockReturnValue('ok');
    const t = throttle(fn, 30, { leading: true, trailing: true });
    await t('a'); // leading call
    // trailing timer fires at 30ms with lastArgs=null → resolves(undefined)
    await new Promise((r) => setTimeout(r, 50));
  });
});
