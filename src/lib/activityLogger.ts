// Activity Logger - now uses REST API instead of Supabase direct access
import { auditLogsApi } from '@/lib/apiClient';

interface LogActivityParams {
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  userId: string;
}

export async function logActivity({
  action,
  tableName,
  recordId,
  oldValues = null,
  newValues = null,
  userId,
}: LogActivityParams) {
  const res = await auditLogsApi.log({
    tableName,
    recordId,
    action,
    oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
    newValues: newValues ? JSON.stringify(newValues) : undefined,
    userId,
  });

  if (!res.success) {
    console.error('Failed to log activity:', res.message);
  }

  return { error: res.success ? null : new Error(res.message) };
}

// Helper function to format activity for display (unchanged)
export function formatActivityDescription(log: {
  action: string;
  tableName?: string;
  table_name?: string;
  newValues?: string | null;
  oldValues?: string | null;
  new_values?: unknown;
  old_values?: unknown;
}): string {
  const tableName = log.tableName ?? log.table_name ?? '';
  const newVals = typeof log.newValues === 'string'
    ? (JSON.parse(log.newValues) as Record<string, unknown>)
    : (log.new_values as Record<string, unknown> | null);
  const oldVals = typeof log.oldValues === 'string'
    ? (JSON.parse(log.oldValues) as Record<string, unknown>)
    : (log.old_values as Record<string, unknown> | null);

  switch (tableName) {
    case 'orders':
    case 'Orders':
      if (log.action === 'create') return 'Order created';
      if (log.action === 'approve') return 'Order approved';
      if (log.action === 'reject')
        return `Order rejected${newVals?.rejectionReason ? `: ${newVals.rejectionReason}` : ''}`;
      if (log.action === 'status_change') {
        const oldStatus = oldVals?.status;
        const newStatus = newVals?.status;
        return `Order status changed from ${formatStatus(oldStatus)} to ${formatStatus(newStatus)}`;
      }
      return `Order ${log.action}`;

    case 'project_members':
    case 'ProjectMembers':
      if (log.action === 'add') return 'Team member added';
      if (log.action === 'remove') return 'Team member removed';
      return `Team member ${log.action}`;

    case 'projects':
    case 'Projects':
      if (log.action === 'create') return 'Project created';
      if (log.action === 'update') return 'Project updated';
      if (log.action === 'delete') return 'Project deleted';
      return `Project ${log.action}`;

    case 'project_inventory':
    case 'ProjectInventory':
      if (log.action === 'adjustment') return 'Inventory adjusted';
      return `Inventory ${log.action}`;

    case 'project_quotations':
    case 'ProjectQuotations':
      if (log.action === 'create') return 'Quotation created';
      if (log.action === 'update') return 'Quotation updated';
      return `Quotation ${log.action}`;

    default:
      return `${tableName} ${log.action}`;
  }
}

function formatStatus(status: unknown): string {
  if (typeof status !== 'string') return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
