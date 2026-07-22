// Video Center — Architecture V2 reactions (likes)
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/reactions.ts

import type {
  QvcV2ResourceMetadata,
  RejectionCode,
  ReactionBody,
  ReactionEnvelope,
} from './types.js';
import type { IdentityValidator } from './validation.js';
import { normalizeName, validateMetadata } from './validation.js';

// ── Reaction record types ──────────────────────────────────

export type ReactionRecord = {
  metadata: QvcV2ResourceMetadata;
  envelope: ReactionEnvelope;
};

export type DiscoveredReactionResource = {
  name?: string;
  identifier?: string;
  service?: string;
  created?: number;
  updated?: number | null;
  latestSignature?: string;
};

// ── Reaction loader dependencies ───────────────────────────

export type ReactionLoaderDependencies = {
  fetchPayload: (resource: DiscoveredReactionResource) => Promise<unknown>;
  resolveWalletAddress: (publisherName: string) => Promise<string | null>;
  expectedIdentifier: (body: ReactionBody) => Promise<string>;
};

export type ReactionEnvelopePublisher = (envelope: ReactionEnvelope) => Promise<void>;

// ── Diagnostics ────────────────────────────────────────────

export type ReactionDiagnostic = {
  code:
    | RejectionCode
    | 'INVALID_REACTION_STATE'
    | 'TARGET_MISMATCH'
    | 'IDENTIFIER_MISMATCH'
    | 'MISSING_TRUSTED_METADATA'
    | 'UNAVAILABLE_RESOURCE';
  identifier: string;
  detail: string;
};

export type ReducedReactionState = {
  targetId: string;
  actors: Record<string, ReactionBody>;
  count: number;
  diagnostics: ReactionDiagnostic[];
};

// ── Envelope validation ────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

export const isReactionEnvelope = (value: unknown): value is ReactionEnvelope => {
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
    (value.clientCreatedAt === undefined || typeof value.clientCreatedAt === 'string') &&
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

// ── Identifier builders ────────────────────────────────────

const REACTION_IDENTIFIER_PREFIX = 'qvc-v2-react-';

export const buildReactionIdentifier = (targetId: string, actorName: string): string => {
  const normalizedActor = normalizeName(actorName).slice(0, 24);
  const targetPart = targetId.replace(/^qvc-/, '').slice(0, 40);
  return `${REACTION_IDENTIFIER_PREFIX}${targetPart}-${normalizedActor}`;
};

export const buildReactionTargetPrefix = (targetId: string): string => {
  const targetPart = targetId.replace(/^qvc-/, '').slice(0, 40);
  return `${REACTION_IDENTIFIER_PREFIX}${targetPart}-`;
};

// ── Reaction envelope builder ──────────────────────────────

export const buildReactionEnvelope = (
  targetId: string,
  targetType: 'video' | 'comment',
  actorName: string,
  walletAddress: string,
  state: 'active' | 'inactive' = 'active',
): ReactionEnvelope => {
  const recordId = buildReactionIdentifier(targetId, actorName);
  const body: ReactionBody = {
    operation: 'reaction',
    targetType,
    targetId,
    reaction: 'like',
    state,
    publisherName: actorName,
    walletAddress,
  };

  return {
    schema: 'qvc-v2',
    schemaVersion: 2,
    kind: 'operation',
    recordType: 'reaction',
    recordId,
    targetId,
    body,
    clientCreatedAt: new Date().toISOString(),
  };
};

// ── Reaction state reducer ─────────────────────────────────

export const reduceReactionRecords = (
  records: ReactionRecord[],
  identity: IdentityValidator,
): ReducedReactionState => {
  const diagnostics: ReactionDiagnostic[] = [];
  const actors: Record<string, ReactionBody> = {};
  let targetId = '';

  // Sort deterministically by created timestamp
  const sorted = [...records].sort(
    (a, b) =>
      a.metadata.created - b.metadata.created ||
      (a.metadata.latestSignature ?? '').localeCompare(b.metadata.latestSignature ?? ''),
  );

  for (const record of sorted) {
    const metaCheck = validateMetadata(record.metadata);
    if (metaCheck.ok === false) {
      diagnostics.push({
        code: metaCheck.code,
        identifier: record.metadata.identifier,
        detail: metaCheck.detail,
      });
      continue;
    }

    if (!isReactionEnvelope(record.envelope)) {
      diagnostics.push({
        code: 'MALFORMED_ENVELOPE',
        identifier: record.metadata.identifier,
        detail: 'not a valid reaction envelope',
      });
      continue;
    }

    const body = record.envelope.body;

    if (!targetId) {
      targetId = body.targetId;
    } else if (body.targetId !== targetId) {
      diagnostics.push({
        code: 'TARGET_MISMATCH',
        identifier: record.metadata.identifier,
        detail: `reaction target ${body.targetId} != expected ${targetId}`,
      });
      continue;
    }

    const publisherCheck = identity.validatePublisher(record.metadata, body.publisherName);
    if (publisherCheck.ok === false) {
      diagnostics.push({
        code: publisherCheck.code,
        identifier: record.metadata.identifier,
        detail: publisherCheck.detail,
      });
      continue;
    }

    const walletCheck = identity.validateWalletBinding(body.publisherName, body.walletAddress);
    if (walletCheck.ok === false) {
      diagnostics.push({
        code: walletCheck.code,
        identifier: record.metadata.identifier,
        detail: walletCheck.detail,
      });
      continue;
    }

    const actorKey = normalizeName(body.publisherName);

    if (body.state === 'inactive') {
      delete actors[actorKey];
    } else if (body.state === 'active') {
      actors[actorKey] = body;
    } else {
      diagnostics.push({
        code: 'INVALID_REACTION_STATE',
        identifier: record.metadata.identifier,
        detail: `unknown reaction state: ${body.state}`,
      });
    }
  }

  return {
    targetId,
    actors,
    count: Object.keys(actors).length,
    diagnostics,
  };
};

// ── Display helpers ────────────────────────────────────────

export const resolveReactionDisplay = (
  state: ReducedReactionState,
  currentUserName?: string,
): {
  count: number;
  hasReacted: boolean;
} => ({
  count: state.count,
  hasReacted: currentUserName ? normalizeName(currentUserName) in state.actors : false,
});

// ── Publication helpers ────────────────────────────────────

export const publishReactionEnvelope = async (
  envelope: ReactionEnvelope,
  publisher: ReactionEnvelopePublisher,
): Promise<void> => {
  await publisher(envelope);
};
