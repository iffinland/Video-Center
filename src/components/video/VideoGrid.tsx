// Video Center — video grid

import type { SearchResultItem } from '../../types/video';
import { VideoCard } from './VideoCard';

type Props = {
  videos: SearchResultItem[];
  onVideoClick: (item: SearchResultItem) => void;
};

export const VideoGrid = ({ videos, onVideoClick }: Props) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem',
    }}>
      {videos.map((item) => (
        <VideoCard
          key={`${item.name}-${item.identifier}`}
          item={item}
          onClick={() => onVideoClick(item)}
        />
      ))}
    </div>
  );
};
