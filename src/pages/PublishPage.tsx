// Video Center — publish page

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { usePublish } from '../hooks/usePublish';
import { PublishForm } from '../components/publish/PublishForm';
import { PublishStatus } from '../components/publish/PublishStatus';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

export const PublishPage = () => {
  const navigate = useNavigate();
  const { account, loading: accountLoading, error: accountError, hasBridge } = useAccount();
  const { progress, publish, reset } = usePublish();
  const [selectedName, setSelectedName] = useState('');

  // Set initial selected name when account loads
  if (account && !selectedName && account.names.length > 0) {
    setSelectedName(account.name);
  }

  const handleSubmit = useCallback(
    (data: {
      title: string;
      description: string;
      category: string;
      tags: string;
      language: string;
      videoFile: File | null;
      thumbnailFile: File | null;
    }) => {
      if (!data.videoFile || !data.thumbnailFile) return;

      const tagList = data.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      publish(
        {
          ownerName: selectedName,
          title: data.title,
          description: data.description,
          category: data.category,
          tags: tagList,
          videoFile: data.videoFile,
          thumbnailFile: data.thumbnailFile,
          language: data.language,
        },
        account?.names ?? [],
      );
    },
    [publish, selectedName, account?.names],
  );

  const handleViewVideo = useCallback(() => {
    if (progress.publishedName && progress.publishedVideoId) {
      navigate(
        `/video/${encodeURIComponent(progress.publishedName)}/${encodeURIComponent(progress.publishedVideoId)}`,
      );
    }
  }, [navigate, progress.publishedName, progress.publishedVideoId]);

  // No bridge — show message
  if (!hasBridge && !accountLoading) {
    return (
      <div style={pageStyle}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Publishing Requires Qortium Home
          </h2>
          <p style={{ color: '#6b7280', maxWidth: 420, margin: '0 auto' }}>
            Open Video Center inside Qortium Home to publish videos.
            Browser development mode supports read-only browsing only.
          </p>
        </div>
      </div>
    );
  }

  // Loading account
  if (accountLoading) {
    return (
      <div style={pageStyle}>
        <LoadingSpinner message="Loading account information…" />
      </div>
    );
  }

  // Account error
  if (accountError) {
    return (
      <div style={pageStyle}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#fff',
          borderRadius: 12,
          border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Account Required
          </h2>
          <p style={{ color: '#6b7280', maxWidth: 420, margin: '0 auto' }}>
            Unlock or select an account in Qortium Home to publish videos.
          </p>
          <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            {accountError}
          </p>
        </div>
      </div>
    );
  }

  // No registered names
  if (account && account.names.length === 0) {
    return (
      <div style={pageStyle}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📛</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Registered Name Required
          </h2>
          <p style={{ color: '#6b7280', maxWidth: 420, margin: '0 auto' }}>
            You need a registered Qortium name to publish videos.
            Register a name in Qortium Home first, then return here.
          </p>
        </div>
      </div>
    );
  }

  const isPublishing =
    progress.state !== 'idle' &&
    progress.state !== 'error' &&
    progress.state !== 'approval_denied';

  return (
    <div style={pageStyle}>
      {isPublishing ? (
        <PublishStatus
          progress={progress}
          onReset={reset}
          onViewVideo={handleViewVideo}
        />
      ) : (
        <PublishForm
          accountNames={account?.names ?? []}
          selectedName={selectedName}
          onNameChange={setSelectedName}
          onSubmit={handleSubmit}
          publishState={progress.state}
          disabled={false}
        />
      )}
    </div>
  );
};

const pageStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '1rem',
};
