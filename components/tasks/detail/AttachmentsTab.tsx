'use client';

import type { TaskDetail } from '@/types';
import { fmtFileSize } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';

const MAX_MB = 25;
const ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.zip', '.rar', '.7z',
  '.mp4', '.mov', '.avi',
  '.ppt', '.pptx',
]);

function toDownloadUrl(url: string): string {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
}

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
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_MB * 1024 * 1024) {
            toast(`File exceeds ${MAX_MB} MB limit`, 'error');
            return;
          }
          const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
          if (!ALLOWED_EXTS.has(ext)) {
            toast(`File type "${ext}" is not allowed`, 'error');
            return;
          }
          onUpload(file);
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
              <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(a.file_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="attachment-name">{a.file_name}</p>
                <p className="attachment-meta">
                  {fmtFileSize(a.file_size)}
                  {a.uploaded_by_detail && ` · ${a.uploaded_by_detail.full_name}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {a.file_url && (
                  <>
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-download"
                    >
                      View
                    </a>
                    <a
                      href={toDownloadUrl(a.file_url)}
                      download={a.file_name}
                      rel="noopener noreferrer"
                      className="attachment-download"
                    >
                      ↓
                    </a>
                  </>
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
