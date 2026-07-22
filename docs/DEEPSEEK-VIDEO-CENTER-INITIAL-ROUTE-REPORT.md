# Video-Center Initial Route Fix Report

Date: 2026-07-22

---

## 1. Confirmed Initial-Route Failure

On initial Video-Center launch or browser refresh inside Qortium Home, the `BrowserRouter` with `basename={_qdnBase}` strips the basename from the URL. The QDN iframe URL typically contains additional path segments (like `/qdn-apps/q-apps.html`) beyond the app's `_qdnBase`. After basename stripping, the remaining path does NOT match any defined route (`/`, `/video/:name/:identifier`, etc.). React Router's `<Routes>` renders nothing — the `Layout` (header) is visible, but no child route component mounts.

## 2. Exact Initial Path vs Logo-Click Path

**Initial load** (hypothetical — inside Qortium Home iframe):
```
window.location.pathname = /render/APP/iffi_vaba_mees/qdn-apps/q-apps.html
_qdnBase                   = /render/APP/iffi_vaba_mees
Remaining path             = /qdn-apps/q-apps.html
Matched route              = NONE → <Routes> renders nothing
```

**Logo click** (`navigate('/')`):
```
Navigates to               = /render/APP/iffi_vaba_mees/
Remaining path             = /
Matched route              = path="/" → <HomePage /> mounts → useVideos runs
```

## 3. Root Cause

Missing catch-all wildcard route `<Route path="*" element={<Navigate to="/" replace />} />`. The Discussion-Boards reference implementation (`projects/Discssion-Boards/src/App.tsx`) has this route. Video-Center did not.

Without a catch-all, any URL path that doesn't exactly match one of the five defined routes causes React Router to render nothing inside `<Routes>`. The `Layout` component (which wraps `<Routes>`) still renders, showing the header. But `HomePage` never mounts, `useVideos` never runs, and no videos appear.

## 4. Files Changed

**`src/App.tsx`** — Two changes:

1. Added `Navigate` to the react-router-dom import
2. Added `<Route path="*" element={<Navigate to="/" replace />} />` as the last route inside `<Routes>`

This matches the Discussion-Boards canonical reference pattern exactly.

## 5. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 249 KB JS, 20 KB CSS)
```

## 6. Fresh-Open Result

⏳ Awaiting verification inside Qortium Home.

**Expected behavior**: On fresh open, the catch-all route redirects to `/`, `HomePage` mounts, `useVideos` runs, diagnostics banner shows lifecycle info, valid video card appears.

## 7. Refresh Result

⏳ Awaiting verification.

**Expected**: Same as fresh open — redirect to `/`, HomePage mounts, videos load.

## 8. Acceptance Criteria

| # | Test | Expected |
|---|---|---|
| 1 | Fresh open → no logo click | HomePage mounts, videos load automatically |
| 2 | Refresh → no logo click | Same |
| 3 | Logo click | Still works |
| 4 | Search | Still works |
| 5 | Old broken resource diagnostic | Visible, does not block valid video |
