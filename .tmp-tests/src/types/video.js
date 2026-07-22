// Video Center — QDN resource reference
// Media limits — following qortium-blog patterns with stricter video limit for MVP
export const MEDIA_LIMITS = {
    video: {
        maxBytes: 100 * 1024 * 1024, // 100 MiB — Core public QDN publish max
        acceptedTypes: ['video/mp4', 'video/webm'],
    },
    thumbnail: {
        maxBytes: 5 * 1024 * 1024, // 5 MiB
        acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
};
export const formatBytes = (bytes) => {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
export const VIDEO_METADATA_SCHEMA = 'qortium.video.metadata.v1';
export const isValidVideoMetadata = (value) => {
    if (!value || typeof value !== 'object')
        return false;
    const v = value;
    return (v.schema === VIDEO_METADATA_SCHEMA &&
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
        typeof v.updatedAt === 'number');
};
export const COMMENT_SCHEMA = 'qortium.video.comment.v1';
export const isValidComment = (value) => {
    if (!value || typeof value !== 'object')
        return false;
    const c = value;
    return (c.schema === COMMENT_SCHEMA &&
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
        (c.status === 'published' || c.status === 'deleted'));
};
