// Video Center — publish status display

import type { PublishProgress } from '../../types/video';
import { LoadingSpinner, ErrorMessage } from '../shared/LoadingSpinner';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '2rem',
  textAlign: 'center',
};

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
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-strong)' }}>Approval Required</h3>
          <p className="text-[0.9375rem] max-w-[400px] m-0 mb-1" style={{ color: 'var(--text-muted)' }}>{message}</p>
          <p className="text-[0.8125rem] max-w-[400px]" style={{ color: 'var(--text-muted)' }}>
            Check Qortium Home for the approval dialog. Once approved, publishing will continue
            automatically.
          </p>
        </div>
      );

    case 'success':
      return (
        <div style={containerStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--brand-primary-600)' }}>Published!</h3>
          <p className="text-[0.9375rem] max-w-[400px] m-0" style={{ color: 'var(--text-muted)' }}>{message}</p>
          {publishedName && publishedVideoId && (
            <div className="flex gap-2 mt-3">
              <button onClick={onViewVideo} className="vc-btn-primary">
                View Video
              </button>
              <button onClick={onReset} className="vc-btn-secondary">
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
          <h3 className="text-lg font-bold mb-2" style={{ color: '#f59e0b' }}>Publishing Cancelled</h3>
          <p className="text-[0.9375rem] max-w-[400px] m-0" style={{ color: 'var(--text-muted)' }}>{message}</p>
          {error && <p className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>{error}</p>}
          <button onClick={onReset} className="vc-btn-primary mt-3">
            Try Again
          </button>
        </div>
      );

    case 'error':
      return <ErrorMessage message={error ?? message} onRetry={onReset} />;

    default:
      return null;
  }
};
