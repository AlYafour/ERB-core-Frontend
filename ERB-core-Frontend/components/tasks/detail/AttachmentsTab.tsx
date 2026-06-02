'use client';

import type { TaskDetail } from '@/types';
import { fmtFileSize } from '../shared/constants';

interface Props {
  attachments: TaskDetail['attachments'];
  onUpload: (file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AttachmentsTab({ attachments, onUpload, onDelete, uploading, fileInputRef }: Props) {
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onUpload(file); e.target.value = ''; }
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="attachment-upload-btn"
      >
        {uploading ? 'Uploading…' : 'Attach a file'}
      </button>

      {attachments.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '20px 0', margin: 0 }}>
          No attachments yet
        </p>
      ) : (
        <div className="attachment-list">
          {attachments.map((a) => (
            <div key={a.id} className="attachment-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="attachment-name">{a.file_name}</p>
                <p className="attachment-meta">
                  {fmtFileSize(a.file_size)}
                  {a.uploaded_by_detail && ` · ${a.uploaded_by_detail.full_name}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {a.file_url && (
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attachment-download"
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => onDelete(a.id)}
                  className="attachment-delete-btn"
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
