'use client';

import { useState } from 'react';
import type { TaskDetail } from '@/types';
import { fmtFileSize } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { taskAttachmentsApi } from '@/lib/api/tasks';

const MAX_MB = 25;

async function openFile(attachmentId: number, fileName: string, asDownload = false) {
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
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    if (newWin) newWin.close();
    toast('Could not open file.', 'error');
  }
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
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

interface PreviewItem {
  id: number;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'other';
}

function FilePreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => openFile(item.id, item.name, true)}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
            >
              ↓ Download
            </button>
            <button
              onClick={onClose}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          {item.type === 'image' ? (
            <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '80vh' }} />
          ) : item.type === 'pdf' ? (
            <iframe src={item.url} style={{ width: '100%', height: '80vh', border: 'none' }} title={item.name} />
          ) : (
            <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 48 }}>📎</span>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Preview not available for this file type.</p>
              <button onClick={() => openFile(item.id, item.name, true)} className="task-btn task-btn--primary">
                Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  attachments: TaskDetail['attachments'];
  onUpload: (file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AttachmentsTab({ attachments, onUpload, onDelete, uploading, fileInputRef }: Props) {
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<number | null>(null);

  async function handlePreview(attachmentId: number, fileName: string) {
    setLoadingPreview(attachmentId);
    try {
      const blob = await taskAttachmentsApi.download(attachmentId);
      const url = URL.createObjectURL(blob);
      const type = isImage(fileName) ? 'image' : isPdf(fileName) ? 'pdf' : 'other';
      setPreview({ id: attachmentId, name: fileName, url, type });
    } catch {
      toast('Could not load preview.', 'error');
    } finally {
      setLoadingPreview(null);
    }
  }

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
                      onClick={() => handlePreview(a.id, a.file_name)}
                      disabled={loadingPreview === a.id}
                    >
                      {loadingPreview === a.id ? '…' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      className="attachment-download"
                      onClick={() => openFile(a.id, a.file_name)}
                    >
                      ↗
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

      {preview && (
        <FilePreviewModal
          item={preview}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}
