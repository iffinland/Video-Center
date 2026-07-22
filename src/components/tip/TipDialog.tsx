// Video Center — tip dialog (modal)

import { useState } from 'react';

type Props = {
  recipientName: string;
  sending: boolean;
  error: string | null;
  success: boolean;
  onSend: (amount: number) => void;
  onClose: () => void;
  onReset: () => void;
};

export const TipDialog = ({
  recipientName,
  sending,
  error,
  success,
  onSend,
  onClose,
  onReset,
}: Props) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    onSend(parsed);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: '1.5rem',
          maxWidth: 380,
          width: '90%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Tip Sent!
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {amount} QORT sent to {recipientName}.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Send Tip</h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1rem' }}>
              Send QORT to <strong>{recipientName}</strong>
            </p>

            {error && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: 6,
                  color: '#ef4444',
                  fontSize: '0.8125rem',
                  marginBottom: '0.75rem',
                }}
              >
                {error}
                <button
                  onClick={onReset}
                  style={{
                    marginLeft: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.375rem',
                }}
              >
                Amount (QORT)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.000001"
                  step="0.000001"
                  disabled={sending}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !amount || parseFloat(amount) <= 0}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor:
                      sending || !amount || parseFloat(amount) <= 0 ? '#d1d5db' : '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor:
                      sending || !amount || parseFloat(amount) <= 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sending ? 'Sending…' : 'Send Tip'}
                </button>
              </div>
            </form>

            <p style={{ color: '#9ca3af', fontSize: '0.6875rem', lineHeight: 1.4 }}>
              This will open an approval dialog in Qortium Home. The tip is sent directly to the
              creator&apos;s wallet address.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
