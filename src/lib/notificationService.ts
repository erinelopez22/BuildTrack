import { supabase } from "@/integrations/supabase/client";

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

  // Create notifications for each member (except excluded user)
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

  return { error };
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
      hour12: true, // set to false if you want 24-hour
    })
    .replace(",", " –");
}
