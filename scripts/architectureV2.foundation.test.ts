// Video Center — Architecture V2 foundation tests
// Schema: qvc-v2

import { emptyV2State } from '../src/services/architectureV2/reducer.js';
import {
  buildV2Envelope,
  buildV2OwnerEditEnvelope,
  reduceV2RuntimeRecords,
} from '../src/services/architectureV2/runtime.js';
import { validateMetadata, validateEnvelope } from '../src/services/architectureV2/validation.js';
import type { IdentityValidator } from '../src/services/architectureV2/validation.js';
import type {
  VideoCreate,
  CommentCreate,
  FollowCreate,
} from '../src/services/architectureV2/types.js';

const assert = {
  equal: (a: unknown, b: unknown) => {
    if (a !== b) throw new Error(`expected ${String(b)}, got ${String(a)}`);
  },
  deepEqual: (a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('values differ');
  },
  ok: (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  },
};

const identity: IdentityValidator = {
  validatePublisher: (metadata, claimed) =>
    metadata.publisherName.toLowerCase() === claimed.toLowerCase()
      ? { ok: true }
      : { ok: false, code: 'UNAUTHORIZED_PUBLISHER', detail: 'publisher mismatch' },
  validateWalletBinding: (_name, wallet) =>
    wallet
      ? { ok: true }
      : { ok: false, code: 'WALLET_BINDING_MISMATCH', detail: 'wallet unavailable' },
};

const metadata = (id: string, publisher = 'alice', created = 1) => ({
  service: 'DOCUMENT',
  publisherName: publisher,
  identifier: id,
  created,
  updated: created,
  latestSignature: `sig-${created}`,
});

// ── 1. Video entity creation ──────────────────────────────
const videoCreate: VideoCreate = {
  entityType: 'video',
  entityId: 'qvc-v2-video-abc12345',
  publisherName: 'alice',
  walletAddress: 'Qwallet',
  title: 'Test Video',
  description: 'A test video',
  category: 'Education',
  tags: ['test', 'demo'],
  mediaReference: { service: 'VIDEO', name: 'alice', identifier: 'media-1' },
  thumbnailReference: { service: 'IMAGE', name: 'alice', identifier: 'thumb-1' },
};

const videoEnvelope = buildV2Envelope(videoCreate, videoCreate.entityId);
assert.equal(videoEnvelope.schema, 'qvc-v2');
assert.equal(videoEnvelope.kind, 'entity-create');
assert.equal(videoEnvelope.recordType, 'video');
assert.equal(videoEnvelope.targetId, videoCreate.entityId);

const videoRecords = [
  { metadata: metadata(videoCreate.entityId, 'alice', 1), envelope: videoEnvelope },
];
const videoState = reduceV2RuntimeRecords(videoRecords, identity);
assert.equal(Object.keys(videoState.authoritative.entities).length, 1);
assert.equal(videoState.authoritative.entities['qvc-v2-video-abc12345']?.entityType, 'video');
assert.equal(
  (videoState.authoritative.entities['qvc-v2-video-abc12345'] as VideoCreate)?.title,
  'Test Video',
);

// ── 2. Comment entity creation ────────────────────────────
const commentCreate: CommentCreate = {
  entityType: 'comment',
  entityId: 'qvc-v2-comment-vid-xyz789',
  publisherName: 'bob',
  walletAddress: 'QwalletB',
  parentVideoId: 'qvc-v2-video-abc12345',
  body: 'Great video!',
};

const commentEnvelope = buildV2Envelope(commentCreate, commentCreate.entityId);
const commentRecords = [
  { metadata: metadata(commentCreate.entityId, 'bob', 2), envelope: commentEnvelope },
];
const commentState = reduceV2RuntimeRecords(commentRecords, identity);
assert.equal(Object.keys(commentState.authoritative.entities).length, 1);

// ── 3. Follow entity creation ─────────────────────────────
const followCreate: FollowCreate = {
  entityType: 'follow',
  entityId: 'qvc-v2-follow-alice-bob',
  publisherName: 'alice',
  walletAddress: 'Qwallet',
  targetName: 'bob',
};

const followEnvelope = buildV2Envelope(followCreate, followCreate.entityId);
const followRecords = [
  { metadata: metadata(followCreate.entityId, 'alice', 3), envelope: followEnvelope },
];
const followState = reduceV2RuntimeRecords(followRecords, identity);
assert.equal(Object.keys(followState.authoritative.entities).length, 1);

// ── 4. Deterministic ordering ────────────────────────────
const multiRecords = [
  { metadata: metadata(videoCreate.entityId, 'alice', 3), envelope: videoEnvelope },
  { metadata: metadata(commentCreate.entityId, 'bob', 1), envelope: commentEnvelope },
  { metadata: metadata(followCreate.entityId, 'alice', 2), envelope: followEnvelope },
];
const forward = reduceV2RuntimeRecords(multiRecords, identity);
const reverse = reduceV2RuntimeRecords([...multiRecords].reverse(), identity);
assert.deepEqual(forward.authoritative.entities, reverse.authoritative.entities);
console.log('  ✓ deterministic ordering: same result regardless of input order');

// ── 5. Unauthorized publisher rejected ────────────────────
const forgedVideo: VideoCreate = { ...videoCreate, publisherName: 'mallory' };
const forgedEnvelope = buildV2Envelope(forgedVideo, forgedVideo.entityId);
const forgedRecords = [
  { metadata: metadata(forgedVideo.entityId, 'alice', 1), envelope: forgedEnvelope },
];
const forgedState = reduceV2RuntimeRecords(forgedRecords, identity);
assert.ok(
  forgedState.authoritative.entities['qvc-v2-video-abc12345'] === undefined,
  'forged publisher rejected',
);
assert.ok(forgedState.diagnostics.length > 0, 'forged publisher generated diagnostics');

// ── 6. Owner edit ─────────────────────────────────────────
const ownerEdit = buildV2OwnerEditEnvelope(
  {
    operation: 'owner-edit',
    targetType: 'video',
    targetId: videoCreate.entityId,
    publisherName: 'alice',
    walletAddress: 'Qwallet',
    fields: { title: 'Updated Title' },
  },
  'edit-video-1',
);
assert.equal(ownerEdit.kind, 'operation');
assert.equal(ownerEdit.recordType, 'owner-edit');

const editedRecords = [
  { metadata: metadata(videoCreate.entityId, 'alice', 1), envelope: videoEnvelope },
  { metadata: metadata(ownerEdit.recordId, 'alice', 4), envelope: ownerEdit },
];
const editedState = reduceV2RuntimeRecords(editedRecords, identity);
assert.equal(
  (editedState.authoritative.entities[videoCreate.entityId] as VideoCreate)?.title,
  'Updated Title',
);

// ── 7. Unauthorized owner edit rejected ───────────────────
const badEdit = buildV2OwnerEditEnvelope(
  {
    operation: 'owner-edit',
    targetType: 'video',
    targetId: videoCreate.entityId,
    publisherName: 'mallory',
    walletAddress: 'Qwallet',
    fields: { title: 'Hacked' },
  },
  'edit-bad',
);
const badEditRecords = [
  { metadata: metadata(videoCreate.entityId, 'alice', 1), envelope: videoEnvelope },
  { metadata: metadata(badEdit.recordId, 'mallory', 4), envelope: badEdit },
];
const badEditState = reduceV2RuntimeRecords(badEditRecords, identity);
assert.equal(
  (badEditState.authoritative.entities[videoCreate.entityId] as VideoCreate)?.title,
  'Test Video',
);
assert.ok(badEditState.diagnostics.length > 0, 'unauthorized edit generated diagnostics');

// ── 8. Validation functions ───────────────────────────────
const metaCheck = validateMetadata(metadata('test', 'alice', 1));
assert.equal(metaCheck.ok, true);

const badMeta = validateMetadata({
  service: '',
  publisherName: '',
  identifier: '',
  created: NaN,
  updated: null,
});
assert.equal(badMeta.ok, false);

const envCheck = validateEnvelope(videoEnvelope);
assert.equal(envCheck.ok, true);

// ── 9. Empty state ────────────────────────────────────────
const empty = emptyV2State();
assert.equal(Object.keys(empty.entities).length, 0);
assert.equal(empty.quarantined.length, 0);

// ── 10. Duplicate conflict ────────────────────────────────
const dupCreate: VideoCreate = { ...videoCreate, description: 'Different description' };
const dupEnvelope = buildV2Envelope(dupCreate, dupCreate.entityId);
const dupRecords = [
  { metadata: metadata(videoCreate.entityId, 'alice', 1), envelope: videoEnvelope },
  { metadata: metadata(videoCreate.entityId, 'bob', 5), envelope: dupEnvelope },
];
const dupState = reduceV2RuntimeRecords(dupRecords, identity);
assert.ok(
  dupState.diagnostics.some((d) => d.code === 'UNAUTHORIZED_PUBLISHER'),
  'duplicate with different publisher quarantined',
);

console.log('\n✅ Architecture V2 foundation tests PASSED\n');
