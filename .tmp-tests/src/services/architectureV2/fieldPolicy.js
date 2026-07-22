// Video Center — Architecture V2 field policies
// Schema: qvc-v2
// Canonical reference: Discussion-Boards/src/services/architectureV2/fieldPolicy.ts
// ── Attachment reference validation ────────────────────────
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isV2AttachmentReference = (value) => {
    if (!isRecord(value))
        return false;
    return (typeof value.id === 'string' &&
        typeof value.service === 'string' &&
        typeof value.name === 'string' &&
        typeof value.identifier === 'string' &&
        typeof value.filename === 'string' &&
        typeof value.mimeType === 'string' &&
        typeof value.size === 'number');
};
export const isV2AttachmentReferenceList = (value) => {
    if (!Array.isArray(value))
        return false;
    return value.every(isV2AttachmentReference);
};
// ── QDN resource reference validation ──────────────────────
export const isQdnResourceRef = (value) => {
    if (!isRecord(value))
        return false;
    return (typeof value.service === 'string' &&
        typeof value.name === 'string' &&
        typeof value.identifier === 'string');
};
export const validateOwnerEditFields = (edit) => {
    if (edit.operation !== 'owner-edit') {
        return { ok: false, code: 'MALFORMED_ENVELOPE', detail: 'not an owner-edit operation' };
    }
    const allowedFields = edit.targetType === 'video'
        ? new Set(['title', 'description', 'category', 'tags', 'language'])
        : edit.targetType === 'comment'
            ? new Set(['body'])
            : new Set();
    for (const key of Object.keys(edit.fields)) {
        if (!allowedFields.has(key)) {
            return {
                ok: false,
                code: 'MALFORMED_ENVELOPE',
                detail: `owner edit disallowed field: ${key} for ${edit.targetType}`,
            };
        }
    }
    return { ok: true };
};
