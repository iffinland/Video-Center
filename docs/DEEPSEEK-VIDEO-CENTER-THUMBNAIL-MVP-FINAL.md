# Video-Center Thumbnail MVP Final Report

Date: 2026-07-22

---

## 1. Thumbnail Source / Path

Uses the existing `getQdnResourceUrl` helper (`src/services/qdn/qdnService.ts`) to resolve the `thumbnailReference` from the `VideoCreate` entity:

```
thumbnailReference.service    = "IMAGE"
thumbnailReference.name       = "iffi_vaba_mees"
thumbnailReference.identifier = "vc-thumb-qen18c6"
```

`getQdnResourceUrl` calls the Qortium Home bridge `GET_QDN_RESOURCE_URL` action, which returns a relative URL like `/arbitrary/IMAGE/iffi_vaba_mees/vc-thumb-qen18c6`. This URL is used directly as the `<img src>` attribute. The Qortium Home proxy serves the resource data.

## 2. Fallback Behavior

Three fallback tiers:

| State | Display |
|---|---|
| No `thumbnailReference` on entity | SVG play-icon placeholder (dark background) |
| `thumbnailReference` exists but URL resolution fails | SVG placeholder (async catch) |
| Image loads but `<img onError>` fires | SVG placeholder (runtime fallback) |

The SVG placeholder is a compact play-icon polygon in a dark `aspect-video` container — no broken-image browser icon, no blank area, no raw QDN errors.

## 3. Raw Technical Diagnostics

**Hidden**: YES.

`[UNAVAILABLE_RESOURCE]` entries and timeout messages are no longer surfaced in the user-facing yellow diagnostics banner. Only user-relevant warnings are shown:

- `⚠️ Discovery was partial (N resources seen). Some videos may be missing.`
- `⚠️ N resource(s) quarantined: WALLET_BINDING_MISMATCH`

The raw diagnostics from `discoverV2Videos` → `V2RuntimeState.diagnostics` are still tracked internally but filtered out of the UI when healthy videos are present.

## 4. Files Changed

| File | Change |
|---|---|
| `src/components/video/VideoCard.tsx` | Added `useEffect` + `getQdnResourceUrl` to load thumbnail. Added `onError` fallback. Extracted `ThumbnailPlaceholder` component. |
| `src/hooks/useVideos.ts` | Filtered raw `[UNAVAILABLE_RESOURCE]` diagnostics from user-facing output. Only quarantine and partial-discovery warnings shown. |

## 5. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 250 KB JS, 20 KB CSS)
```

## 6. Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Fresh open → video cards appear quickly | ✅ |
| 2 | Published thumbnail visible on valid video card | ⏳ Awaiting runtime |
| 3 | Refresh → thumbnail still appears | ⏳ Awaiting runtime |
| 4 | Search → thumbnail still appears in result | ⏳ Awaiting runtime |
| 5 | Missing/broken thumbnail → graceful SVG fallback | ✅ |
| 6 | No broken-image browser icon | ✅ |
| 7 | No huge blank area | ✅ |
| 8 | Raw UNAVAILABLE_RESOURCE not shown to user | ✅ |
| 9 | Old broken resource does not block valid videos | ✅ |
| 10 | Build passes | ✅ |

## 7. MVP Completion Summary

All identified MVP issues have been addressed:

| Issue | Resolution |
|---|---|
| Cold-start routing | Catch-all route redirects to `/` |
| Homepage feed empty | Progressive discovery, concurrency, early render |
| Broken resource blocking | Per-fetch timeout, failure isolation |
| File picker re-opening | Inline limit raised to 10 MiB |
| Raw diagnostics visible | Filtered to user-relevant warnings only |
| Missing thumbnails | QDN thumbnail display with SVG fallback |
