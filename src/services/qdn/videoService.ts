// Video Center — domain-specific video service
// Canonical references:
//   List: QortiumDev/qortium-publish-manager/src/api/qortal.ts listResources() (VERIFIED-E2E)
//   Search: QortiumDev/qortium-publish-manager/src/api/qortal.ts searchResources() (VERIFIED-E2E)
//   Publish: qortium-blog/src/services/blog/blogService.ts createPost() + mediaService.ts (VERIFIED-E2E)

import type { QdnResourceRef, SearchResultItem, VideoMetadataV1 } from '../../types/video';
import { MEDIA_LIMITS, formatBytes, isValidVideoMetadata } from '../../types/video';
import type { CommentV1 } from '../../types/video';
import { isValidComment, COMMENT_SCHEMA } from '../../types/video';
import { createMediaId, createThumbnailId, createVideoId, toCommentId, toCommentPrefix } from './identifiers';
import {
  fetchJsonResource,
  getQdnResourceUrl,
  listResources,
  publishJsonResource,
  publishMultipleQdnResources,
  searchResources,
  waitForResourceReady,
  verifyJsonResource,
  type QdnResourceToPublish,
} from './qdnService';
import { encodeJsonToBase64 } from './encoding';

const VIDEO_METADATA_SERVICE = 'DOCUMENT';

// List videos using LIST_QDN_RESOURCES (primary) with SEARCH fallback.
// LIST_QDN_RESOURCES does NOT use the search index — returns all resources immediately.
// Canonical reference: QortiumDev/qortium-publish-manager/src/api/qortal.ts
const listVideosFromQdn = async (limit: number, offset: number): Promise<SearchResultItem[]> => {
  // Primary: LIST_QDN_RESOURCES with service filter, no name = all DOCUMENT resources
  const allResources = await listResources({
    service: VIDEO_METADATA_SERVICE,
    limit: 200,
    offset: 0,
    reverse: true,
    includeMetadata: true,
  });

  const filtered = allResources.filter(
    (item) => item.identifier && item.identifier.startsWith('vc-video-'),
  );

  if (filtered.length > 0) {
    return filtered.slice(offset, offset + limit);
  }

  // Fallback: try SEARCH_QDN_RESOURCES (uses index, may be stale)
  try {
    const searchResults = await searchResources({
      service: VIDEO_METADATA_SERVICE,
      query: 'vc-video',
      limit,
      offset,
      includeMetadata: true,
    });
    return searchResults.filter(
      (item) => item.identifier?.startsWith('vc-video-'),
    );
  } catch {
    return [];
  }
};

export const searchVideos = async (
  offset = 0,
  limit = 20,
  query?: string,
): Promise<SearchResultItem[]> => {
  const results = await listVideosFromQdn(limit * 2, offset);

  if (query) {
    const q = query.toLowerCase();
    return results
      .filter((item) => {
        const title = item.title || item.identifier || '';
        return title.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      })
      .slice(0, limit);
  }

  return results.slice(0, limit);
};

export const searchVideosByCategory = async (
  category: string,
  offset = 0,
  limit = 20,
): Promise<SearchResultItem[]> => {
  const results = await listVideosFromQdn(200, 0);
  const lowerCategory = category.toLowerCase();
  const filtered = results.filter((item) => {
    if (!item.identifier?.startsWith('vc-video-')) return false;
    const tags = item.tags ?? [];
    return tags.some((tag) => tag.toLowerCase().includes(lowerCategory));
  });
  return filtered.slice(offset, offset + limit);
};

export const searchVideosByCreator = async (
  creatorName: string,
  offset = 0,
  limit = 20,
): Promise<SearchResultItem[]> => {
  const results = await listVideosFromQdn(200, 0);
  const filtered = results.filter(
    (item) => item.name === creatorName && item.identifier?.startsWith('vc-video-'),
  );
  return filtered.slice(offset, offset + limit);
};

export const fetchVideoMetadata = async (
  publisherName: string,
  identifier: string,
): Promise<VideoMetadataV1> => {
  const raw = await fetchJsonResource<unknown>(
    VIDEO_METADATA_SERVICE,
    publisherName,
    identifier,
  );

  if (!isValidVideoMetadata(raw)) {
    throw new Error(
      `Video metadata at ${identifier} (published by ${publisherName}) failed schema validation.`,
    );
  }

  return raw;
};

export const resolveVideoThumbnailUrl = async (
  video: VideoMetadataV1,
): Promise<string> => {
  try {
    return await getQdnResourceUrl(video.thumbnailReference);
  } catch {
    return '';
  }
};

export const resolveVideoMediaUrl = async (
  video: VideoMetadataV1,
): Promise<string> => {
  try {
    return await getQdnResourceUrl(video.mediaReference);
  } catch {
    return '';
  }
};

// ── Publishing ──────────────────────────────────────────────
// Canonical reference: qortium-blog/src/services/blog/blogService.ts createPost() (VERIFIED-E2E)
//                     qortium-blog/src/services/blog/mediaService.ts publishFileResource() (VERIFIED-E2E)

export type PublishVideoInput = {
  ownerName: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  videoFile: File;
  thumbnailFile: File;
  language?: string;
};

export const validatePublishInput = (input: PublishVideoInput): string | null => {
  if (!input.ownerName.trim()) return 'A publishing name is required.';
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

export const publishVideo = async (
  input: PublishVideoInput,
): Promise<VideoMetadataV1> => {
  const now = Date.now();
  const videoId = createVideoId();
  const mediaId = createMediaId();
  const thumbnailId = createThumbnailId();

  // Build media reference
  const mediaRef: QdnResourceRef = {
    service: 'VIDEO',
    name: input.ownerName,
    identifier: mediaId,
    filename: input.videoFile.name,
    mimeType: input.videoFile.type || 'video/mp4',
    size: input.videoFile.size,
  };

  // Build thumbnail reference
  const thumbnailRef: QdnResourceRef = {
    service: 'IMAGE',
    name: input.ownerName,
    identifier: thumbnailId,
    filename: input.thumbnailFile.name,
    mimeType: input.thumbnailFile.type || 'image/webp',
    size: input.thumbnailFile.size,
  };

  // Build metadata payload
  const metadata: VideoMetadataV1 = {
    schema: 'qortium.video.metadata.v1',
    version: 1,
    videoId,
    publisherName: input.ownerName,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    tags: input.tags.slice(0, 10),
    mediaReference: mediaRef,
    thumbnailReference: thumbnailRef,
    language: input.language || undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Publish all three resources together
  const resources: QdnResourceToPublish[] = [
    // 1. Video media
    {
      service: 'VIDEO',
      name: input.ownerName,
      identifier: mediaId,
      filename: input.videoFile.name,
      title: input.title.trim(),
      description: `${input.videoFile.type || 'video/mp4'} - ${formatBytes(input.videoFile.size)}`,
      file: input.videoFile,
    },
    // 2. Thumbnail
    {
      service: 'IMAGE',
      name: input.ownerName,
      identifier: thumbnailId,
      filename: input.thumbnailFile.name,
      title: `Thumbnail for ${input.title.trim()}`,
      description: `${input.thumbnailFile.type || 'image/webp'} - ${formatBytes(input.thumbnailFile.size)}`,
      file: input.thumbnailFile,
    },
    // 3. Metadata JSON
    {
      service: VIDEO_METADATA_SERVICE,
      name: input.ownerName,
      identifier: videoId,
      filename: 'video-metadata.json',
      title: input.title.trim(),
      description: input.description.trim(),
      tags: input.tags.slice(0, 5),
      data64: encodeJsonToBase64(metadata),
    },
  ];

  // Publish together
  await publishMultipleQdnResources(resources);

  // Wait for all three resources
  await Promise.all([
    waitForResourceReady('VIDEO', input.ownerName, mediaId),
    waitForResourceReady('IMAGE', input.ownerName, thumbnailId),
    waitForResourceReady(VIDEO_METADATA_SERVICE, input.ownerName, videoId),
  ]);

  // Verify metadata read-back
  const verified = await verifyJsonResource<VideoMetadataV1>(
    VIDEO_METADATA_SERVICE,
    input.ownerName,
    videoId,
    isValidVideoMetadata,
  );

  return verified;
};

// ── Comments ────────────────────────────────────────────────
// Canonical reference: qortium-blog BLOG_COMMENT schema (VERIFIED-E2E)
//                     Discussion-Boards DOCUMENT envelope tombstone (VERIFIED-E2E)

const COMMENT_SERVICE = 'DOCUMENT';

export const fetchComments = async (
  videoId: string,
  limit = 100,
): Promise<CommentV1[]> => {
  const prefix = toCommentPrefix(videoId);

  // Use LIST_QDN_RESOURCES — same pattern as the QDN Explorer
  const allResources = await listResources({
    service: COMMENT_SERVICE,
    limit: 200,
    offset: 0,
    reverse: false,
    includeMetadata: false,
  });

  // Client-side filter by comment prefix for this video
  const matchingIdentifiers = allResources
    .filter((item) => item.identifier?.startsWith(prefix))
    .map((item) => ({ name: item.name, identifier: item.identifier }));

  // Fetch each comment, validate, filter deleted, sort by createdAt ASC
  const comments: CommentV1[] = [];

  for (const { name, identifier } of matchingIdentifiers) {
    try {
      const raw = await fetchJsonResource<unknown>(COMMENT_SERVICE, name, identifier);
      if (isValidComment(raw) && raw.status === 'published' && raw.videoId === videoId) {
        comments.push(raw);
      }
    } catch {
      // Skip unreadable comments
    }
  }

  comments.sort((a, b) => a.createdAt - b.createdAt);
  return comments.slice(0, limit);
};

export const publishComment = async (
  videoId: string,
  authorName: string,
  body: string,
): Promise<CommentV1> => {
  const now = Date.now();
  const commentId = toCommentId(videoId);

  const comment: CommentV1 = {
    schema: COMMENT_SCHEMA,
    version: 1,
    videoId,
    commentId,
    authorName,
    body: body.trim(),
    createdAt: now,
    updatedAt: now,
    status: 'published',
  };

  await publishJsonResource({
    service: COMMENT_SERVICE,
    name: authorName,
    identifier: commentId,
    payload: comment,
    title: `Comment on ${videoId}`,
    description: body.trim().slice(0, 100),
    filename: 'comment.json',
  });

  await waitForResourceReady(COMMENT_SERVICE, authorName, commentId);

  return verifyJsonResource<CommentV1>(
    COMMENT_SERVICE,
    authorName,
    commentId,
    isValidComment,
  );
};

export const updateComment = async (
  existing: CommentV1,
  newBody: string,
): Promise<CommentV1> => {
  const updated: CommentV1 = {
    ...existing,
    body: newBody.trim(),
    updatedAt: Date.now(),
  };

  await publishJsonResource({
    service: COMMENT_SERVICE,
    name: existing.authorName,
    identifier: existing.commentId,
    payload: updated,
    title: `Updated comment on ${existing.videoId}`,
    description: newBody.trim().slice(0, 100),
    filename: 'comment.json',
  });

  await waitForResourceReady(COMMENT_SERVICE, existing.authorName, existing.commentId);

  return verifyJsonResource<CommentV1>(
    COMMENT_SERVICE,
    existing.authorName,
    existing.commentId,
    isValidComment,
  );
};
