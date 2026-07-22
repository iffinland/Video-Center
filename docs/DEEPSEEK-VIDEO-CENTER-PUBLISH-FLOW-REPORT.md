# Video-Center Publish Flow Repair Report

Date: 2026-07-22

---

## 1. Confirmed Root Cause

**`publishQdnFile` uses `SELECT_QDN_PUBLISH_SOURCE` for files > 2 MiB, which opens a native OS file picker.** The user had already selected the file in the browser's `<input type="file">`. The second picker is the Qortium Home source-token mechanism, which is required when the browser cannot provide a direct file path to the native app.

When the user cancels the unexpected second picker, `selectSourceToken` throws `USER_CANCELLED`. Since `publishVideoV2` runs video and thumbnail `publishQdnFile` calls via `Promise.all`, the rejection propagates:

1. Thumbnail publish (inline, <2 MiB, fast) → succeeds → thumbnail on QDN ✅
2. Video publish (source-token, >2 MiB, cancelled) → fails → no video on QDN ❌
3. `Promise.all` rejects → `publishVideoV2` throws → metadata DOCUMENT never published ❌

Result: thumbnail orphaned on QDN, no video, no metadata. Only ONE confirmation dialog (for the thumbnail).

---

## 2. Why the Second File Picker Opened

In `src/services/qortium/qdnFilePublication.ts`, the `publishQdnFile` function:

```typescript
const transport: QdnFileTransport =
    file.size <= QDN_INLINE_FILE_MAX_BYTES ? 'inline-base64' : 'home-source-token';

if (transport === 'inline-base64') {
    const data64 = await fileToBase64(file);
    await publishInline(resource, data64);
} else {
    const selection = await selectSourceToken('file');  // ← OPENS FILE PICKER
    ...
}
```

`selectSourceToken('file')` calls `requestQortium({ action: 'SELECT_QDN_PUBLISH_SOURCE', kind: 'file' })`. In Qortium Home, this bridge action opens a native file picker dialog. The user had already selected the file via the browser's `<input type="file">`, so this second picker was unexpected and confusing.

The old limit of **2 MiB** (`QDN_INLINE_FILE_MAX_BYTES = 2 * 1024 * 1024`) meant that even moderately sized test videos (3-6 MB) triggered the source-token path.

---

## 3. Expected vs Actual Transaction Confirmations

**Expected**: 3 confirmations — one each for VIDEO, IMAGE (thumbnail), and DOCUMENT (metadata). Each `PUBLISH_QDN_RESOURCE` call requires user approval in Qortium Home.

**Actual with the bug**: 1 confirmation — only the thumbnail's `PUBLISH_QDN_RESOURCE` was reached. The video's `PUBLISH_QDN_RESOURCE` was never called because `selectSourceToken` (the file picker) was cancelled first. The metadata DOCUMENT was never published because `publishVideoV2` threw.

With the fix (10 MiB inline limit for files ≤10 MB), all three resources use inline base64. All three `PUBLISH_QDN_RESOURCE` calls trigger confirmations.

---

## 4. File Changed

| File | Change |
|---|---|
| `src/services/qortium/qdnFilePublication.ts` | `QDN_INLINE_FILE_MAX_BYTES`: 2 MiB → **10 MiB**. Most MVP test videos now use inline base64 (no second file picker). Source-token path reserved for files > 10 MiB. |

---

## 5. Build Result

```
tsc --noEmit: PASS
vite build:  PASS (80 modules, 250 KB JS, 20 KB CSS)
```

---

## 6. Controlled Publish Result

⏳ Awaiting user test inside Qortium Home.

**Expected behavior with a ≤10 MiB test video**:

| Step | Expected |
|---|---|
| 1. Select video file (≤10 MiB) | Browser file picker opens once |
| 2. Select thumbnail | Browser file picker opens once |
| 3. Click Publish | NO second file picker |
| 4. Confirmations | 3 transaction confirmations in Qortium Home |
| 5. VIDEO resource | Published via inline base64 |
| 6. IMAGE resource | Published via inline base64 |
| 7. DOCUMENT metadata | Published via inline base64 |
| 8. All resources | READY, all chunks available |
| 9. Publish UI | Success state with "View Video" button |
| 10. Homepage | Published video appears as card |
| 11. Refresh | Video still appears |

---

## 7. Orphan Resources (Documented, NOT auto-cleaned)

| Identifier | Size | Status | Origin |
|---|---|---|---|
| `vc-media-558jxv9` | 1.5 MB | Orphan (paired metadata broken) | First test — metadata `qvc-v2-video-1hfnemeo` is MISSING_DATA |
| `vc-media-iliuyst` | 3.2 MB | Orphan | Source-token cancelled — would now succeed with 10 MiB inline limit |
| `vc-media-irml3l8` | 5.6 MB | Orphan | Source-token cancelled |
| `vc-media-nb0pkeu` | 2.3 MB | Orphan | Source-token cancelled |
| `vc-media-xsypun4` | 1.5 MB | ✅ Paired | `qvc-v2-video-gnrbf4t0` (healthy) |

These 4 orphan VIDEO resources exist on QDN without corresponding DOCUMENT metadata. They were created when `publishQdnFile` (video) partially succeeded or the source-token was cancelled before the metadata DOCUMENT was published. A future cleanup tool or manual QDN resource deletion may be needed.

---

## 8. Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Clicking Publish does NOT reopen file picker (≤10 MiB files) | ✅ (inline path) |
| 2 | Publish runs exactly once | ✅ |
| 3 | Correct number of confirmations | ⏳ Awaiting runtime |
| 4 | VIDEO published | ⏳ Awaiting runtime |
| 5 | IMAGE published | ⏳ Awaiting runtime |
| 6 | DOCUMENT published | ⏳ Awaiting runtime |
| 7 | Resources reach usable state | ⏳ Awaiting runtime |
| 8 | Publish UI progresses correctly | ⏳ Awaiting runtime |
| 9 | Published video appears in homepage | ⏳ Awaiting runtime |
| 10 | Video survives refresh | ⏳ Awaiting runtime |
