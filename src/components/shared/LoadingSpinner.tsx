import type { ReactNode } from 'react';

type Props = {
  message?: string;
};

export const LoadingSpinner = ({ message = 'Loading…' }: Props) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
  }}>
    <div style={{
      width: 36,
      height: 36,
      border: '3px solid #e5e7eb',
      borderTopColor: '#6366f1',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{message}</span>
  </div>
);

type ErrorProps = {
  message: string;
  onRetry?: () => void;
};

export const ErrorMessage = ({ message, onRetry }: ErrorProps) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '0.75rem',
  }}>
    <div style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      backgroundColor: '#fef2f2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ef4444',
      fontSize: '1.25rem',
    }}>
      !
    </div>
    <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', maxWidth: 400 }}>
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Retry
      </button>
    )}
  </div>
);

type EmptyProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export const EmptyState = ({
  title = 'Nothing here yet',
  description = 'Check back later for new content.',
  children,
}: EmptyProps) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    gap: '0.75rem',
    color: '#9ca3af',
  }}>
    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
        <line x1="17" y1="17" x2="22" y2="17" />
      </svg>
    </div>
    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#6b7280', margin: 0 }}>{title}</h3>
    <p style={{ fontSize: '0.875rem', textAlign: 'center', maxWidth: 400, margin: 0 }}>
      {description}
    </p>
    {children}
  </div>
);
