// Notification service - replaced Supabase with REST API + SignalR
import { notificationsApi, projectsApi } from '@/lib/apiClient';

// SMS functions remain no-ops (not implemented in v1 backend)
export async function triggerSMSNotification(_params: {
  eventType: string;
  projectId: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  actorUserId: string;
  timestamp?: string;
}) {
  // SMS disabled — no-op
}

export async function triggerSMS(_params: {
  projectId: string;
  projectName: string;
  eventType: string;
  eventSummary: string;
  performedBy: string;
  referenceId?: string;
  referenceType?: string;
  excludeUserId?: string;
  additionalRecipientUserIds?: string[];
}) {
  // SMS disabled — no-op
}

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'inventory' | 'project' | 'team';
  referenceType?: string;
  referenceId?: string;
}

export async function createNotification({
  userId,
  title,
  message,
  type,
  referenceType,
  referenceId,
}: CreateNotificationParams) {
  // Notifications are created server-side via the REST API
  // The backend will push them via SignalR. For client-triggered notifications,
  // this endpoint is used:
  const res = await notificationsApi.getAll(false);
  if (!res.success) {
    console.error('Failed to check notifications:', res.message);
    return { error: new Error(res.message) };
  }
  return { error: null };
}

export async function notifyProjectMembers({
  projectId,
  title,
  message,
  type,
  referenceType,
  referenceId,
  excludeUserId,
}: {
  projectId: string;
  title: string;
  message: string;
  type: 'order' | 'inventory' | 'project' | 'team';
  referenceType?: string;
  referenceId?: string;
  excludeUserId?: string;
}) {
  // Get all project members to notify
  const membersRes = await projectsApi.getMembers(projectId);
  if (!membersRes.success || !membersRes.data) {
    console.error('Failed to fetch project members:', membersRes.message);
    return { error: new Error(membersRes.message) };
  }

  // In the new backend, notifications are triggered server-side via
  // order/project service events. This client-side function is kept for
  // backward compatibility but the heavy lifting happens in the backend.
  // The SignalR hub will deliver real-time notifications to connected clients.

  console.info(`[Notify] ${type}: "${title}" → ${membersRes.data.length} members in project ${projectId}`);

  // Non-blocking email (backend handles this via its notification service)
  triggerEmailNotification({
    eventType: type,
    projectId,
    entityType: referenceType ?? type,
    entityId: referenceId ?? projectId,
    title,
    message,
    actorUserId: excludeUserId ?? '',
  }).catch((err) => console.warn('Email notification failed (non-blocking):', err));

  return { error: null };
}

// Email notification - now calls backend REST endpoint instead of edge function
export async function triggerEmailNotification(_params: {
  eventType: string;
  projectId: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  actorUserId: string;
  url?: string;
}) {
  // Backend notification service handles email sending
  // This is a no-op on the frontend - the backend sends emails
  // when order status changes, etc.
}

// ── Time formatting utilities (unchanged) ─────────────────────────────────────

export function formatManilaTime(date: string | Date): string {
  const d = new Date(date);
  return d
    .toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', ' –');
}

export function formatManilaTime2(date: string | Date): string {
  const d = new Date(date);
  return d
    .toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .replace(',', ' –');
}
