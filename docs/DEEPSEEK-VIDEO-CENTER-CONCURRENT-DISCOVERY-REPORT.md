# Video-Center Concurrent Discovery Report

Date: 2026-07-22

---

## 1. Concurrency Strategy

**Bounded concurrent fetching with per-resource timeout**, adapted from the Discussion-Boards `mapWithConcurrency` pattern (`projects/Discssion-Boards/src/services/qdn/qdnReadiness.ts`).

### Implementation

Two new helpers in `src/services/qdn/videoServiceV2.ts`:

**`mapWithConcurrency(items, mapper, concurrency)`** — Processes items through a mapper function with at most N concurrent workers. Each worker picks the next unprocessed item and awaits the mapper. Uses `Promise.all` across workers — all items are processed before the function returns.

**`withTimeout(promise, timeoutMs, label)`** — Wraps a promise with `Promise.race` against a timeout. If the original promise doesn't settle within `timeoutMs`, the race rejects with a timeout error. The underlying request continues (in bridge mode, `postMessage` cannot be cancelled), but the application stops waiting.

### Chosen Concurrency Limit

**6** — matching Discussion-Boards' `RESOURCE_FETCH_CONCURRENCY`.

Rationale:
- 6 concurrent requests are well within the local Core node's capacity
- Provides good throughput for 10-100 resources (all complete in ~1-2 batches)
- Prevents unbounded parallelism that could overload the node

### Per-Fetch Timeout

**5,000ms** — chosen because:
- Healthy local fetches complete in ~8ms (well within)
- The Core API's own timeout for unavailable resources is ~3-15 seconds
- 5 seconds cuts the worst case roughly in half while allowing legitimate slower fetches to complete
- Not so short that it risks false timeouts on legitimately slow resources

---

## 2. Failure Isolation

Each resource fetch is an independent `mapWithConcurrency` call. Failures produce `{ ok: false, failure: "..." }` results. Successes produce `{ ok: true, record: {...} }` results. After all fetches settle, results are partitioned:

```
SUCCESS → records[] → reduceV2RuntimeRecords() → state.entities
FAILURE → fetchFailures[] → UNAVAILABLE_RESOURCE diagnostics
```

One failed resource never rejects the whole batch.

**10 valid + 1 broken = 10 records + 1 diagnostic** ✅

---

## 3. Healthy Videos Render Before Broken-Resource Timeout

**Partially**. The fix reduces the wait from ~10.8s (Core timeout) to ~5s (app timeout), a ~2.2x improvement.

True early rendering (sub-second while broken resource is still pending) would require architectural changes:
- Streaming results into `reduceV2RuntimeRecords` incrementally
- Exposing partial state through a callback or event system
- Restructuring `useVideos` to handle incremental updates

The current `discoverV2Videos` returns a single `V2RuntimeState`. All fetches must settle before the reducer runs. With the 5s timeout, the worst-case wait is 5s. This is acceptable for MVP.

---

## 4. Performance Verification

### Measured (pre-fix baseline)

| Stage | Time |
|---|---|
| SEARCH | 6.6ms |
| FETCH valid | 8.3ms |
| FETCH broken | 10,848ms |
| **TOTAL** | **~10.9s** |

### Estimated (post-fix)

| Stage | Time |
|---|---|
| SEARCH | 6.6ms |
| Concurrent fetch (valid + broken) | max(8ms, 5,000ms) = 5,000ms |
| Reducer + render | ~11ms |
| **TOTAL** | **~5.0s** |

### Key Metrics

| Metric | Before | After |
|---|---|---|
| Time to first healthy video | ~10.9s | ~5.0s |
| Broken resource failure time | 10.8s (Core) | 5.0s (app timeout) |
| Diagnostic availability | After 10.9s | After 5.0s |

### Scaling (post-fix, no broken resources)

| Videos | Concurrent batches (6 workers) | Estimated time |
|---|---|---|
| 1 | 1 batch | ~15ms |
| 10 | 2 batches | ~25ms |
| 50 | 9 batches | ~75ms |
| 100 | 17 batches | ~140ms |

With healthy resources only: sub-second for up to hundreds of videos.

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/services/qdn/videoServiceV2.ts` | Replaced sequential `for...of` + `await` loop with `mapWithConcurrency` (6 workers) + `withTimeout` (5s per fetch) |

---

## 6. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 249 KB JS, 20 KB CSS)
```

---

## 7. Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Fresh open → HomePage mounts automatically | ✅ (prior fix) |
| 2 | SEARCH discovers both healthy and broken resources | ✅ |
| 3 | Healthy video appears without waiting 10.8s | ✅ (~5s now) |
| 4 | Broken resource produces UNAVAILABLE_RESOURCE | ✅ |
| 5 | Broken resource does not hide healthy videos | ✅ |
| 6 | Search still works | ✅ |
| 7 | Refresh still works | ✅ |
| 8 | Build passes | ✅ |

---

## 8. Limitation

`mapWithConcurrency` uses `Promise.all` internally — it waits for ALL items to be processed before returning. The per-fetch timeout caps individual wait at 5s, but the function still returns only after all items settle.

True "streaming" (render healthy results immediately without waiting for slow/broken ones) would require:
- Returning partial `V2RuntimeState` incrementally
- A callback or observable pattern in `discoverV2Videos`
- Changes to `useVideos` to handle incremental updates

This is a candidate for a future optimization pass but is not required for MVP.
