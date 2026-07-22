// Video Center — V2 comment list

import { useState } from 'react';
import type { CommentCreate } from '../../services/architectureV2/types';
import type { AccountProfile } from '../../types/video';
import { CommentForm } from './CommentForm';

type Props = {
  comments: CommentCreate[];
  account: AccountProfile | null;
  onAdd: (body: string) => Promise<void>;
  onEdit: (comment: CommentCreate, newBody: string) => Promise<void>;
  disabled?: boolean;
};

export const CommentList = ({ comments, account, onAdd, onEdit, disabled }: Props) => {
  const canComment = account && account.names.length > 0;
  const [editingId, setEditingId] = useState<string | null>(null);

  const isOwnComment = (comment: CommentCreate) =>
    account?.names.includes(comment.publisherName) ?? false;

  return (
    <div>
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          marginBottom: '1rem',
        }}
      >
        Comments ({comments.length})
      </h3>

      {/* New comment form */}
      {canComment ? (
        <CommentForm onSubmit={onAdd} disabled={disabled} placeholder="Share your thoughts…" />
      ) : (
        <p
          style={{
            color: '#6b7280',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          {account
            ? 'You need a registered Qortium name to comment.'
            : 'Unlock or select an account in Qortium Home to comment.'}
        </p>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p
          style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}
        >
          No comments yet. Be the first!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comments.map((comment) => (
            <div
              key={comment.entityId}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
              }}
            >
              {editingId === comment.entityId ? (
                <CommentForm
                  onSubmit={async (body) => {
                    await onEdit(comment, body);
                    setEditingId(null);
                  }}
                  initialBody={comment.body}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                />
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.375rem',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: '#6366f1',
                      }}
                    >
                      {comment.publisherName}
                    </span>
                    {isOwnComment(comment) && (
                      <button
                        onClick={() => setEditingId(comment.entityId)}
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {comment.body}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
