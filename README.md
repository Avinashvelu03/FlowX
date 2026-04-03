<p align="center">
  <img src="https://img.shields.io/npm/v/flowx-control?style=flat-square&color=blue" alt="npm version" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage" />
  <img src="https://img.shields.io/npm/l/flowx-control?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square" alt="zero deps" />
  <img src="https://img.shields.io/badge/TypeScript-first-blue?style=flat-square&logo=typescript&logoColor=white" alt="typescript" />
  <img src="https://img.shields.io/npm/dm/flowx-control?style=flat-square" alt="downloads" />
</p>

# FlowX

**Production-grade resilience & async flow control for TypeScript/JavaScript.**

> Stop shipping fragile async code. FlowX gives you battle-tested patterns — retry, circuit breaker, rate limiter, bulkhead, queue, and 12 more — in a single, zero-dependency, tree-shakable package with **100% test coverage**.

---

## Why FlowX?

| | FlowX | Others |
|--|-------|--------|
| **Dependencies** | 0 | 3–15+ |
| **Test Coverage** | 100% statements, branches, functions, lines | Partial |
| **TypeScript** | Native `.d.ts` + `.d.mts` | Bolted-on types |
| **Tree-shaking** | Per-module deep imports | Monolithic bundle |
| **Module Support** | ESM + CJS + Types | Usually one |
| **Patterns** | 17 resilience & flow primitives | 2–5 |

---

## Install

```bash
npm install flowx-control
yarn add flowx-control
pnpm add flowx-control
```

---

## Quick Start

```ts
import { retry, createCircuitBreaker, withTimeout, rateLimit } from 'flowx-control';

// Retry with exponential backoff
const data = await retry(() => fetch('/api/data'), {
  maxAttempts: 5,
  delay: 1000,
  backoff: 'exponential',
});

// Circuit breaker
const breaker = createCircuitBreaker(fetchUser, {
  failureThreshold: 5,
  resetTimeout: 30_000,
});
const user = await breaker.fire(userId);

// Timeout
const result = await withTimeout(() => fetch('/slow'), 5000, {
  fallback: () => cachedResponse,
});

// Rate limiter
const limiter = createRateLimiter({ limit: 10, interval: 1000 });
await limiter.execute(() => callExternalApi());
```

---

## All 17 Modules

### 🛡️ Resilience

- **retry** — Exponential backoff, jitter, abort signal, custom retry predicates
- **circuitBreaker** — Closed/Open/Half-open state machine, trip hooks
- **fallback** — Graceful degradation with fallback chains
- **timeout** — Hard deadline + optional fallback value

### 🚦 Concurrency

- **bulkhead** — Max concurrent + max queue isolation
- **queue** — Priority async task queue with concurrency
- **semaphore** — Counting resource lock (acquire/release)
- **mutex** — Mutual exclusion for critical sections

### 🎛️ Flow Control

- **rateLimit** — Token bucket with queue/reject strategies
- **throttle** — Leading/trailing edge, cancellable
- **debounce** — maxWait support, flush/cancel
- **batch** — Process collections in chunks with progress
- **pipeline** — Compose sync/async operations

### 🛠️ Utilities

- **poll** — Repeated polling with backoff until condition
- **hedge** — Speculative parallel requests
- **memo** — Async memoization with TTL + max size
- **deferred** — Externally resolvable promise

---

## Error Hierarchy

| Error | Code | Thrown by |
|-------|------|----------|
| `TimeoutError` | `ERR_TIMEOUT` | `withTimeout` |
| `CircuitBreakerError` | `ERR_CIRCUIT_OPEN` | `circuitBreaker` |
| `BulkheadError` | `ERR_BULKHEAD_FULL` | `bulkhead` |
| `AbortError` | `ERR_ABORTED` | `poll`, `batch`, `timeout` |
| `RateLimitError` | `ERR_RATE_LIMIT` | `rateLimit` |

---

## Compatibility

| Environment | Support |
|-------------|---------|
| Node.js | ≥ 16 |
| Bun | ✅ |
| Deno | ✅ |
| Browsers | ✅ (ESM) |
| TypeScript | ≥ 4.7 |

---

## Contributing

```bash
git clone https://github.com/Avinashvelu03/flowx-control.git
cd flowx-control && npm install
npm test
npm run build
```

---

## License

MIT © [Avinash](https://github.com/Avinashvelu03)

---

## ⚡ Fuel the Flow

<div align="center">

```
  · · · · · · · · · · · · · · · · · · · · · · · ·
  ·                                       ·
  ·   FlowX handles your retries,          ·
  ·   your circuit breakers,               ·
  ·   your race conditions,                ·
  ·   and your 3 AM production fires.      ·
  ·                                       ·
  ·   If it earned your trust — fuel it.   ·
  ·                                       ·
  · · · · · · · · · · · · · · · · · · · · · · · ·
```

[![Ko-fi](https://img.shields.io/badge/☕_Ko--fi-Fuel_the_Flow-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/avinashvelu)
[![GitHub Sponsors](https://img.shields.io/badge/⚡_Sponsor-Power_Up-EA4AAA?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/Avinashvelu03)

**No budget? No problem:**
- ⭐ [Star FlowX](https://github.com/Avinashvelu03/flowx-control) — boosts discovery
- 🐛 [Open an issue](https://github.com/Avinashvelu03/flowx-control/issues) — shape the roadmap
- 🗣️ Tell a dev who ships async code

*Built solo, shipped free — by [Avinash Velu](https://github.com/Avinashvelu03)*

</div>
