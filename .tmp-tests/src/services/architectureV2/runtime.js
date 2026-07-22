// Video Center — Architecture V2 runtime record handling
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/runtime.ts
import { applyOwnerEdit, reduceV2Creates } from './reducer.js';
import { validateMetadata } from './validation.js';
export const isV2CreateRuntimeRecord = (record) => record.envelope.kind === 'entity-create';
export const isV2OwnerEditRuntimeRecord = (record) => record.envelope.kind === 'operation';
export const toV2RuntimeRecord = (metadata, envelope) => envelope.kind === 'entity-create' ? { metadata, envelope } : { metadata, envelope };
// ── Envelope builders ──────────────────────────────────────
export const V2_IDENTIFIER_PREFIX = 'qvc-v2-';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isEntityType = (value) => value === 'video' || value === 'comment' || value === 'follow';
export const buildV2Envelope = (body, recordId, clientCreatedAt = new Date().toISOString()) => ({
    schema: 'qvc-v2',
    schemaVersion: 2,
    kind: 'entity-create',
    recordType: body.entityType,
    recordId,
    targetId: body.entityId,
    body,
    clientCreatedAt,
});
export const buildV2OwnerEditEnvelope = (edit, operationId, clientCreatedAt = new Date().toISOString()) => ({
    schema: 'qvc-v2',
    schemaVersion: 2,
    kind: 'operation',
    recordType: 'owner-edit',
    recordId: operationId,
    targetId: edit.targetId,
    body: edit,
    clientCreatedAt,
});
// ── Envelope detection ─────────────────────────────────────
export const isV2EntityEnvelope = (value) => {
    if (!isRecord(value))
        return false;
    const candidate = value;
    const body = candidate.body;
    if (candidate.schema !== 'qvc-v2' ||
        candidate.schemaVersion !== 2 ||
        typeof candidate.recordType !== 'string' ||
        typeof candidate.recordId !== 'string' ||
        typeof candidate.targetId !== 'string' ||
        !isRecord(body)) {
        return false;
    }
    if (candidate.kind === 'entity-create') {
        if (!isEntityType(body.entityType) ||
            body.entityType !== candidate.recordType ||
            body.entityId !== candidate.targetId ||
            typeof body.publisherName !== 'string' ||
            typeof body.walletAddress !== 'string') {
            return false;
        }
        if (body.entityType === 'video') {
            return (typeof body.title === 'string' &&
                typeof body.description === 'string' &&
                typeof body.category === 'string' &&
                Array.isArray(body.tags) &&
                isRecord(body.mediaReference) &&
                isRecord(body.thumbnailReference));
        }
        if (body.entityType === 'comment') {
            return typeof body.parentVideoId === 'string' && typeof body.body === 'string';
        }
        if (body.entityType === 'follow') {
            return typeof body.targetName === 'string';
        }
        return false;
    }
    if (candidate.kind === 'operation') {
        return (candidate.recordType === 'owner-edit' &&
            body.operation === 'owner-edit' &&
            body.targetId === candidate.targetId &&
            isEntityType(body.targetType) &&
            typeof body.publisherName === 'string' &&
            typeof body.walletAddress === 'string' &&
            isRecord(body.fields));
    }
    return false;
};
// ── Runtime reducer ────────────────────────────────────────
export const reduceV2RuntimeRecords = (records, identity) => {
    const diagnostics = [];
    const creates = [];
    const edits = [];
    for (const record of records) {
        const metaCheck = validateMetadata(record.metadata);
        if (metaCheck.ok === false) {
            diagnostics.push({
                code: metaCheck.code,
                identifier: record.metadata.identifier,
                detail: metaCheck.detail,
            });
            continue;
        }
        if (record.envelope.kind === 'entity-create') {
            creates.push({ metadata: record.metadata, envelope: record.envelope });
        }
        else if (record.envelope.kind === 'operation' &&
            record.envelope.recordType === 'owner-edit') {
            edits.push({
                metadata: record.metadata,
                edit: record.envelope.body,
            });
        }
    }
    let state = reduceV2Creates(creates, identity);
    const sortedEdits = [...edits].sort((a, b) => `${a.metadata.created.toString().padStart(16, '0')}:${a.metadata.latestSignature ?? ''}`.localeCompare(`${b.metadata.created.toString().padStart(16, '0')}:${b.metadata.latestSignature ?? ''}`));
    for (const { metadata, edit } of sortedEdits) {
        state = applyOwnerEdit(state, metadata, edit, identity);
    }
    return {
        authoritative: state,
        diagnostics: [
            ...diagnostics,
            ...state.quarantined.map((q) => ({
                code: q.code,
                identifier: q.recordId,
                detail: q.detail,
            })),
        ],
        discovery: {
            completeness: 'complete',
            pagesFetched: 1,
            resourcesSeen: records.length,
            stoppedReason: 'exhausted',
            source: 'provided-record-set',
        },
    };
};
