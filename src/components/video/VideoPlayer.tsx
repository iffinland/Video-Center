// Video Center — HTML5 video player

type Props = {
  src: string;
  mimeType?: string;
  poster?: string;
};

export const VideoPlayer = ({ src, mimeType, poster }: Props) => {
  if (!src) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#1f2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        borderRadius: 10,
      }}>
        <p>Video source unavailable</p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16 / 9',
      backgroundColor: '#000',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <video
        controls
        src={src}
        poster={poster || undefined}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        preload="metadata"
      >
        {mimeType && <source src={src} type={mimeType} />}
        Your browser does not support the video tag.
      </video>
    </div>
  );
};
