// Video Center — V2 video service (qvc-v2 envelope based)
// Canonical reference: Discussion-Boards/src/services/qdn/forumQdnService.ts
// All entities and operations use qvc-v2 envelopes with identity validation.

import type { QdnResourceRef } from '../../types/video.js';
import { MEDIA_LIMITS, formatBytes } from '../../types/video.js';
import {
  createMediaId,
  createThumbnailId,
  createV2VideoId,
  toV2CommentId,
  toV2CommentPrefix,
  toV2FollowId,
} from './identifiers.js';
import {
  fetchJsonResource,
  getQdnResourceUrl,
  publishJsonResource,
  waitForResourceReady,
} from './qdnService.js';
import { discoverVcQdnResources } from './qdnPagination.js';
import { publishQdnFile } from '../qortium/qdnFilePublication.js';
import {
  buildV2Envelope,
  buildV2OwnerEditEnvelope,
  isV2EntityEnvelope,
  reduceV2RuntimeRecords,
  type V2RuntimeDiagnostics,
  type V2RuntimeState,
} from '../architectureV2/runtime.js';
import type {
  VideoCreate,
  CommentCreate,
  FollowCreate,
  V2EntityCreate,
  OwnerEdit,
  QvcV2CreateEnvelope,
  QvcV2ResourceMetadata,
  V2Identity,
} from '../architectureV2/types.js';
import type { IdentityValidator } from '../architectureV2/validation.js';

const VIDEO_METADATA_SERVICE = 'DOCUMENT';
const COMMENT_SERVICE = 'DOCUMENT';

// ── Identity validator (production) ────────────────────────
// Validates that QDN publisher name matches the claimed identity.
// This is THE security boundary — no author field is trusted without this check.

export const createIdentityValidator = (
  resolveWallet: (name: string) => string | null,
): IdentityValidator => ({
  validatePublisher: (metadata, claimedPublisher) => {
    if (metadata.publisherName !== claimedPublisher) {
      return {
        ok: false,
        code: 'UNAUTHORIZED_PUBLISHER',
        detail: `publisher ${metadata.publisherName} does not match claimed identity ${claimedPublisher}`,
      };
    }
    return { ok: true };
  },
  validateWalletBinding: (publisherName, walletAddress) => {
    const resolved = resolveWallet(publisherName);
    if (!resolved) {
      return {
        ok: false,
        code: 'WALLET_BINDING_MISMATCH',
        detail: `could not resolve wallet for ${publisherName}`,
      };
    }
    if (resolved !== walletAddress) {
      return {
        ok: false,
        code: 'WALLET_BINDING_MISMATCH',
        detail: `wallet ${walletAddress} does not match resolved address ${resolved} for ${publisherName}`,
      };
    }
    return { ok: true };
  },
});

// ── Resource metadata extraction ───────────────────────────

type V2SearchResultItem = {
  name: string;
  service: string;
  identifier: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  created?: number;
  updated?: number;
  size?: number;
  latestSignature?: string;
};

const toResourceMetadata = (item: V2SearchResultItem): QvcV2ResourceMetadata => ({
  service: item.service || VIDEO_METADATA_SERVICE,
  publisherName: item.name || '',
  identifier: item.identifier || '',
  created: item.created ?? 0,
  updated: item.updated ?? null,
  latestSignature: (item as Record<string, unknown>).latestSignature as string | undefined,
});

// ── Video listing (V2 discovery with pagination) ───────────

const METADATA_FETCH_CONCURRENCY = 6;
const METADATA_FETCH_TIMEOUT_MS = 5000;

/** Simple bounded-concurrency mapper — avoids unbounded parallel fetches. */
const mapWithConcurrency = async <TInput, TOutput>(
  items: TInput[],
  mapper: (item: TInput, index: number) => Promise<TOutput>,
  concurrency: number,
): Promise<TOutput[]> => {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex;
      nextIndex += 1;
      results[idx] = await mapper(items[idx], idx);
    }
  };

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return results;
};

/** Wraps a promise with a timeout — rejects if it takes too long. */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`)), timeoutMs),
    ),
  ]);
};

export const discoverV2Videos = async (
  identity: IdentityValidator,
  onPartialState?: (state: V2RuntimeState) => void,
): Promise<V2RuntimeState> => {
  // Paginated discovery with server-side identifier prefix filter
  const discovery = await discoverVcQdnResources({
    service: VIDEO_METADATA_SERVICE,
    identifierPrefix: 'qvc-v2-video-',
    reverse: true,
    includeMetadata: true,
  });

  const videoResources = discovery.items;

  if (videoResources.length === 0) {
    const empty: V2RuntimeState = {
      authoritative: { entities: {}, quarantined: [] },
      diagnostics: discovery.diagnostics
        .filter((d) => d.code !== 'PARTIAL_DISCOVERY')
        .map((d) => ({
          code: d.code as 'INVALID_METADATA',
          identifier: d.detail,
          detail: d.detail,
        })),
      discovery: {
        completeness: discovery.completeness,
        pagesFetched: discovery.pagesFetched,
        resourcesSeen: discovery.resourcesSeen,
        stoppedReason: discovery.stoppedReason,
        source: 'network',
      },
    };
    onPartialState?.(empty);
    return empty;
  }

  // Accumulate results as individual fetches complete.
  // After each result, deterministically reduce the known record set and emit
  // a partial snapshot so healthy videos render without waiting for slow ones.
  const accumulatedRecords: Array<{
    metadata: QvcV2ResourceMetadata;
    envelope: QvcV2CreateEnvelope<V2EntityCreate>;
  }> = [];
  const accumulatedFailures: string[] = [];
  let completedCount = 0;

  const buildState = (): V2RuntimeState => {
    const state = reduceV2RuntimeRecords([...accumulatedRecords], identity);
    const fetchDiagnostics = accumulatedFailures.map(
      (detail): V2RuntimeDiagnostics => ({
        code: 'UNAVAILABLE_RESOURCE',
        identifier: detail.split(':')[0] ?? detail,
        detail,
      }),
    );
    return {
      ...state,
      diagnostics: [...state.diagnostics, ...fetchDiagnostics],
      discovery: {
        completeness: discovery.completeness,
        pagesFetched: discovery.pagesFetched,
        resourcesSeen: discovery.resourcesSeen,
        stoppedReason: discovery.stoppedReason,
        source: 'network',
      },
    };
  };

  const emitIfBatch = () => {
    if (!onPartialState) return;
    // Emit on first result (fast path for healthy content), then every
    // concurrency-sized batch, and always on the final result.
    if (
      completedCount === 1 ||
      completedCount % METADATA_FETCH_CONCURRENCY === 0 ||
      completedCount === videoResources.length
    ) {
      onPartialState(buildState());
    }
  };

  // Fetch all metadata envelopes concurrently (bounded) with per-fetch timeout.
  // Each fetch completion independently accumulates and may emit a partial snapshot.
  await mapWithConcurrency(
    videoResources,
    async (item) => {
      const label = `${item.name}/${item.identifier}`;
      try {
        const metadata = toResourceMetadata(item);
        const raw = await withTimeout(
          fetchJsonResource<unknown>(VIDEO_METADATA_SERVICE, item.name, item.identifier),
          METADATA_FETCH_TIMEOUT_MS,
          label,
        );

        if (isV2EntityEnvelope(raw)) {
          accumulatedRecords.push({
            metadata,
            envelope: raw as QvcV2CreateEnvelope<V2EntityCreate>,
          });
        } else {
          accumulatedFailures.push(`${label}: not a valid qvc-v2 envelope`);
        }
      } catch (err) {
        accumulatedFailures.push(
          `${label}: ${err instanceof Error ? err.message : 'fetch failed'}`,
        );
      } finally {
        completedCount += 1;
        emitIfBatch();
      }
    },
    METADATA_FETCH_CONCURRENCY,
  );

  // Return final fully-settled state (identical to deterministic full reduction)
  return buildState();
};

// ── Video publishing (V2) ──────────────────────────────────

export type PublishVideoV2Input = {
  identity: V2Identity;
  title: string;
  description: string;
  category: string;
  tags: string[];
  videoFile: File;
  thumbnailFile: File;
  language?: string;
};

export const validatePublishV2Input = (input: PublishVideoV2Input): string | null => {
  if (!input.identity.publisherName.trim()) return 'A publishing name is required.';
  if (!input.title.trim()) return 'Title is required.';
  if (!input.videoFile) return 'A video file is required.';
  if (!input.thumbnailFile) return 'A thumbnail image is required.';

  if (input.videoFile.size > MEDIA_LIMITS.video.maxBytes) {
    return `Video file is too large. Maximum size is ${formatBytes(MEDIA_LIMITS.video.maxBytes)}.`;
  }
  if (!MEDIA_LIMITS.video.acceptedTypes.includes(input.videoFile.type)) {
    return `Video format not supported. Accepted: ${MEDIA_LIMITS.video.acceptedTypes.join(', ')}.`;
  }
  if (input.thumbnailFile.size > MEDIA_LIMITS.thumbnail.maxBytes) {
    return `Thumbnail is too large. Maximum size is ${formatBytes(MEDIA_LIMITS.thumbnail.maxBytes)}.`;
  }
  if (!MEDIA_LIMITS.thumbnail.acceptedTypes.includes(input.thumbnailFile.type)) {
    return `Thumbnail format not supported. Accepted: ${MEDIA_LIMITS.thumbnail.acceptedTypes.join(', ')}.`;
  }
  if (input.title.length > 200) return 'Title must be 200 characters or fewer.';
  if (input.description.length > 5000) return 'Description must be 5000 characters or fewer.';
  if (input.tags.length > 10) return 'Maximum 10 tags allowed.';

  return null;
};

export const publishVideoV2 = async (input: PublishVideoV2Input): Promise<VideoCreate> => {
  const videoId = createV2VideoId();
  const mediaId = createMediaId();
  const thumbnailId = createThumbnailId();

  const publisherName = input.identity.publisherName;

  // Build media reference
  const mediaRef: QdnResourceRef = {
    service: 'VIDEO',
    name: publisherName,
    identifier: mediaId,
    filename: input.videoFile.name,
    mimeType: input.videoFile.type || 'video/mp4',
    size: input.videoFile.size,
  };

  // Build thumbnail reference
  const thumbnailRef: QdnResourceRef = {
    service: 'IMAGE',
    name: publisherName,
    identifier: thumbnailId,
    filename: input.thumbnailFile.name,
    mimeType: input.thumbnailFile.type || 'image/webp',
    size: input.thumbnailFile.size,
  };

  // Publish media files via Home source-token (for large files) or inline (for small files)
  // This avoids base64-encoding 100 MiB videos in the browser.
  await Promise.all([
    publishQdnFile({
      file: input.videoFile,
      resource: {
        service: 'VIDEO',
        name: publisherName,
        identifier: mediaId,
        filename: input.videoFile.name,
        mimeType: input.videoFile.type || 'video/mp4',
        size: input.videoFile.size,
      },
    }),
    publishQdnFile({
      file: input.thumbnailFile,
      resource: {
        service: 'IMAGE',
        name: publisherName,
        identifier: thumbnailId,
        filename: input.thumbnailFile.name,
        mimeType: input.thumbnailFile.type || 'image/webp',
        size: input.thumbnailFile.size,
      },
    }),
  ]);

  // Build V2 entity
  const videoCreate: VideoCreate = {
    entityType: 'video',
    entityId: videoId,
    publisherName,
    walletAddress: input.identity.walletAddress,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    tags: input.tags.slice(0, 10),
    mediaReference: mediaRef,
    thumbnailReference: thumbnailRef,
    language: input.language || undefined,
  };

  // Publish metadata JSON inline (always small enough for base64)
  const envelope = buildV2Envelope(videoCreate, videoId);
  await publishJsonResource({
    service: VIDEO_METADATA_SERVICE,
    name: publisherName,
    identifier: videoId,
    filename: 'video-metadata.json',
    title: input.title.trim(),
    description: input.description.trim(),
    tags: input.tags.slice(0, 5),
    payload: envelope,
  });

  // Wait for all resources to reach READY (throws on timeout — no silent degradation)
  const [videoStatus, imageStatus, metadataStatus] = await Promise.all([
    waitForResourceReady('VIDEO', publisherName, mediaId),
    waitForResourceReady('IMAGE', publisherName, thumbnailId),
    waitForResourceReady(VIDEO_METADATA_SERVICE, publisherName, videoId),
  ]);

  // Defensive: verify each actually reports READY
  for (const [label, status] of [
    ['VIDEO', videoStatus],
    ['IMAGE', imageStatus],
    ['METADATA', metadataStatus],
  ] as const) {
    if (status.status !== 'READY') {
      throw new Error(
        `${label} resource status is ${status.status ?? 'UNKNOWN'} after wait — ` +
          `chunks: ${status.localChunkCount ?? '?'}/${status.totalChunkCount ?? '?'}.`,
      );
    }
  }

  // Verify envelope read-back (resource is READY, so this should succeed reliably)
  const verified = await fetchJsonResource<unknown>(VIDEO_METADATA_SERVICE, publisherName, videoId);

  if (!isV2EntityEnvelope(verified)) {
    throw new Error('Published video metadata is not a valid qvc-v2 envelope.');
  }

  return videoCreate;
};

// ── Comments (V2) ──────────────────────────────────────────

export const fetchCommentsV2 = async (
  videoId: string,
  identity: IdentityValidator,
  limit = 100,
): Promise<CommentCreate[]> => {
  const prefix = toV2CommentPrefix(videoId);

  // Paginated discovery of all DOCUMENT resources
  const discovery = await discoverVcQdnResources({
    service: COMMENT_SERVICE,
    reverse: false,
    includeMetadata: false,
  });

  // Client-side filter by comment prefix for this video
  const matchingIdentifiers = discovery.items
    .filter((item) => item.identifier?.startsWith(prefix))
    .map((item) => ({ name: item.name, identifier: item.identifier }));

  const comments: Array<{ entity: CommentCreate; created: number }> = [];

  for (const { name, identifier } of matchingIdentifiers) {
    try {
      const raw = await fetchJsonResource<unknown>(COMMENT_SERVICE, name, identifier);
      if (!isV2EntityEnvelope(raw)) continue;

      const metadata: QvcV2ResourceMetadata = {
        service: COMMENT_SERVICE,
        publisherName: name,
        identifier,
        created: (raw as Record<string, unknown>).clientCreatedAt
          ? new Date((raw as Record<string, unknown>).clientCreatedAt as string).getTime()
          : 0,
        updated: null,
      };

      const publisherCheck = identity.validatePublisher(metadata, name);
      if (publisherCheck.ok === false) continue;

      const body = raw.body as Record<string, unknown>;
      if (
        raw.kind === 'entity-create' &&
        raw.recordType === 'comment' &&
        typeof body?.parentVideoId === 'string' &&
        body.parentVideoId === videoId &&
        typeof body?.body === 'string'
      ) {
        comments.push({
          entity: body as unknown as CommentCreate,
          created: metadata.created,
        });
      }
    } catch {
      // Skip unreadable comments
    }
  }

  // Sort by creation order
  comments.sort((a, b) => a.created - b.created);

  return comments.slice(0, limit).map((c) => c.entity);
};

export const publishCommentV2 = async (
  videoId: string,
  identity: V2Identity,
  body: string,
): Promise<CommentCreate> => {
  const commentId = toV2CommentId(videoId);

  const commentCreate: CommentCreate = {
    entityType: 'comment',
    entityId: commentId,
    publisherName: identity.publisherName,
    walletAddress: identity.walletAddress,
    parentVideoId: videoId,
    body: body.trim(),
  };

  const envelope = buildV2Envelope(commentCreate, commentId);

  await publishJsonResource({
    service: COMMENT_SERVICE,
    name: identity.publisherName,
    identifier: commentId,
    payload: envelope,
    title: `Comment on ${videoId}`,
    description: body.trim().slice(0, 100),
    filename: 'comment.json',
  });

  await waitForResourceReady(COMMENT_SERVICE, identity.publisherName, commentId);

  const verified = await fetchJsonResource<unknown>(
    COMMENT_SERVICE,
    identity.publisherName,
    commentId,
  );

  if (!isV2EntityEnvelope(verified)) {
    throw new Error('Published comment is not a valid qvc-v2 envelope.');
  }

  return commentCreate;
};

export const updateCommentV2 = async (
  commentId: string,
  identity: V2Identity,
  newBody: string,
): Promise<OwnerEdit> => {
  const edit: OwnerEdit = {
    operation: 'owner-edit',
    targetId: commentId,
    targetType: 'comment',
    publisherName: identity.publisherName,
    walletAddress: identity.walletAddress,
    fields: { body: newBody.trim() },
  };

  const envelope = buildV2OwnerEditEnvelope(edit, `edit-${commentId}-${Date.now()}`);

  await publishJsonResource({
    service: COMMENT_SERVICE,
    name: identity.publisherName,
    identifier: commentId,
    payload: envelope,
    title: `Updated comment ${commentId}`,
    description: newBody.trim().slice(0, 100),
    filename: 'comment.json',
  });

  await waitForResourceReady(COMMENT_SERVICE, identity.publisherName, commentId);

  return edit;
};

// ── Follows (V2) ───────────────────────────────────────────

export const publishFollowV2 = async (
  subscriberIdentity: V2Identity,
  targetName: string,
): Promise<FollowCreate> => {
  const followId = toV2FollowId(subscriberIdentity.publisherName, targetName);

  const followCreate: FollowCreate = {
    entityType: 'follow',
    entityId: followId,
    publisherName: subscriberIdentity.publisherName,
    walletAddress: subscriberIdentity.walletAddress,
    targetName,
  };

  const envelope = buildV2Envelope(followCreate, followId);

  await publishJsonResource({
    service: COMMENT_SERVICE,
    name: subscriberIdentity.publisherName,
    identifier: followId,
    payload: envelope,
    title: `Follow ${targetName}`,
    description: `${subscriberIdentity.publisherName} follows ${targetName}`,
    filename: 'follow.json',
  });

  await waitForResourceReady(COMMENT_SERVICE, subscriberIdentity.publisherName, followId);

  return followCreate;
};

export const discoverFollowsV2 = async (
  subscriberName: string,
  identity: IdentityValidator,
): Promise<FollowCreate[]> => {
  // Paginated discovery with server-side identifier prefix filter
  const discovery = await discoverVcQdnResources({
    service: COMMENT_SERVICE,
    name: subscriberName,
    identifierPrefix: 'qvc-v2-follow-',
    reverse: false,
    includeMetadata: false,
  });

  const followResources = discovery.items;

  const follows: FollowCreate[] = [];

  for (const item of followResources) {
    try {
      const raw = await fetchJsonResource<unknown>(COMMENT_SERVICE, item.name, item.identifier);

      if (!isV2EntityEnvelope(raw)) continue;

      const metadata: QvcV2ResourceMetadata = {
        service: COMMENT_SERVICE,
        publisherName: item.name,
        identifier: item.identifier,
        created: item.created ?? 0,
        updated: item.updated ?? null,
      };

      const publisherCheck = identity.validatePublisher(metadata, item.name);
      if (publisherCheck.ok === false) continue;

      const body = raw.body as Record<string, unknown>;
      if (
        raw.kind === 'entity-create' &&
        raw.recordType === 'follow' &&
        typeof body?.targetName === 'string'
      ) {
        follows.push(body as unknown as FollowCreate);
      }
    } catch {
      // Skip
    }
  }

  return follows;
};

// ── Video metadata read (V2) ───────────────────────────────

export const fetchVideoMetadataV2 = async (
  publisherName: string,
  identifier: string,
  identity: IdentityValidator,
): Promise<VideoCreate> => {
  const raw = await fetchJsonResource<unknown>(VIDEO_METADATA_SERVICE, publisherName, identifier);

  if (!isV2EntityEnvelope(raw)) {
    throw new Error(`Video metadata at ${identifier} is not a valid qvc-v2 envelope.`);
  }

  const metadata: QvcV2ResourceMetadata = {
    service: VIDEO_METADATA_SERVICE,
    publisherName,
    identifier,
    created: 0,
    updated: null,
  };

  const publisherCheck = identity.validatePublisher(metadata, publisherName);
  if (publisherCheck.ok === false) {
    throw new Error(`Video metadata publisher mismatch: ${publisherCheck.detail}`);
  }

  const body = raw.body as Record<string, unknown>;
  if (raw.recordType !== 'video' || raw.kind !== 'entity-create') {
    throw new Error(`Invalid video metadata envelope type at ${identifier}.`);
  }

  return body as unknown as VideoCreate;
};

export const resolveVideoMediaUrl = async (video: VideoCreate): Promise<string> => {
  try {
    return await getQdnResourceUrl(video.mediaReference);
  } catch {
    return '';
  }
};

export const resolveVideoThumbnailUrl = async (video: VideoCreate): Promise<string> => {
  try {
    return await getQdnResourceUrl(video.thumbnailReference);
  } catch {
    return '';
  }
};
