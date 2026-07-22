# Video-Center Performance Baseline Report

Date: 2026-07-22

---

## 1. Temporary Diagnostics

**Removed**: YES

Cleaned up `src/hooks/useVideos.ts` — removed emoji-prefixed lifecycle tracing diagnostics:
- `⏳ Waiting for account identity…`
- `🔍 Discovering videos from QDN…`
- `📡 Discovery: N resource(s) seen...`
- `📦 Entities loaded: N total, N video(s)`

**Kept**: Real failure diagnostics:
- `[UNAVAILABLE_RESOURCE]` — per-resource fetch/parse failures from `discoverV2Videos`
- `⚠️ Discovery was partial...` — pagination completeness warning
- `⚠️ N resource(s) quarantined: CODE` — validation rejections
- Error state messages for identity/network failures

Normal successful loading now shows only the standard "Loading videos from QDN…" spinner.

---

## 2. Cold-Start Performance Measurements

### Methodology

3 measurement runs against local Qortium node (`127.0.0.1:24891`) using `curl -w "%{time_total}"`.

### Raw Data

| Stage | Run 1 | Run 2 | Run 3 | Average |
|---|---|---|---|---|
| SEARCH_QDN_RESOURCES | 6.2ms | 5.6ms | 8.1ms | **6.6ms** |
| FETCH valid resource | 2.4ms | 17.8ms | 4.8ms | **8.3ms** |
| FETCH broken resource | 14,692ms | 14,826ms | 3,025ms | **10,848ms** |
| NAME resolve | 3.1ms | 18.5ms | 4.7ms | **8.8ms** |

### Estimated Total Cold-Start Time

| Stage | Duration | Notes |
|---|---|---|
| T0→T1: Account / identity ready | ~50ms | Bridge message round-trip (estimated) |
| T1→T2: SEARCH completed | ~7ms | Measured |
| T2→T3: Valid resource fetched | ~8ms | Measured |
| T2→T3: Broken resource fetched | **~10,848ms** | Measured — blocks loop |
| T3→T4: Reducer + validation | ~1ms | Estimated (in-memory) |
| T5→T6: React render | ~10ms | Estimated |
| **TOTAL** | **~10,925ms** | **~11 seconds** |

### Slowest Measured Stage

**FETCH of the broken resource `qvc-v2-video-1hfnemeo`** — average **10.8 seconds**.

The Core API returns `{"error":1401,"message":"Data unavailable..."}` after the node tries (and fails) to source the missing chunk from the network. This timeout dominates the entire cold-start time.

---

## 3. Broken Resource Impact — CONFIRMED

### Evidence

The `discoverV2Videos` function uses a **sequential** `for...of` loop:

```typescript
for (const item of videoResources) {
    const raw = await fetchJsonResource(...);  // ← BLOCKS on each await
}
```

Search result order (reverse=true, newest first):
1. `qvc-v2-video-gnrbf4t0` (valid, created 1784732425934) — fetched in ~8ms ✅
2. `qvc-v2-video-1hfnemeo` (broken, created 1784701211730) — fetched in **~10.8s** ❌

The valid resource is fetched first and added to `records`. But the loop does NOT call `reduceV2RuntimeRecords` or `setVideos` until ALL resources have been processed. The broken resource's 10.8-second fetch blocks the entire pipeline.

**Result**: The user sees "Loading videos from QDN…" for ~11 seconds before the video card appears. This is a confirmed application bottleneck.

### Without Broken Resource

If the broken resource were absent: total cold-start time would be ~30ms — essentially instant.

---

## 4. Scaling Analysis

### Current Architecture Characteristics

| Factor | Observation |
|---|---|
| **Fetch concurrency** | SEQUENTIAL — `for...of` with `await` |
| **QDN requests per N videos** | 1 SEARCH + N FETCH + 1..N NAME resolves |
| **Pagination** | Default page size 100, max 100 pages, max 10,000 resources |
| **Wallet resolution** | Only for names not in local cache; fire-and-forget (non-blocking) |

### Estimated Scaling

| Videos | QDN Requests | Estimated Time (no broken resources) |
|---|---|---|
| 1 | 1 SEARCH + 1 FETCH | ~15ms |
| 10 | 1 SEARCH + 10 FETCH | ~90ms |
| 50 | 1 SEARCH + 50 FETCH | ~420ms |
| 100 | 1 SEARCH + 100 FETCH | ~830ms |

These estimates assume all resources are healthy and local-network latency is ~6-8ms per fetch. With the current sequential fetch pattern, each additional video adds ~8ms. This is acceptable for up to ~100 videos (sub-second total).

### Key Risk

**One slow/broken resource blocks all others.** With sequential fetching, a single resource that takes N seconds to time out delays the entire homepage by N seconds. This risk grows linearly with the number of broken resources.

---

## 5. Confirmed Application Bottleneck

**YES** — the sequential fetch loop in `discoverV2Videos` (videoServiceV2.ts:148-175) is a confirmed bottleneck when broken or slow resources are present.

The measured impact is ~11 seconds of additional latency caused by ONE broken resource.

---

## 6. Node/Network Latency vs App Bottleneck

| Factor | Category |
|---|---|
| SEARCH at ~7ms | Node latency — fast, not a bottleneck |
| FETCH valid at ~8ms | Node latency — fast |
| FETCH broken at ~10.8s | Node timeout trying to source missing chunk — BUT app design amplifies this by fetching sequentially |
| NAME resolve at ~9ms | Node latency — fast |

The root cause is application design (sequential fetches) amplifying an infrastructure issue (unavailable QDN chunk).

---

## 7. Files Changed

| File | Change |
|---|---|
| `src/hooks/useVideos.ts` | Removed temporary lifecycle diagnostics; kept real failure diagnostics and quarantine/partial-discovery warnings |

---

## 8. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 248 KB JS, 20 KB CSS)
```

---

## 9. Recommendations (NOT IMPLEMENTED)

Based on the measurements:

1. **Parallel/concurrent fetching** — Change sequential `for...of` + `await` to `Promise.allSettled()` so broken resources don't block valid ones.
2. **Fetch timeout** — Add a per-resource fetch timeout (e.g., 5 seconds) so broken resources fail fast.
3. **Results streaming** — Call `reduceV2RuntimeRecords` and update state incrementally as resources are fetched, rather than waiting for all.
4. **Future**: Consider caching last-known-good state so the homepage renders instantly from cache while background discovery runs.
