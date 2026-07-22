// Video Center — Architecture V2 validation
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/validation.ts

import type {
  QvcV2Envelope,
  QvcV2ResourceMetadata,
  RejectionCode,
  V2EntityCreate,
} from './types.js';

export type ValidationResult = { ok: true } | { ok: false; code: RejectionCode; detail: string };

// ── Identity Validator ─────────────────────────────────────
// Validates that the QDN publisher matches the claimed identity.
// This is the core security mechanism that prevents impersonation.

export type IdentityValidator = {
  validatePublisher: (
    metadata: QvcV2ResourceMetadata,
    claimedPublisher: string,
  ) => ValidationResult;
  validateWalletBinding: (publisherName: string, walletAddress: string) => ValidationResult;
};

export const normalizeName = (name: string) => name.trim().toLowerCase();

// ── Metadata validation ────────────────────────────────────

export const validateMetadata = (metadata: QvcV2ResourceMetadata): ValidationResult => {
  if (!metadata.service || !metadata.publisherName || !metadata.identifier) {
    return {
      ok: false,
      code: 'INVALID_METADATA',
      detail: 'missing trusted resource metadata',
    };
  }
  if (
    !Number.isSafeInteger(metadata.created) ||
    (metadata.updated !== null &&
      (!Number.isSafeInteger(metadata.updated) || metadata.created > metadata.updated))
  ) {
    return {
      ok: false,
      code: 'INVALID_METADATA',
      detail: 'invalid Core ordering metadata',
    };
  }
  return { ok: true };
};

// ── Envelope validation ────────────────────────────────────

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const validateEnvelope = <T>(envelope: QvcV2Envelope<T>): ValidationResult => {
  if (
    envelope.schema !== 'qvc-v2' ||
    envelope.schemaVersion !== 2 ||
    !envelope.recordId ||
    !envelope.targetId ||
    !envelope.recordType
  ) {
    return {
      ok: false,
      code: 'MALFORMED_ENVELOPE',
      detail: 'invalid qvc-v2 envelope',
    };
  }
  return { ok: true };
};

// ── Entity create validation ───────────────────────────────

const isEntityType = (value: unknown): value is V2EntityCreate['entityType'] =>
  value === 'video' || value === 'comment' || value === 'follow';

export const validateEntityCreate = (
  metadata: QvcV2ResourceMetadata,
  envelope: QvcV2Envelope<V2EntityCreate>,
  identity: IdentityValidator,
): ValidationResult => {
  const checks = [validateMetadata(metadata), validateEnvelope(envelope)];
  const failed = checks.find((check) => !check.ok);
  if (failed && !failed.ok) return failed;

  if (
    envelope.kind !== 'entity-create' ||
    envelope.targetId !== envelope.body.entityId ||
    envelope.body.entityType !== envelope.recordType
  ) {
    return {
      ok: false,
      code: 'MALFORMED_ENVELOPE',
      detail: 'entity envelope target mismatch',
    };
  }

  if (!isEntityType(envelope.body.entityType)) {
    return {
      ok: false,
      code: 'UNKNOWN_ENTITY_TYPE',
      detail: `unknown entity type: ${String(envelope.body.entityType)}`,
    };
  }

  const publisher = identity.validatePublisher(metadata, envelope.body.publisherName);
  if (!publisher.ok) return publisher;

  return identity.validateWalletBinding(envelope.body.publisherName, envelope.body.walletAddress);
};

// ── Reaction validation ────────────────────────────────────

export const isReactionEnvelope = (
  value: unknown,
): value is QvcV2Envelope<{
  operation: string;
  targetType: string;
  targetId: string;
  reaction: string;
  state: string;
  publisherName: string;
  walletAddress: string;
}> => {
  if (!isRecord(value) || !isRecord(value.body)) return false;
  const body = value.body;
  return (
    hasOnlyKeys(value, [
      'schema',
      'schemaVersion',
      'kind',
      'recordType',
      'recordId',
      'targetId',
      'body',
      'clientCreatedAt',
    ]) &&
    hasOnlyKeys(body, [
      'operation',
      'targetType',
      'targetId',
      'reaction',
      'state',
      'publisherName',
      'walletAddress',
    ]) &&
    value.schema === 'qvc-v2' &&
    value.schemaVersion === 2 &&
    value.kind === 'operation' &&
    value.recordType === 'reaction' &&
    typeof value.recordId === 'string' &&
    value.recordId.trim().length > 0 &&
    typeof value.targetId === 'string' &&
    value.targetId.trim().length > 0 &&
    body.operation === 'reaction' &&
    (body.targetType === 'video' || body.targetType === 'comment') &&
    typeof body.targetId === 'string' &&
    body.targetId === value.targetId &&
    body.reaction === 'like' &&
    (body.state === 'active' || body.state === 'inactive') &&
    typeof body.publisherName === 'string' &&
    body.publisherName.trim().length > 0 &&
    typeof body.walletAddress === 'string' &&
    body.walletAddress.trim().length > 0
  );
};
