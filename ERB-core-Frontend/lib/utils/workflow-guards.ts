/**
 * Workflow Guards - Ensure proper workflow sequence
 * Now integrated with permissions system
 * 
 * Workflow Roles:
 * 1. Site Engineer: Create PR, Create GRN, Update GRN (add notes)
 * 2. Procurement Manager: Approve/Reject PR, Award Quotation, Approve/Reject PO
 * 3. Procurement Officer: Create QR, Enter prices, Create PO, Create Invoice
 * 4. Super Admin: All permissions including delete
 */

export interface WorkflowGuardResult {
  canProceed: boolean;
  reason?: string;
  warning?: string;
  permissionRequired?: { category: string; action: string };
}

/**
 * Enhanced workflow guard that checks both status AND permission
 */
export interface WorkflowGuardWithPermission {
  (status: string, hasPermission: boolean, ...args: any[]): WorkflowGuardResult;
}

/**
 * Check if Purchase Request can be converted to Quotation Request
 * Now checks both status AND permission
 */
export function canCreateQuotationRequest(
  prStatus: string,
  hasPermission?: boolean
): WorkflowGuardResult {
  // Check permission first
  if (hasPermission !== undefined && !hasPermission) {
    return {
      canProceed: false,
      reason: 'You do not have permission to create quotation requests.',
      permissionRequired: { category: 'quotation_request', action: 'create' },
    };
  }
  
  if (prStatus === 'rejected') {
    return {
      canProceed: false,
      reason: 'Cannot create quotation request from a rejected purchase request.',
    };
  }
  if (prStatus !== 'approved') {
    return {
      canProceed: false,
      reason: 'Purchase request must be approved before creating a quotation request.',
    };
  }
  return { canProceed: true };
}

/**
 * Check if Quotation Request can create Purchase Quotation
 */
export function canCreatePurchaseQuotation(qrExists: boolean): WorkflowGuardResult {
  if (!qrExists) {
    return {
      canProceed: false,
      reason: 'A quotation request must be created first.',
    };
  }
  return { canProceed: true };
}

/**
 * Check if Purchase Quotation can be awarded
 * Now checks both status AND permission
 */
export function canAwardQuotation(
  quotationStatus: string,
  validUntil?: string,
  hasPermission?: boolean
): WorkflowGuardResult {
  // Check permission first
  if (hasPermission !== undefined && !hasPermission) {
    return {
      canProceed: false,
      reason: 'You do not have permission to award quotations.',
      permissionRequired: { category: 'purchase_quotation', action: 'award' },
    };
  }
  
  if (quotationStatus === 'awarded') {
    return {
      canProceed: false,
      reason: 'This quotation has already been awarded.',
    };
  }
  
  if (quotationStatus === 'rejected') {
    return {
      canProceed: false,
      reason: 'Cannot award a rejected quotation.',
    };
  }
  
  if (quotationStatus === 'expired') {
    return {
      canProceed: false,
      reason: 'This quotation has expired.',
    };
  }
  
  if (quotationStatus === 'cancelled') {
    return {
      canProceed: false,
      reason: 'Cannot award a cancelled quotation.',
    };
  }
  
  // Check expiry date
  if (validUntil) {
    const validDate = new Date(validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (validDate < today) {
      return {
        canProceed: false,
        reason: `This quotation has expired. Valid until: ${new Date(validUntil).toLocaleDateString('en-US')}`,
      };
    }
  }
  
  return { canProceed: true };
}

/**
 * Check if Purchase Order can be created
 */
export function canCreatePurchaseOrder(
  quotationStatus?: string,
  prStatus?: string
): WorkflowGuardResult {
  // From Quotation
  if (quotationStatus) {
    if (quotationStatus === 'cancelled') {
      return {
        canProceed: false,
        reason: 'Cannot create purchase order from a cancelled quotation.',
      };
    }
    if (quotationStatus !== 'awarded') {
      return {
        canProceed: false,
        reason: 'Purchase order can only be created from an awarded quotation.',
      };
    }
    return { canProceed: true };
  }
  
  // From PR directly
  if (prStatus) {
    if (prStatus === 'rejected') {
      return {
        canProceed: false,
        reason: 'Cannot create purchase order from a rejected purchase request.',
      };
    }
    if (prStatus !== 'approved') {
      return {
        canProceed: false,
        reason: 'Purchase order can only be created from an approved purchase request.',
      };
    }
    return {
      canProceed: true,
      warning: 'You are creating a purchase order directly without a quotation. Ensure you have the final prices.',
    };
  }
  
  return { canProceed: true };
}

/**
 * Check if GRN can be created
 */
export function canCreateGRN(poStatus: string): WorkflowGuardResult {
  if (poStatus === 'cancelled') {
    return {
      canProceed: false,
      reason: 'Cannot create GRN from a cancelled purchase order.',
    };
  }
  
  if (poStatus !== 'approved') {
    return {
      canProceed: false,
      reason: 'GRN can only be created from an approved purchase order.',
    };
  }
  return { canProceed: true };
}

/**
 * Check if Invoice can be created
 */
export function canCreateInvoice(poStatus: string, grnExists?: boolean): WorkflowGuardResult {
  if (poStatus === 'cancelled') {
    return {
      canProceed: false,
      reason: 'Cannot create invoice from a cancelled purchase order.',
    };
  }
  
  if (poStatus !== 'approved') {
    return {
      canProceed: false,
      reason: 'Invoice can only be created from an approved purchase order.',
    };
  }
  
  if (grnExists === false) {
    return {
      canProceed: true,
      warning: 'No GRN has been created yet. You can create the invoice, but it is recommended to create a GRN first to record actual receipt.',
    };
  }
  
  return { canProceed: true };
}

/**
 * Check if Invoice can be approved
 */
export function canApproveInvoice(invoiceStatus: string): WorkflowGuardResult {
  if (invoiceStatus === 'approved') {
    return {
      canProceed: false,
      reason: 'This invoice has already been approved.',
    };
  }
  
  if (invoiceStatus === 'paid') {
    return {
      canProceed: false,
      reason: 'Cannot approve an invoice that has already been paid.',
    };
  }
  
  if (invoiceStatus === 'rejected') {
    return {
      canProceed: false,
      reason: 'Cannot approve a rejected invoice.',
    };
  }
  
  return { canProceed: true };
}

/**
 * Check if can mark invoice as paid
 */
export function canMarkPaid(invoiceStatus: string): WorkflowGuardResult {
  if (invoiceStatus !== 'approved') {
    return {
      canProceed: false,
      reason: 'Only approved invoices can be marked as paid.',
    };
  }
  
  return { canProceed: true };
}
