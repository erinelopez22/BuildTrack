import { supabase } from "@/integrations/supabase/client";

// SMS functions are disabled - kept as no-ops for backward compatibility
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
  type: "order" | "inventory" | "project" | "team";
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
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
    is_read: false,
  });

  if (error) {
    console.error("Failed to create notification:", error);
  }

  return { error };
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
  type: "order" | "inventory" | "project" | "team";
  referenceType?: string;
  referenceId?: string;
  excludeUserId?: string;
}) {
  // Get all project members
  const { data: members, error: membersError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (membersError || !members) {
    console.error("Failed to fetch project members:", membersError);
    return { error: membersError };
  }

  // Create in-app notifications for each member (except excluded user)
  const notifications = members
    .filter((m) => m.user_id !== excludeUserId)
    .map((m) => ({
      user_id: m.user_id,
      title,
      message,
      type,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      is_read: false,
    }));

  if (notifications.length === 0) {
    return { error: null };
  }

  const { error } = await supabase.from("notifications").insert(notifications);

  if (error) {
    console.error("Failed to create notifications:", error);
  }

  // Trigger Gmail SMTP email in background (non-blocking)
  if (projectId && excludeUserId) {
    triggerEmailNotification({
      eventType: type === "order" ? "order_status_change" : type === "team" ? "equipment_update" : "project_update",
      projectId,
      entityType: referenceType || type,
      entityId: referenceId || projectId,
      title,
      message,
      actorUserId: excludeUserId,
    }).catch((err) => console.warn("Email notification failed (non-blocking):", err));
  }

  return { error };
}

// Non-blocking email trigger via Gmail SMTP edge function
export async function triggerEmailNotification(params: {
  eventType: string;
  projectId: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  actorUserId: string;
  url?: string;
}) {
  try {
    const { error } = await supabase.functions.invoke("send-email-notification", {
      body: {
        mode: "event",
        eventType: params.eventType,
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        subject: `[BuildTrack] ${params.title}`,
        title: params.title,
        message: params.message,
        url: params.url,
        actorUserId: params.actorUserId,
      },
    });
    if (error) console.warn("Email notification edge function error:", error);
  } catch (err) {
    console.warn("Email notification trigger error (non-blocking):", err);
  }
}

// Format timestamp to Manila timezone
export function formatManilaTime(date: string | Date): string {
  const d = new Date(date);
  return d
    .toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " –");
}

export function formatManilaTime2(date: string | Date): string {
  const d = new Date(date);

  return d
    .toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(",", " –");
}
