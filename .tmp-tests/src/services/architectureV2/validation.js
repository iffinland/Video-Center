// Video Center — Architecture V2 validation
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/validation.ts
export const normalizeName = (name) => name.trim().toLowerCase();
// ── Metadata validation ────────────────────────────────────
export const validateMetadata = (metadata) => {
    if (!metadata.service || !metadata.publisherName || !metadata.identifier) {
        return {
            ok: false,
            code: 'INVALID_METADATA',
            detail: 'missing trusted resource metadata',
        };
    }
    if (!Number.isSafeInteger(metadata.created) ||
        (metadata.updated !== null &&
            (!Number.isSafeInteger(metadata.updated) || metadata.created > metadata.updated))) {
        return {
            ok: false,
            code: 'INVALID_METADATA',
            detail: 'invalid Core ordering metadata',
        };
    }
    return { ok: true };
};
// ── Envelope validation ────────────────────────────────────
const hasOnlyKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const validateEnvelope = (envelope) => {
    if (envelope.schema !== 'qvc-v2' ||
        envelope.schemaVersion !== 2 ||
        !envelope.recordId ||
        !envelope.targetId ||
        !envelope.recordType) {
        return {
            ok: false,
            code: 'MALFORMED_ENVELOPE',
            detail: 'invalid qvc-v2 envelope',
        };
    }
    return { ok: true };
};
// ── Entity create validation ───────────────────────────────
const isEntityType = (value) => value === 'video' || value === 'comment' || value === 'follow';
export const validateEntityCreate = (metadata, envelope, identity) => {
    const checks = [validateMetadata(metadata), validateEnvelope(envelope)];
    const failed = checks.find((check) => !check.ok);
    if (failed && !failed.ok)
        return failed;
    if (envelope.kind !== 'entity-create' ||
        envelope.targetId !== envelope.body.entityId ||
        envelope.body.entityType !== envelope.recordType) {
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
    if (!publisher.ok)
        return publisher;
    return identity.validateWalletBinding(envelope.body.publisherName, envelope.body.walletAddress);
};
// ── Reaction validation ────────────────────────────────────
export const isReactionEnvelope = (value) => {
    if (!isRecord(value) || !isRecord(value.body))
        return false;
    const body = value.body;
    return (hasOnlyKeys(value, [
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
        body.walletAddress.trim().length > 0);
};
