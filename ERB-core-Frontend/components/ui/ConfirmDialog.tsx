'use client';

import { useConfirm } from '@/lib/hooks/use-toast';
import { BaseModal } from './base/BaseModal';
import { Button } from './Button';

export default function ConfirmDialog() {
  const { confirmState, handleConfirm, handleCancel } = useConfirm();

  if (!confirmState || !confirmState.isOpen) return null;

  return (
    <BaseModal
      isOpen={confirmState.isOpen}
      onClose={handleCancel}
      title="Confirm Action"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </>
      }
    >
      <p 
        className="text-sm" 
        style={{ color: 'var(--text-secondary)' }}
      >
        {confirmState.message}
      </p>
    </BaseModal>
  );
}
