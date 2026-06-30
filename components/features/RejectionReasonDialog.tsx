'use client';

import { useState, useEffect } from 'react';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface RejectionReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'destructive' | 'success';
  requireText?: boolean;
}

export default function RejectionReasonDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Reject Request',
  message = 'Please provide a reason for rejecting this request:',
  placeholder = 'Enter rejection reason...',
  confirmLabel = 'Reject',
  confirmVariant = 'destructive',
  requireText = true,
}: RejectionReasonDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireText || reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const canSubmit = !requireText || !!reason.trim();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          required={requireText}
          rows={4}
          autoFocus
        />
      </form>
    </BaseModal>
  );
}

