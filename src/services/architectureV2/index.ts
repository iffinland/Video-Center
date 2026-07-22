// Video Center — Architecture V2 barrel export
// Schema: qvc-v2

export * from './types.js';
export {
  validateMetadata,
  validateEnvelope,
  validateEntityCreate,
  normalizeName,
} from './validation.js';
export type { ValidationResult, IdentityValidator } from './validation.js';
export type { V2State } from './types.js';
export { emptyV2State, reduceV2Creates, applyOwnerEdit } from './reducer.js';
export {
  isV2EntityEnvelope,
  buildV2Envelope,
  buildV2OwnerEditEnvelope,
  reduceV2RuntimeRecords,
  toV2RuntimeRecord,
  isV2CreateRuntimeRecord,
  isV2OwnerEditRuntimeRecord,
  V2_IDENTIFIER_PREFIX,
} from './runtime.js';
export type {
  V2RuntimeRecord,
  V2CreateRuntimeRecord,
  V2OwnerEditRuntimeRecord,
  V2RuntimeState,
  V2RuntimeDiagnostics,
} from './runtime.js';
export { isQdnResourceRef, isV2AttachmentReferenceList } from './fieldPolicy.js';
export {
  buildReactionEnvelope,
  buildReactionIdentifier,
  buildReactionTargetPrefix,
  reduceReactionRecords,
  resolveReactionDisplay,
  isReactionEnvelope as isV2ReactionEnvelope,
  publishReactionEnvelope,
} from './reactions';
export type { ReactionRecord, ReducedReactionState, ReactionDiagnostic } from './reactions';
