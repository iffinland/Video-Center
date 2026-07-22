# Video-Center Cold-Start Discovery Fix Report

Date: 2026-07-22

---

## 1. Confirmed Root Cause

**The `useAccount` hook's `useMemo` condition used `&&` (AND) instead of `||` (OR), allowing an identity validator to be created with an empty address cache during a narrow render window.**

### File: `src/hooks/useAccount.ts`, line 64

```typescript
// BEFORE (buggy):
if (currentCache.size === 0 && !account?.address) return null;

// AFTER (fixed):
if (currentCache.size === 0 || !account?.address) return null;
```

The old condition only returned `null` when BOTH the cache was empty AND the account had no address. When `setAccount(profile)` fired in one render and `setAddressCache(cache)` fired in a subsequent render (due to React 18 batching edge case in async callbacks), an intermediate render occurred where `account.address` was set but `addressCache` was still empty. The condition `true && false` evaluated to `false`, so `identity` was created with an empty `addressCache`. Every `resolveWallet()` call returned `null`, causing `WALLET_BINDING_MISMATCH` for ALL discovered videos — including the user's own freshly published video.

The new condition with `||` ensures `identity` stays `null` until BOTH prerequisites are met: a non-empty cache AND a valid account address. `useVideos` treats `null` identity as "not ready yet" (showing loading/error) rather than "ready but broken" (silently quarantining everything).

---

## 2. Immediate Post-Publish vs Cold-Start Comparison

| Aspect | Immediate After Publish | Cold Start (before fix) |
|---|---|---|
| Account state | Already loaded, identity valid with populated cache | Loads async, brief period where identity is null |
| `useVideos` identity | Non-null with correct cache | null → **broken validator with empty cache** → possibly correct |
| `resolveWallet("iffi_vaba_mees")` | Returns correct address | Returns `null` (empty cache) |
| `validateWalletBinding` | PASS | **FAIL → WALLET_BINDING_MISMATCH** |
| Reducer result | ENTITIES | **QUARANTINE** |
| Homepage | Video card visible | **"No videos yet"** |

**First divergence point**: `useAccount.ts:64` — the `&&` condition allows a validator with empty cache to be treated as valid, bypassing the null-identity guard in `useVideos`.

---

## 3. Runtime Evidence for qvc-v2-video-gnrbf4t0

| Check | Result |
|---|---|
| SEARCH_QDN_RESOURCES | ✅ Found |
| LIST_QDN_RESOURCES | ✅ Found |
| Status | READY, 2/2 chunks, 100% |
| Direct fetch | ✅ Valid qvc-v2 envelope returned |
| `isV2EntityEnvelope` | ✅ PASS |
| `resolveWallet("iffi_vaba_mees")` via Core API | `QWifxJWGbJZ6Yo6kiimFkBGcm4AxQefdUm` ✅ |
| Envelope `walletAddress` | `QWifxJWGbJZ6Yo6kiimFkBGcm4AxQefdUm` ✅ |
| Wallet binding (with correct cache) | ✅ MATCH |
| Wallet binding (with empty cache) | ❌ FAILS |

---

## 4. Changes Made

### Change 1: `src/hooks/useAccount.ts` — Identity null-guard

**What**: Changed `&&` to `||` in the `useMemo` condition that determines whether `identity` is `null`.

**Why**: Prevents creation of an `IdentityValidator` with an empty `addressCache`, which silently quarantines all discovered videos.

### Change 2: `src/pages/HomePage.tsx` — Surface account errors

**What**: Destructure `error` and `loading` from `useAccount()` and display them before video loading states.

**Why**: Previously, `useAccount` errors were silently ignored. If account loading failed, the user saw "Identity validation is not available." with no indication that the account itself couldn't be loaded.

### Prior Changes (from previous session)

### Change 3: `src/services/qdn/qdnService.ts` — `waitForResourceReady` throws on timeout

**What**: After 45s timeout, throws `Error` instead of silently returning non-READY status.

### Change 4: `src/services/qdn/videoServiceV2.ts` — Publish verification

**What**: `publishVideoV2` now verifies each resource reports READY after `waitForResourceReady`.

### Change 5: `src/services/qdn/videoServiceV2.ts` — Discovery diagnostics

**What**: `discoverV2Videos` surfaces `fetchFailures` as `UNAVAILABLE_RESOURCE` diagnostics instead of silently skipping unreadable resources.

---

## 5. Old Broken Resource Behavior

`DOCUMENT / iffi_vaba_mees / qvc-v2-video-1hfnemeo`

- Still MISSING_DATA (1/2 chunks, 50%)
- `discoverV2Videos` produces diagnostic: `[UNAVAILABLE_RESOURCE] iffi_vaba_mees/qvc-v2-video-1hfnemeo: Data unavailable.`
- **Does NOT prevent `qvc-v2-video-gnrbf4t0` from loading** — each resource is fetched independently in the loop; a failure on one continues to the next.

---

## 6. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 248 KB JS, 19 KB CSS)
```

---

## 7. Cold-Start Acceptance Criteria

| # | Criterion | Expected |
|---|---|---|
| 1 | Close Video-Center completely | — |
| 2 | Reopen from Qortium Home | — |
| 3 | Do NOT publish another video first | — |
| 4 | qvc-v2-video-gnrbf4t0 appears as homepage card | ✅ Expected |
| 5 | Hard reload / reopen again | — |
| 6 | Same video still appears | ✅ Expected |
| 7 | Old broken resource (qvc-v2-video-1hfnemeo) shows diagnostic | ✅ Expected |
| 8 | Old broken resource does NOT block valid video | ✅ Expected |

**Status**: ⚠️ Awaiting runtime verification inside Qortium Home. Build passes. Logic fix is correct.

---

## 8. Remaining Issues (not addressed)

| Issue | Status |
|---|---|
| Wallet resolution for OTHER publishers' videos (cache only has current user's names) | Secondary — needs Discussion-Boards-style pre-resolution of all discovered publisher names |
| Orphan VIDEO/IMAGE media resources (4 media files for old publish attempts) | Secondary |
| QDN network chunk availability for old resource `qvc-v2-video-1hfnemeo` | Cannot fix in Video-Center |
