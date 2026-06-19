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

// Extensions Cloudinary can render natively as images — everything else is a document
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']);

function _ext(fileName: string) {
  const parts = fileName.split('.');
  return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '';
}

/**
 * Fix Cloudinary URLs for non-image files stored under the wrong resource type.
 * MediaCloudinaryStorage (the Django default) uploads everything as `image/upload`.
 * PDFs/DOCs stored that way must have their extension appended so Cloudinary serves
 * the original file instead of trying to render it as an image.
 */
function fixCloudinaryUrl(url: string, fileName: string): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const ext = _ext(fileName);
  if (ext && !IMAGE_EXTS.has(ext) && url.includes('/image/upload/') && !url.endsWith(ext)) {
    return url + ext;
  }
  return url;
}

/** View URL — serves the original file inline (PDF opens in browser, images display). */
function toViewUrl(url: string, fileName: string): string {
  return fixCloudinaryUrl(url, fileName);
}

/**
 * Download URL — forces Content-Disposition: attachment with the correct filename.
 * Uses fl_attachment:filename so Cloudinary sets the right filename in the header
 * (the HTML `download` attribute is ignored for cross-origin URLs).
 */
function toDownloadUrl(url: string, fileName: string): string {
  const fixed = fixCloudinaryUrl(url, fileName);
  if (fixed.includes('res.cloudinary.com') && fixed.includes('/upload/')) {
    const safe = encodeURIComponent(fileName);
    return fixed.replace('/upload/', `/upload/fl_attachment:${safe}/`);
  }
  return fixed;
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
                      href={toViewUrl(a.file_url, a.file_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-download"
                    >
                      View
                    </a>
                    <a
                      href={toDownloadUrl(a.file_url, a.file_name)}
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
