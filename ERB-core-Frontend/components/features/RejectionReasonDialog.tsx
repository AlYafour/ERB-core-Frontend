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
}

export default function RejectionReasonDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Reject Request',
  message = 'Please provide a reason for rejecting this request:',
}: RejectionReasonDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

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
            variant="destructive"
            disabled={!reason.trim()}
            onClick={handleSubmit}
          >
            Reject
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter rejection reason..."
          required
          rows={4}
          autoFocus
        />
      </form>
    </BaseModal>
  );
}

