interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'inventory' | 'project' | 'team';
  referenceType?: string;
  referenceId?: string;
}

/** No-op when using .NET API (notifications not yet exposed). Kept for callers that still reference it. */
export async function createNotification(_params: CreateNotificationParams) {
  return { error: null as { message: string } | null };
}

/** No-op when using .NET API (notifications not yet exposed). Kept for callers that still reference it. */
export async function notifyProjectMembers(_params: {
  projectId: string;
  title: string;
  message: string;
  type: 'order' | 'inventory' | 'project' | 'team';
  referenceType?: string;
  referenceId?: string;
  excludeUserId?: string;
}) {
  return { error: null as { message: string } | null };
}

// Format timestamp to Manila timezone
export function formatManilaTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(',', ' –');
}
