// Video Center — comment form with edit support

import { useState } from 'react';

type Props = {
  onSubmit: (body: string) => Promise<void>;
  initialBody?: string;
  onCancel?: () => void;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

export const CommentForm = ({
  onSubmit,
  initialBody = '',
  onCancel,
  disabled = false,
  placeholder = 'Write a comment…',
  submitLabel = 'Post Comment',
}: Props) => {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!onCancel;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      {error && (
        <p
          style={{
            color: '#ef4444',
            fontSize: '0.8125rem',
            marginBottom: '0.5rem',
          }}
        >
          {error}
        </p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled || submitting}
        placeholder={placeholder}
        maxLength={2000}
        rows={3}
        style={{
          width: '100%',
          padding: '0.625rem 0.75rem',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: '0.875rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          marginBottom: '0.5rem',
        }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={disabled || submitting || !body.trim()}
          style={{
            padding: '0.375rem 1rem',
            backgroundColor: submitting || !body.trim() ? '#d1d5db' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: submitting || !body.trim() ? 'not-allowed' : 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {submitting ? 'Posting…' : submitLabel}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Cancel
          </button>
        )}
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
          {body.length}/2000
        </span>
      </div>
    </form>
  );
};
