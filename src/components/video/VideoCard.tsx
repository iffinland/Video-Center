// Video Center — video card for grid display

import { useNavigate } from 'react-router-dom';
import type { SearchResultItem } from '../../types/video';

type Props = {
  item: SearchResultItem;
  onClick: () => void;
};

const getMetadataString = (item: SearchResultItem, key: string): string => {
  // SEARCH_QDN_RESOURCES with includeMetadata may embed metadata fields
  const meta = (item as Record<string, unknown>).metadata;
  if (meta && typeof meta === 'object') {
    const val = (meta as Record<string, unknown>)[key];
    if (typeof val === 'string') return val.trim();
  }
  // Fallback to top-level fields
  const direct = (item as Record<string, unknown>)[key];
  return typeof direct === 'string' ? direct.trim() : '';
};

export const VideoCard = ({ item, onClick }: Props) => {
  const navigate = useNavigate();
  const title = getMetadataString(item, 'title') || item.identifier;
  const creator = item.name;
  const description = getMetadataString(item, 'description');

  const formatTimestamp = (ts: number | undefined) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      style={{
        cursor: 'pointer',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Thumbnail placeholder */}
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#1f2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontSize: '1.5rem',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
        </svg>
      </div>

      <div style={{ padding: '0.75rem' }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.9375rem',
          marginBottom: '0.25rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/channel/${encodeURIComponent(creator)}`);
          }}
          style={{
            color: '#6366f1',
            fontSize: '0.8125rem',
            marginBottom: '0.125rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontWeight: 500,
            textAlign: 'left',
          }}
        >
          {creator}
        </button>
        <div style={{
          color: '#9ca3af',
          fontSize: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>{formatTimestamp(item.updated ?? item.created)}</span>
          {description && (
            <span style={{
              maxWidth: '60%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
