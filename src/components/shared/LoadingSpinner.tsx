import type { ReactNode } from 'react';

type Props = {
  message?: string;
};

export const LoadingSpinner = ({ message = 'Loading…' }: Props) => (
  <div className="flex flex-col items-center justify-center py-12 gap-4">
    <div
      className="w-9 h-9 border-[3px] rounded-full animate-spin"
      style={{ borderColor: 'var(--line-subtle)', borderTopColor: 'var(--brand-primary-500)' }}
    />
    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
      {message}
    </span>
  </div>
);

type ErrorProps = {
  message: string;
  onRetry?: () => void;
};

export const ErrorMessage = ({ message, onRetry }: ErrorProps) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-red-500 text-xl"
      style={{ backgroundColor: 'color-mix(in srgb, #ef4444 15%, transparent)' }}
    >
      !
    </div>
    <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
      {message}
    </p>
    {onRetry && (
      <button onClick={onRetry} className="vc-btn-primary">
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

export const EmptyState = ({ title, description, children }: EmptyProps) => (
  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
    {title && (
      <h2 className="text-lg font-bold" style={{ color: 'var(--text-strong)' }}>
        {title}
      </h2>
    )}
    {description && (
      <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    )}
    {children}
  </div>
);
