'use client';

import Link from 'next/link';
import { FileTextIcon, BriefcaseIcon, DollarIcon, ShoppingCartIcon, PackageIcon } from '@/components/icons';

interface LinkedDocument {
  label: string;
  href: string | null;
  icon: React.ReactNode;
}

interface LinkedDocumentsSectionProps {
  documents: {
    purchaseRequest?: { id: number; code?: string } | null;
    quotationRequest?: { id: number } | null;
    purchaseQuotation?: { id: number; quotation_number?: string } | null;
    purchaseOrder?: { id: number; order_number?: string } | null;
    grn?: { id: number; grn_number?: string } | null;
    invoice?: { id: number; invoice_number?: string } | null;
  };
}

export default function LinkedDocumentsSection({ documents }: LinkedDocumentsSectionProps) {
  const linkedDocs: LinkedDocument[] = [
    {
      label: 'View PR',
      href: documents.purchaseRequest ? `/purchase-requests/${documents.purchaseRequest.id}` : null,
      icon: <FileTextIcon className="w-4 h-4" />,
    },
    {
      label: 'View QR',
      href: documents.quotationRequest ? `/quotation-requests/${documents.quotationRequest.id}` : null,
      icon: <BriefcaseIcon className="w-4 h-4" />,
    },
    {
      label: 'View Quotation',
      href: documents.purchaseQuotation ? `/purchase-quotations/${documents.purchaseQuotation.id}` : null,
      icon: <DollarIcon className="w-4 h-4" />,
    },
    {
      label: 'View PO',
      href: documents.purchaseOrder ? `/purchase-orders/${documents.purchaseOrder.id}` : null,
      icon: <ShoppingCartIcon className="w-4 h-4" />,
    },
    {
      label: 'View GRN',
      href: documents.grn ? `/goods-receiving/${documents.grn.id}` : null,
      icon: <PackageIcon className="w-4 h-4" />,
    },
    {
      label: 'View Invoice',
      href: documents.invoice ? `/purchase-invoices/${documents.invoice.id}` : null,
      icon: <DollarIcon className="w-4 h-4" />,
    },
  ].filter((doc) => doc.href !== null);

  if (linkedDocs.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Linked Documents</h3>
      <div className="flex flex-wrap gap-2">
        {linkedDocs.map((doc, index) => (
          <Link
            key={index}
            href={doc.href!}
            className="btn btn-secondary flex items-center gap-2"
          >
            {doc.icon}
            <span>{doc.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

