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

  const isIdle = publishState === 'idle' || publishState === 'error' || publishState === 'approval_denied';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) errs.title = 'Title is required.';
    else if (title.length > 200) errs.title = 'Title must be 200 characters or fewer.';

    if (!description.trim()) errs.description = 'Description is required.';
    else if (description.length > 5000) errs.description = 'Description must be 5000 characters or fewer.';

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
    <form onSubmit={handleSubmit} style={{
      maxWidth: 600,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Publish a Video</h2>

      {/* Publishing name */}
      <div>
        <label style={labelStyle}>Publishing as</label>
        <select
          value={selectedName}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!isIdle || disabled}
          style={inputStyle}
        >
          {accountNames.length === 0 && (
            <option value="">No registered names available</option>
          )}
          {accountNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {accountNames.length === 0 && (
          <p style={hintStyle}>You need a registered Qortium name to publish. Register one in Qortium Home first.</p>
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
          style={inputStyle}
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
          style={{ ...inputStyle, resize: 'vertical' }}
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
          style={inputStyle}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
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
          style={inputStyle}
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
          style={{ ...inputStyle, maxWidth: 120 }}
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
          style={inputStyle}
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
          style={inputStyle}
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
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: isIdle && accountNames.length > 0 ? '#6366f1' : '#d1d5db',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: isIdle && accountNames.length > 0 ? 'pointer' : 'not-allowed',
          fontSize: '1rem',
          fontWeight: 600,
        }}
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
  color: '#374151',
  marginBottom: '0.25rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: '0.875rem',
  outline: 'none',
  backgroundColor: '#fff',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#6b7280',
  marginTop: '0.25rem',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  marginTop: '0.25rem',
};
