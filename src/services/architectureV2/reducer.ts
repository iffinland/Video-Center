// Video Center — Architecture V2 deterministic reducer
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/reducer.ts

import type {
  OwnerEdit,
  QvcV2Envelope,
  QvcV2ResourceMetadata,
  QuarantineRecord,
  V2EntityCreate,
  V2State,
} from './types.js';
import { validateEntityCreate } from './validation.js';
import type { IdentityValidator } from './validation.js';
import { validateOwnerEditFields } from './fieldPolicy.js';

export type { V2State };

// ── State helpers ──────────────────────────────────────────

export const emptyV2State = (): V2State => ({
  entities: {},
  quarantined: [],
});

const order = (metadata: QvcV2ResourceMetadata) =>
  `${metadata.created.toString().padStart(16, '0')}:${metadata.latestSignature ?? ''}:${metadata.identifier}`;

const reject = (
  state: V2State,
  code: QuarantineRecord['code'],
  id: string,
  detail: string,
): V2State => ({
  ...state,
  quarantined: [...state.quarantined, { code, recordId: id, detail }],
});

// ── Entity comparison ──────────────────────────────────────

const sameEntityCreate = (left: V2EntityCreate, right: V2EntityCreate): boolean => {
  if (
    left.entityType !== right.entityType ||
    left.entityId !== right.entityId ||
    left.publisherName !== right.publisherName ||
    left.walletAddress !== right.walletAddress
  ) {
    return false;
  }

  if (left.entityType === 'video' && right.entityType === 'video') {
    return (
      left.title === right.title &&
      left.description === right.description &&
      left.category === right.category &&
      arraysEqual(left.tags, right.tags) &&
      left.mediaReference.identifier === right.mediaReference.identifier &&
      left.thumbnailReference.identifier === right.thumbnailReference.identifier &&
      left.durationSeconds === right.durationSeconds &&
      left.language === right.language
    );
  }

  if (left.entityType === 'comment' && right.entityType === 'comment') {
    return left.parentVideoId === right.parentVideoId && left.body === right.body;
  }

  if (left.entityType === 'follow' && right.entityType === 'follow') {
    return left.targetName === right.targetName;
  }

  return false;
};

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
};

// ── Core reducer ───────────────────────────────────────────

export const reduceV2Creates = (
  records: Array<{
    metadata: QvcV2ResourceMetadata;
    envelope: QvcV2Envelope<V2EntityCreate>;
  }>,
  identity: IdentityValidator,
): V2State => {
  let state = emptyV2State();

  // Deterministic ordering: Core metadata (created timestamp + signature)
  const sorted = [...records].sort((a, b) => order(a.metadata).localeCompare(order(b.metadata)));

  for (const record of sorted) {
    const valid = validateEntityCreate(record.metadata, record.envelope, identity);

    if (valid.ok === false) {
      state = reject(state, valid.code, record.envelope.recordId, valid.detail);
      continue;
    }

    const id = record.envelope.body.entityId;
    const existing = state.entities[id];

    if (existing && !sameEntityCreate(existing, record.envelope.body)) {
      state = reject(state, 'DUPLICATE_CONFLICT', id, 'conflicting V2 creation');
      continue;
    }

    if (!existing) {
      state = {
        ...state,
        entities: { ...state.entities, [id]: record.envelope.body },
      };
    }
  }

  return state;
};

// ── Owner edit application ─────────────────────────────────

export const applyOwnerEdit = (
  state: V2State,
  metadata: QvcV2ResourceMetadata,
  edit: OwnerEdit,
  identity: IdentityValidator,
): V2State => {
  const entity = state.entities[edit.targetId];

  if (!entity) {
    return reject(
      state,
      'UNAUTHORIZED_PUBLISHER',
      edit.targetId,
      'target entity is not authoritative',
    );
  }

  if (entity.entityType !== edit.targetType) {
    return reject(state, 'MALFORMED_ENVELOPE', edit.targetId, 'owner edit target type mismatch');
  }

  const publisher = identity.validatePublisher(metadata, entity.publisherName);
  if (publisher.ok === false) {
    return reject(state, publisher.code, edit.targetId, publisher.detail);
  }

  const wallet = identity.validateWalletBinding(edit.publisherName, edit.walletAddress);
  if (wallet.ok === false) {
    return reject(state, wallet.code, edit.targetId, wallet.detail);
  }

  const fieldCheck = validateOwnerEditFields(edit);
  if (fieldCheck.ok === false) {
    return reject(state, fieldCheck.code, edit.targetId, fieldCheck.detail);
  }

  // Apply allowed field updates
  const updated = { ...entity, ...edit.fields };

  return {
    ...state,
    entities: { ...state.entities, [edit.targetId]: updated },
  };
};
