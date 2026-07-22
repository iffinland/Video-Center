// Video Center — top header with search and publish
// Uses Tailwind utility classes + CSS custom properties

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
    <header
      className="flex items-center gap-4 px-4 h-14 border-b"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--line-subtle)',
        color: 'var(--text-strong)',
      }}
    >
      <button
        onClick={() => navigate('/')}
        className="vc-btn-ghost flex items-center gap-1 text-lg font-bold whitespace-nowrap"
        title="Home"
      >
        <span role="img" aria-label="Video Center">
          🎬
        </span>{' '}
        Video Center
      </button>

      <form onSubmit={handleSubmit} className="flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search videos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="vc-input"
        />
      </form>

      <div className="flex gap-2 items-center text-sm">
        <button onClick={() => navigate('/')} className="vc-btn-ghost">
          🏠 Home
        </button>
        <button onClick={() => navigate('/following')} className="vc-btn-ghost">
          Following
        </button>
        <button onClick={() => navigate('/publish')} className="vc-btn-primary">
          + Publish
        </button>
      </div>
    </header>
  );
};
