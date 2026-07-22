// Video Center — V2 video detail page

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoDetail } from '../hooks/useVideoDetail';
import { useAccount } from '../hooks/useAccount';
import { useComments } from '../hooks/useComments';
import { useTip } from '../hooks/useTip';
import { VideoPlayer } from '../components/video/VideoPlayer';
import { CommentList } from '../components/comments/CommentList';
import { TipDialog } from '../components/tip/TipDialog';
import { LoadingSpinner, ErrorMessage } from '../components/shared/LoadingSpinner';

export const VideoDetailPage = () => {
  const { name, identifier } = useParams<{ name: string; identifier: string }>();
  const navigate = useNavigate();

  const decodedName = name ? decodeURIComponent(name) : undefined;
  const decodedId = identifier ? decodeURIComponent(identifier) : undefined;

  const { account, identity } = useAccount();
  const { video, mediaUrl, thumbnailUrl, loading, error } = useVideoDetail(
    decodedName,
    decodedId,
    identity,
  );

  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    addComment,
    editComment,
  } = useComments(video?.entityId, account, account?.name ?? '', identity);

  const {
    sending: tipSending,
    error: tipError,
    success: tipSuccess,
    tip,
    reset: resetTip,
  } = useTip();
  const [showTipDialog, setShowTipDialog] = useState(false);

  if (loading) {
    return <LoadingSpinner message="Loading video…" />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => navigate(0)} />;
  }

  if (!video) {
    return <ErrorMessage message="Video not found." onRetry={() => navigate('/')} />;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Player */}
      <div style={{ marginBottom: '1rem' }}>
        <VideoPlayer
          src={mediaUrl}
          mimeType={video.mediaReference.mimeType}
          poster={thumbnailUrl}
        />
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '1.375rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          lineHeight: 1.3,
        }}
      >
        {video.title}
      </h1>

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '1rem',
        }}
      >
        <div>
          <button
            onClick={() => navigate(`/channel/${encodeURIComponent(video.publisherName)}`)}
            style={{
              fontWeight: 600,
              color: '#6366f1',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              padding: 0,
            }}
          >
            {video.publisherName}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {video.category && (
            <span
              style={{
                padding: '0.25rem 0.625rem',
                backgroundColor: '#eef2ff',
                color: '#6366f1',
                borderRadius: 20,
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              {video.category}
            </span>
          )}
          {video.durationSeconds && (
            <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
              {Math.floor(video.durationSeconds / 60)}:
              {String(video.durationSeconds % 60).padStart(2, '0')}
            </span>
          )}
          <button
            onClick={() => {
              resetTip();
              setShowTipDialog(true);
            }}
            style={{
              padding: '0.375rem 0.875rem',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fcd34d',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            💰 Tip QORT
          </button>
        </div>
      </div>

      {/* Description */}
      {video.description && (
        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              color: '#374151',
              whiteSpace: 'pre-wrap',
            }}
          >
            {video.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {video.tags && video.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {video.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '0.2rem 0.625rem',
                backgroundColor: '#f3f4f6',
                borderRadius: 6,
                fontSize: '0.75rem',
                color: '#6b7280',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Comments */}
      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        {commentsError && (
          <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            {commentsError}
          </p>
        )}
        {commentsLoading && comments.length === 0 ? (
          <LoadingSpinner message="Loading comments…" />
        ) : (
          <CommentList
            comments={comments}
            account={account}
            onAdd={addComment}
            onEdit={editComment}
          />
        )}
      </div>

      {/* Video metadata (debug/transparency) */}
      <details style={{ marginTop: '2rem', color: '#9ca3af', fontSize: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Resource details</summary>
        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            fontFamily: 'monospace',
          }}
        >
          <div>Schema: qvc-v2</div>
          <div>Video ID: {video.entityId}</div>
          <div>Publisher: {video.publisherName}</div>
          <div>Wallet: {video.walletAddress}</div>
          <div>
            Media: {video.mediaReference.service}/{video.mediaReference.identifier}
          </div>
          <div>
            Thumbnail: {video.thumbnailReference.service}/{video.thumbnailReference.identifier}
          </div>
          {video.mediaReference.size && (
            <div>Media size: {(video.mediaReference.size / (1024 * 1024)).toFixed(1)} MB</div>
          )}
          {video.language && <div>Language: {video.language}</div>}
        </div>
      </details>

      {/* Tip dialog */}
      {showTipDialog && (
        <TipDialog
          recipientName={video.publisherName}
          sending={tipSending}
          error={tipError}
          success={tipSuccess}
          onSend={(amount) => tip(video.publisherName, amount)}
          onClose={() => setShowTipDialog(false)}
          onReset={resetTip}
        />
      )}
    </div>
  );
};
