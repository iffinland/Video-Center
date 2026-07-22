// Video Center — V2 video grid (Tailwind)

import type { VideoCreate } from '../../services/architectureV2/types';
import { VideoCard } from './VideoCard';

type Props = {
  videos: VideoCreate[];
  onVideoClick: (item: VideoCreate) => void;
};

export const VideoGrid = ({ videos, onVideoClick }: Props) => {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
    >
      {videos.map((video) => (
        <VideoCard
          key={`${video.publisherName}-${video.entityId}`}
          video={video}
          onClick={() => onVideoClick(video)}
        />
      ))}
    </div>
  );
};
