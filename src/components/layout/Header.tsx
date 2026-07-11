// Video Center — top header with search and publish
// Canonical layout pattern: q-iffi-vaba-mees + Discussion Boards

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  onSearch: (query: string) => void;
};

export const Header = ({ onSearch }: Props) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0.5rem 1rem',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#fff',
      gap: '1rem',
      height: 56,
    }}>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#6366f1',
        whiteSpace: 'nowrap',
      }}>
        <span role="img" aria-label="Video Center">🎬</span> Video Center
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 480 }}>
        <input
          type="text"
          placeholder="Search videos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
      </form>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        color: '#6b7280',
        fontSize: '0.8125rem',
        alignItems: 'center',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: 6,
            backgroundColor: '#f3f4f6',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            color: '#374151',
          }}
        >
          Fresh
        </button>
        <button
          onClick={() => navigate('/following')}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            color: '#6366f1',
            background: 'none',
            fontWeight: 500,
          }}
        >
          Following
        </button>
      </div>

      <button
        onClick={() => navigate('/publish')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          marginLeft: '0.5rem',
        }}
      >
        + Publish
      </button>
    </header>
  );
};
