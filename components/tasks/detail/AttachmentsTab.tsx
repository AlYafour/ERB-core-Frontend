'use client';

import type { TaskDetail } from '@/types';
import { fmtFileSize } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { taskAttachmentsApi } from '@/lib/api/tasks';

const MAX_MB = 25;

/**
 * Fetch the file through the backend proxy (which sets correct Content-Type)
 * and open or download it via a blob URL.
 */
async function openFile(attachmentId: number, fileName: string, asDownload = false) {
  // Open blank window BEFORE the async call — popup blockers only allow window.open
  // from synchronous (direct click) context, not from inside an awaited promise.
  const newWin = asDownload ? null : window.open('', '_blank');
  try {
    const blob = await taskAttachmentsApi.download(attachmentId);
    const blobUrl = URL.createObjectURL(blob);
    if (asDownload) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
    } else if (newWin) {
      newWin.location.href = blobUrl;
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    if (newWin) newWin.close();
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
                      onClick={() => openFile(a.id, a.file_name)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="attachment-download"
                      onClick={() => openFile(a.id, a.file_name, true)}
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
