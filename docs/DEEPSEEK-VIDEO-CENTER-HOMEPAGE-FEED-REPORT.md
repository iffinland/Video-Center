# Video-Center Homepage Feed Investigation Report

Date: 2026-07-22

---

## 1. Confirmed Divergence Point

After exhaustive static tracing, the default homepage and search paths use the **identical** data pipeline:

```
HomePage → useVideos(identity) → discoverV2Videos → videos[]
```

The ONLY difference is:
```typescript
// Default (searchQuery = ''):     filtered = videos
// Search (searchQuery = 'new'):   filtered = videos.filter(...)
```

Both consume the same `videos` array. If `videos` is populated, both paths should render cards. The search path's ability to find the video proves `videos` IS populated when the search is performed.

**The divergence cannot be located through static analysis alone.** Runtime diagnostics have been added to surface the exact state at each lifecycle stage.

---

## 2. Root Cause Hypotheses (ranked)

### Hypothesis A (MOST LIKELY): Identity briefly creates a validator with empty cache

The `||` fix (from prior session) ensures identity is null until BOTH cache AND account are ready. But if React batches `setAccount` and `setAddressCache` into separate renders, there is a window where identity is null. During this window, `useVideos` shows "Identity validation is not available." When identity eventually becomes valid (next render), `useVideos` should re-run and discover videos.

However, if the identity transition triggers but `useVideos`'s `useEffect` does not re-fire (due to a React scheduling edge case), videos would never load. The search would trigger a re-render (via `setSearchQuery`) which might unstick the effect.

### Hypothesis B (LESS LIKELY): `hasBridge` evaluated as `false` on first render

`hasQortiumBridge()` checks `window.qdnRequest`. If this is not available during the first render (iframe timing), `hasBridge` is false, `fetchAccount` returns early, and identity stays null forever. A subsequent re-render would re-evaluate `hasBridge` (it's not memoized), potentially picking up the bridge and reloading the account.

### Hypothesis C (LEAST LIKELY): Wallet binding mismatch despite correct cache

The `createIdentityValidator` captures `currentCache` in its closure. If the cache is populated but the exact string key doesn't match (e.g., "iffi_vaba_mees" vs "Iffi_Vaba_Mees"), `get()` returns `undefined`.

---

## 3. Changes Made

### Change 1: `src/hooks/useAccount.ts:64` — `||` guard (prior session)

```typescript
// BEFORE: if (currentCache.size === 0 && !account?.address) return null;
// AFTER:  if (currentCache.size === 0 || !account?.address) return null;
```

Identity stays null until BOTH conditions are satisfied.

### Change 2: `src/hooks/useVideos.ts` — Lifecycle diagnostics (this session)

Added runtime diagnostics to the yellow banner:
- `⏳ Waiting for account identity…` — identity is null
- `🔍 Discovering videos from QDN…` — discovery in progress
- `📡 Discovery: N resource(s) seen, N page(s)` — search results
- `📦 Entities loaded: N total, N video(s)` — reducer output
- `⚠️ Quarantined: N — CODE` — if any rejected
- Per-resource detail diagnostics from the V2 runtime

### Change 3: `src/pages/HomePage.tsx` — Account error display (prior session)

Now shows `accountError` and `accountLoading` from `useAccount`.

---

## 4. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 249 KB JS, 19 KB CSS)
```

---

## 5. Expected Cold-Start Behavior (with diagnostics)

On fresh app start inside Qortium Home, the yellow diagnostics banner should show:

**If identity loads successfully:**
```
🔍 Discovering videos from QDN…
📡 Discovery: 2 resource(s) seen, 1 page(s), completeness=complete
📦 Entities loaded: 1 total, 1 video(s)
[UNAVAILABLE_RESOURCE] iffi_vaba_mees/qvc-v2-video-1hfnemeo: Data unavailable...
```
→ 1 video card visible (qvc-v2-video-gnrbf4t0)
→ 1 diagnostic for the old broken resource

**If identity never becomes valid:**
```
⏳ Waiting for account identity…
```
→ No video cards
→ No diagnostics from discovery
→ Account error may also be shown

**If all videos are quarantined:**
```
📡 Discovery: 2 resource(s) seen, 1 page(s), completeness=complete
📦 Entities loaded: 0 total, 0 video(s)
⚠️ Quarantined: 1 — WALLET_BINDING_MISMATCH
```
→ No video cards
→ Quarantine reason visible

---

## 6. Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Cold start → yellow banner shows lifecycle diagnostics | ⏳ Awaiting |
| 2 | Valid video appears as card on default homepage | ⏳ Awaiting |
| 3 | Old broken resource shows `[UNAVAILABLE_RESOURCE]` diagnostic | ⏳ Awaiting |
| 4 | Search finds same video | ⏳ Awaiting |
| 5 | Clear search → video still visible | ⏳ Awaiting |
| 6 | Hard reload → video still visible | ⏳ Awaiting |

---

## 7. Next Steps

The lifecycle diagnostics in the yellow banner will definitively show:
1. Whether identity becomes valid
2. How many resources discovery finds
3. How many entities pass validation
4. How many are quarantined (and why)
5. How many videos are loaded into `videos[]`

Based on the diagnostic output, the exact failure gate will be confirmed and a targeted fix can be applied.
