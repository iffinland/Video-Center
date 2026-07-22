// Video Center — V2 video card (Tailwind)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VideoCreate } from '../../services/architectureV2/types';
import { getQdnResourceUrl } from '../../services/qdn/qdnService';

type Props = {
  video: VideoCreate;
  onClick: () => void;
};

const ThumbnailPlaceholder = () => (
  <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-gray-400 text-2xl">
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  </div>
);

export const VideoCard = ({ video, onClick }: Props) => {
  const navigate = useNavigate();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ref = video.thumbnailReference;
    if (!ref || !ref.service || !ref.name || !ref.identifier) return;

    getQdnResourceUrl(ref)
      .then((url) => {
        if (!cancelled && url) setThumbnailUrl(url);
      })
      .catch(() => {
        if (!cancelled) setThumbnailFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [video.thumbnailReference]);

  const showThumbnail = thumbnailUrl && !thumbnailFailed;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      className="vc-card overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
    >
      {/* Thumbnail */}
      {showThumbnail ? (
        <div className="w-full aspect-video bg-gray-900">
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={() => setThumbnailFailed(true)}
          />
        </div>
      ) : (
        <ThumbnailPlaceholder />
      )}

      <div className="p-3">
        <div
          className="font-semibold text-[0.9375rem] mb-1 line-clamp-2"
          style={{ color: 'var(--text-strong)' }}
        >
          {video.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/channel/${encodeURIComponent(video.publisherName)}`);
          }}
          className="vc-link text-[0.8125rem] mb-0.5 text-left"
        >
          {video.publisherName}
        </button>
        <div className="flex justify-between items-center text-xs vc-text-muted">
          <span>Published</span>
          {video.description && (
            <span className="max-w-[60%] truncate">{video.description.slice(0, 60)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
