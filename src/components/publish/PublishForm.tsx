// Video Center — publish form
// DeepSeek handoff: UI-only component. Qortium calls go through typed hooks.

import { useState } from 'react';
import type { PublishState } from '../../types/video';
import { MEDIA_LIMITS, formatBytes } from '../../types/video';

type FormData = {
  title: string;
  description: string;
  category: string;
  tags: string;
  language: string;
  videoFile: File | null;
  thumbnailFile: File | null;
};

type Props = {
  accountNames: string[];
  selectedName: string;
  onNameChange: (name: string) => void;
  onSubmit: (data: FormData) => void;
  publishState: PublishState;
  disabled: boolean;
};

const CATEGORIES = [
  'Education',
  'Entertainment',
  'Music',
  'Gaming',
  'Technology',
  'News',
  'Sports',
  'Tutorial',
  'Vlog',
  'Other',
];

export const PublishForm = ({
  accountNames,
  selectedName,
  onNameChange,
  onSubmit,
  publishState,
  disabled,
}: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('en');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isIdle =
    publishState === 'idle' || publishState === 'error' || publishState === 'approval_denied';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) errs.title = 'Title is required.';
    else if (title.length > 200) errs.title = 'Title must be 200 characters or fewer.';

    if (!description.trim()) errs.description = 'Description is required.';
    else if (description.length > 5000)
      errs.description = 'Description must be 5000 characters or fewer.';

    if (!videoFile) errs.videoFile = 'A video file is required.';
    else if (videoFile.size > MEDIA_LIMITS.video.maxBytes) {
      errs.videoFile = `Video too large. Max ${formatBytes(MEDIA_LIMITS.video.maxBytes)}.`;
    } else if (!MEDIA_LIMITS.video.acceptedTypes.includes(videoFile.type)) {
      errs.videoFile = `Unsupported format. Accepted: MP4, WebM.`;
    }

    if (!thumbnailFile) errs.thumbnailFile = 'A thumbnail is required.';
    else if (thumbnailFile.size > MEDIA_LIMITS.thumbnail.maxBytes) {
      errs.thumbnailFile = `Thumbnail too large. Max ${formatBytes(MEDIA_LIMITS.thumbnail.maxBytes)}.`;
    } else if (!MEDIA_LIMITS.thumbnail.acceptedTypes.includes(thumbnailFile.type)) {
      errs.thumbnailFile = `Unsupported format. Accepted: JPEG, PNG, WebP.`;
    }

    if (tags.split(',').filter(Boolean).length > 10) {
      errs.tags = 'Maximum 10 tags.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      tags: tags.trim(),
      language: language.trim(),
      videoFile,
      thumbnailFile,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 600,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <h2 className="text-xl font-bold mb-0" style={{ color: 'var(--text-strong)' }}>Publish a Video</h2>

      {/* Publishing name */}
      <div>
        <label style={labelStyle}>Publishing as</label>
        <select
          value={selectedName}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!isIdle || disabled}
          className="vc-input"
        >
          {accountNames.length === 0 && <option value="">No registered names available</option>}
          {accountNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {accountNames.length === 0 && (
          <p style={hintStyle}>
            You need a registered Qortium name to publish. Register one in Qortium Home first.
          </p>
        )}
      </div>

      {/* Title */}
      <div>
        <label style={labelStyle}>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!isIdle || disabled}
          placeholder="Enter video title…"
          maxLength={200}
          className="vc-input"
        />
        {errors.title && <p style={errorStyle}>{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!isIdle || disabled}
          placeholder="Describe your video…"
          maxLength={5000}
          rows={4}
          className="vc-input"
          style={{ resize: 'vertical' }}
        />
        {errors.description && <p style={errorStyle}>{errors.description}</p>}
      </div>

      {/* Category */}
      <div>
        <label style={labelStyle}>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!isIdle || disabled}
          className="vc-input"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label style={labelStyle}>Tags (comma-separated, max 10)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          disabled={!isIdle || disabled}
          placeholder="tutorial, qortium, blockchain"
          className="vc-input"
        />
        {errors.tags && <p style={errorStyle}>{errors.tags}</p>}
      </div>

      {/* Language */}
      <div>
        <label style={labelStyle}>Language</label>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={!isIdle || disabled}
          placeholder="en"
          maxLength={10}
          className="vc-input"
          style={{ maxWidth: 120 }}
        />
      </div>

      {/* Video file */}
      <div>
        <label style={labelStyle}>Video file *</label>
        <input
          type="file"
          accept="video/mp4,video/webm"
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          disabled={!isIdle || disabled}
          className="vc-input"
        />
        {videoFile && (
          <p style={hintStyle}>
            {videoFile.name} — {formatBytes(videoFile.size)}
          </p>
        )}
        {errors.videoFile && <p style={errorStyle}>{errors.videoFile}</p>}
      </div>

      {/* Thumbnail file */}
      <div>
        <label style={labelStyle}>Thumbnail image *</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
          disabled={!isIdle || disabled}
          className="vc-input"
        />
        {thumbnailFile && (
          <p style={hintStyle}>
            {thumbnailFile.name} — {formatBytes(thumbnailFile.size)}
          </p>
        )}
        {errors.thumbnailFile && <p style={errorStyle}>{errors.thumbnailFile}</p>}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isIdle || disabled || accountNames.length === 0}
        className="vc-btn-primary w-full"
      >
        Publish Video
      </button>
    </form>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
  marginBottom: '0.25rem',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginTop: '0.25rem',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  marginTop: '0.25rem',
};
