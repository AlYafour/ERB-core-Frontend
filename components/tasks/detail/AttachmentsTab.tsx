'use client';

import type { TaskDetail } from '@/types';
import { fmtFileSize } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';

const MAX_MB = 50;

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

/** Returns the clean Cloudinary URL (fixes image/upload → appends extension for non-images). */
function fixedUrl(url: string, fileName: string): string {
  return fixCloudinaryUrl(url, fileName);
}

/**
 * Open or download a file.
 * - Cloudinary URLs: open directly via window.open (public CDN, no CORS fetch needed).
 * - Django media URLs: fetch with Bearer token → blob URL to bypass 401.
 */
async function openFile(url: string, fileName: string, asDownload = false) {
  if (url.includes('res.cloudinary.com')) {
    window.open(url, '_blank');
    return;
  }
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    if (asDownload) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } else {
      window.open(blobUrl, '_blank');
    }
  } catch {
    toast('Could not open file.', 'error');
  }
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
                    <button
                      type="button"
                      className="attachment-download"
                      onClick={() => openFile(fixedUrl(a.file_url!, a.file_name), a.file_name)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="attachment-download"
                      onClick={() => openFile(fixedUrl(a.file_url!, a.file_name), a.file_name, true)}
                    >
                      ↓
                    </button>
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
