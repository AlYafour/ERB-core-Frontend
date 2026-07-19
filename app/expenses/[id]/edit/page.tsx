'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { expensesApi } from '@/lib/api/expenses';

export default function EditExpensePage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'update' }} redirectTo="/expenses">
      <EditExpenseContent />
    </RouteGuard>
  );
}

function EditExpenseContent() {
  const { id } = useParams<{ id: string }>();
  const { data: exp, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.getById(id),
    enabled: !!id,
  });

  if (isLoading || !exp) {
    return <MainLayout><PageShell><div className="animate-pulse" style={{ height: 300, background: 'var(--bg-secondary)', borderRadius: 8 }} /></PageShell></MainLayout>;
  }
  return <ExpenseForm existing={exp} />;
}
