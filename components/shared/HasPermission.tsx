'use client'
import { usePermissions } from '@/lib/hooks/use-permissions'

interface HasPermissionProps {
  /** Format: "category:action" — e.g. "hr_analytics:export" */
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders `children` only when the current user holds the given permission.
 * Superusers always pass. Renders `fallback` (default: null) otherwise.
 */
export default function HasPermission({ permission, children, fallback = null }: HasPermissionProps) {
  const { hasPermission, isLoading } = usePermissions()

  if (isLoading) return null

  const [category, action] = permission.split(':')
  if (!category || !action) return null

  return hasPermission(category, action) ? <>{children}</> : <>{fallback}</>
}
