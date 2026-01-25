import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

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
  const { error } = await supabase.from('audit_logs').insert([{
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: oldValues as Json,
    new_values: newValues as Json,
    user_id: userId,
  }]);

  if (error) {
    console.error('Failed to log activity:', error);
  }
  
  return { error };
}

// Helper function to format activity for display
export function formatActivityDescription(log: {
  action: string;
  table_name: string;
  new_values?: Json | null;
  old_values?: Json | null;
}): string {
  const { action, table_name, new_values, old_values } = log;
  const newVals = new_values as Record<string, unknown> | null;
  const oldVals = old_values as Record<string, unknown> | null;
  
  switch (table_name) {
    case 'orders':
      if (action === 'create') return 'Order created';
      if (action === 'approve') return 'Order approved';
      if (action === 'reject') return `Order rejected${newVals?.rejection_reason ? `: ${newVals.rejection_reason}` : ''}`;
      if (action === 'status_change') {
        const oldStatus = oldVals?.status;
        const newStatus = newVals?.status;
        return `Order status changed from ${formatStatus(oldStatus)} to ${formatStatus(newStatus)}`;
      }
      return `Order ${action}`;
      
    case 'project_members':
      if (action === 'add') return `Team member added`;
      if (action === 'remove') return `Team member removed`;
      return `Team member ${action}`;
      
    case 'projects':
      if (action === 'create') return 'Project created';
      if (action === 'update') return 'Project updated';
      if (action === 'delete') return 'Project deleted';
      return `Project ${action}`;
      
    case 'project_inventory':
      if (action === 'adjustment') return `Inventory adjusted`;
      return `Inventory ${action}`;
      
    default:
      return `${table_name} ${action}`;
  }
}

function formatStatus(status: unknown): string {
  if (typeof status !== 'string') return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
