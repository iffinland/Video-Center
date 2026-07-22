// Video Center — QDN resource reference

export type QdnService = 'VIDEO' | 'IMAGE' | 'THUMBNAIL' | 'DOCUMENT' | 'APP';

export type QdnResourceRef = {
  service: QdnService;
  name: string;
  identifier: string;
  filename?: string;
  mimeType?: string;
  size?: number;
};

// Account types

export type AccountProfile = {
  address: string;
  name: string;
  names: string[];
  raw: unknown;
};

// Publish state machine

export type PublishState =
  | 'idle'
  | 'validating'
  | 'ready'
  | 'awaiting_approval'
  | 'publishing'
  | 'verifying'
  | 'success'
  | 'error'
  | 'approval_denied';

export type PublishProgress = {
  state: PublishState;
  message: string;
  publishedVideoId?: string;
  publishedName?: string;
  error?: string;
};

// Media limits — following qortium-blog patterns with stricter video limit for MVP

export const MEDIA_LIMITS = {
  video: {
    maxBytes: 100 * 1024 * 1024, // 100 MiB — Core public QDN publish max
    acceptedTypes: ['video/mp4', 'video/webm'] as readonly string[],
  },
  thumbnail: {
    maxBytes: 5 * 1024 * 1024, // 5 MiB
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  },
} as const;

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Video metadata — published as DOCUMENT with schema qortium.video.metadata.v1

export type VideoMetadataV1 = {
  schema: 'qortium.video.metadata.v1';
  version: 1;
  videoId: string;
  publisherName: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  mediaReference: QdnResourceRef;
  thumbnailReference: QdnResourceRef;
  durationSeconds?: number;
  language?: string;
  createdAt: number;
  updatedAt: number;
};

export const VIDEO_METADATA_SCHEMA = 'qortium.video.metadata.v1' as const;

export const isValidVideoMetadata = (value: unknown): value is VideoMetadataV1 => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.schema === VIDEO_METADATA_SCHEMA &&
    v.version === 1 &&
    typeof v.videoId === 'string' &&
    v.videoId.length > 0 &&
    typeof v.publisherName === 'string' &&
    v.publisherName.length > 0 &&
    typeof v.title === 'string' &&
    typeof v.mediaReference === 'object' &&
    v.mediaReference !== null &&
    typeof v.thumbnailReference === 'object' &&
    v.thumbnailReference !== null &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
};

// Search result item — matches SEARCH_QDN_RESOURCES response shape

export type SearchResultItem = {
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
};

// QDN resource status

export type QdnResourceStatus = {
  status?: string;
  description?: string;
  localChunkCount?: number;
  totalChunkCount?: number;
  percentLoaded?: number;
};

// Comment — published as DOCUMENT with schema qortium.video.comment.v1
// Canonical reference: qortium-blog BLOG_COMMENT schema (VERIFIED-E2E)

export type CommentV1 = {
  schema: 'qortium.video.comment.v1';
  version: 1;
  videoId: string;
  commentId: string;
  authorName: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  status: 'published' | 'deleted';
};

export const COMMENT_SCHEMA = 'qortium.video.comment.v1' as const;

export const isValidComment = (value: unknown): value is CommentV1 => {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    c.schema === COMMENT_SCHEMA &&
    c.version === 1 &&
    typeof c.videoId === 'string' &&
    c.videoId.length > 0 &&
    typeof c.commentId === 'string' &&
    c.commentId.length > 0 &&
    typeof c.authorName === 'string' &&
    c.authorName.length > 0 &&
    typeof c.body === 'string' &&
    typeof c.createdAt === 'number' &&
    typeof c.updatedAt === 'number' &&
    (c.status === 'published' || c.status === 'deleted')
  );
};

// ── Architecture V2 types ──────────────────────────────────
// Used by architectureV2/fieldPolicy.ts

export type V2AttachmentReference = {
  id: string;
  service: string;
  name: string;
  identifier: string;
  filename: string;
  mimeType: string;
  size: number;
};
