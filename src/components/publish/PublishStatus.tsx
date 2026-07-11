// Video Center — publish status display

import type { PublishProgress } from '../../types/video';
import { LoadingSpinner, ErrorMessage } from '../shared/LoadingSpinner';

type Props = {
  progress: PublishProgress;
  onReset: () => void;
  onViewVideo: () => void;
};

export const PublishStatus = ({ progress, onReset, onViewVideo }: Props) => {
  const { state, message, error, publishedVideoId, publishedName } = progress;

  switch (state) {
    case 'idle':
      return null;

    case 'validating':
    case 'publishing':
    case 'verifying':
      return <LoadingSpinner message={message} />;

    case 'awaiting_approval':
      return (
        <div style={containerStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛡️</div>
          <h3 style={titleStyle}>Approval Required</h3>
          <p style={messageStyle}>{message}</p>
          <p style={hintStyle}>
            Check Qortium Home for the approval dialog. Once approved, publishing will continue automatically.
          </p>
        </div>
      );

    case 'success':
      return (
        <div style={containerStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h3 style={{ ...titleStyle, color: '#16a34a' }}>Published!</h3>
          <p style={messageStyle}>{message}</p>
          {publishedName && publishedVideoId && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button onClick={onViewVideo} style={primaryButtonStyle}>
                View Video
              </button>
              <button onClick={onReset} style={secondaryButtonStyle}>
                Publish Another
              </button>
            </div>
          )}
        </div>
      );

    case 'approval_denied':
      return (
        <div style={containerStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚫</div>
          <h3 style={{ ...titleStyle, color: '#f59e0b' }}>Publishing Cancelled</h3>
          <p style={messageStyle}>{message}</p>
          {error && <p style={hintStyle}>{error}</p>}
          <button onClick={onReset} style={{ ...primaryButtonStyle, marginTop: '0.75rem' }}>
            Try Again
          </button>
        </div>
      );

    case 'error':
      return (
        <ErrorMessage
          message={error ?? message}
          onRetry={onReset}
        />
      );

    default:
      return null;
  }
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem',
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  margin: 0,
  marginBottom: '0.5rem',
};

const messageStyle: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: '#374151',
  margin: 0,
  maxWidth: 400,
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
  marginTop: '0.5rem',
  maxWidth: 400,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  backgroundColor: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
};
