// Video Center — QDN identifier generation
// Canonical reference: qortium-blog/src/services/qdn/identifiers.ts (VERIFIED-E2E)

// Video Center namespace prefix
const VC_PREFIX = 'vc-';

// Resource type prefixes
export const VIDEO_METADATA_PREFIX = `${VC_PREFIX}video-`;
export const VIDEO_MEDIA_PREFIX = `${VC_PREFIX}media-`;
export const THUMBNAIL_PREFIX = `${VC_PREFIX}thumb-`;
export const CHANNEL_PREFIX = `${VC_PREFIX}channel-`;
export const COMMENT_PREFIX = `${VC_PREFIX}comment-`;
export const FOLLOW_PREFIX = `${VC_PREFIX}follow-`;

const SHORT_ID_LENGTH = 8;
const COMMENT_ID_LENGTH = 6;
const MEDIA_ID_LENGTH = 7;

export const sanitizeIdentifierSegment = (value: string, maxLength = 24) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

export const createShortId = (length = SHORT_ID_LENGTH) => {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

// Video metadata identifiers
export const createVideoId = () => `${VIDEO_METADATA_PREFIX}${createShortId()}`;

// Media identifiers
export const createMediaId = () => `${VIDEO_MEDIA_PREFIX}${createShortId(MEDIA_ID_LENGTH)}`;
export const createThumbnailId = () => `${THUMBNAIL_PREFIX}${createShortId(MEDIA_ID_LENGTH)}`;

// Channel identifiers — deterministic from registered name
export const toChannelId = (ownerName: string) => {
  const clean = sanitizeIdentifierSegment(ownerName, 18);
  if (!clean) throw new Error('Owner name is required for channel identifier.');
  return `${CHANNEL_PREFIX}${clean}`;
};

// Comment identifiers — scoped to a video
export const toCommentId = (videoId: string) => {
  const videoIdPart = videoId.startsWith(VC_PREFIX) ? videoId.slice(VC_PREFIX.length) : videoId;
  return `${COMMENT_PREFIX}${videoIdPart}-${createShortId(COMMENT_ID_LENGTH)}`;
};

// Build comment search prefix for a given video
export const toCommentPrefix = (videoId: string) => {
  const videoIdPart = videoId.startsWith(VC_PREFIX) ? videoId.slice(VC_PREFIX.length) : videoId;
  return `${COMMENT_PREFIX}${videoIdPart}-`;
};

// Follow identifiers
export const toFollowId = (subscriberName: string, targetName: string) => {
  const sub = sanitizeIdentifierSegment(subscriberName, 18);
  const tgt = sanitizeIdentifierSegment(targetName, 18);
  return `${FOLLOW_PREFIX}${sub}-${tgt}`;
};

// Parse identifiers
export const parseVideoId = (identifier: string) => {
  if (!identifier.startsWith(VIDEO_METADATA_PREFIX)) return null;
  return identifier.slice(VIDEO_METADATA_PREFIX.length) || null;
};

export const parseChannelId = (identifier: string) => {
  if (!identifier.startsWith(CHANNEL_PREFIX)) return null;
  return identifier.slice(CHANNEL_PREFIX.length) || null;
};
