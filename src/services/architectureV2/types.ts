// Video Center — Architecture V2 types
// Schema: qvc-v2 (Qortium Video Center V2)
// Canonical reference: Discussion-Boards/src/services/architectureV2/types.ts

import type { QdnResourceRef } from '../../types/video.js';

// ── Core V2 envelope types ─────────────────────────────────

export type V2EntityType = 'video' | 'comment' | 'follow';

export type QvcV2ResourceMetadata = {
  service: string;
  publisherName: string;
  identifier: string;
  created: number;
  updated: number | null;
  latestSignature?: string;
};

export type QvcV2Envelope<TBody> = {
  schema: 'qvc-v2';
  schemaVersion: 2;
  kind: 'entity-create' | 'operation';
  recordType: string;
  recordId: string;
  targetId: string;
  body: TBody;
  clientCreatedAt?: string;
};

export type QvcV2CreateEnvelope<TBody> = Omit<QvcV2Envelope<TBody>, 'kind'> & {
  kind: 'entity-create';
};

export type QvcV2OperationEnvelope<TBody> = Omit<QvcV2Envelope<TBody>, 'kind'> & {
  kind: 'operation';
};

// ── Identity ───────────────────────────────────────────────

export type V2Identity = {
  publisherName: string;
  walletAddress: string;
};

// ── Entity creates ─────────────────────────────────────────

export type VideoCreate = V2Identity & {
  entityType: 'video';
  entityId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  mediaReference: QdnResourceRef;
  thumbnailReference: QdnResourceRef;
  durationSeconds?: number;
  language?: string;
};

export type CommentCreate = V2Identity & {
  entityType: 'comment';
  entityId: string;
  parentVideoId: string;
  body: string;
};

export type FollowCreate = V2Identity & {
  entityType: 'follow';
  entityId: string;
  targetName: string;
};

export type V2EntityCreate = VideoCreate | CommentCreate | FollowCreate;

// ── Owner edit operations ──────────────────────────────────

export type OwnerEdit = {
  operation: 'owner-edit';
  targetId: string;
  targetType: V2EntityType;
  publisherName: string;
  walletAddress: string;
  fields: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
    body: string;
    language: string;
  }>;
};

export type V2OwnerEditEnvelope = QvcV2OperationEnvelope<OwnerEdit>;

// ── Reaction operations ────────────────────────────────────

export type ReactionState = 'active' | 'inactive';

export type ReactionBody = {
  operation: 'reaction';
  targetType: 'video' | 'comment';
  targetId: string;
  reaction: 'like';
  state: ReactionState;
  publisherName: string;
  walletAddress: string;
};

export type ReactionEnvelope = QvcV2OperationEnvelope<ReactionBody>;

// ── Tip reference operations ───────────────────────────────

export type TipReferenceBody = {
  operation: 'tip-reference';
  targetType: 'video';
  targetId: string;
  publisherName: string;
  walletAddress: string;
  recipientName: string;
  amount: number;
  transactionSignature: string;
};

export type TipReferenceEnvelope = QvcV2OperationEnvelope<TipReferenceBody>;

// ── Moderation operations ──────────────────────────────────

export type ModerationAction = 'hide' | 'unhide' | 'delete';

export type ModerationBody = {
  operation: 'moderate';
  targetType: 'video' | 'comment';
  targetId: string;
  action: ModerationAction;
  publisherName: string;
  walletAddress: string;
  reason?: string;
};

export type ModerationEnvelope = QvcV2OperationEnvelope<ModerationBody>;

// ── Quarantine / validation codes ──────────────────────────

export type RejectionCode =
  | 'MALFORMED_ENVELOPE'
  | 'INVALID_METADATA'
  | 'UNAUTHORIZED_PUBLISHER'
  | 'WALLET_BINDING_MISMATCH'
  | 'DUPLICATE_CONFLICT'
  | 'UNKNOWN_ENTITY_TYPE';

export type QuarantineRecord = {
  code: RejectionCode;
  recordId: string;
  detail: string;
};

// ── State ──────────────────────────────────────────────────

export type V2State = {
  entities: Record<string, V2EntityCreate>;
  quarantined: QuarantineRecord[];
};
