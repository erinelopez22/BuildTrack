import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://stockwell-build.lovable.app";

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { mode } = body;

    // Get notification settings (Resend API key + from config)
    const { data: settings } = await serviceClient
      .from("notification_settings")
      .select("*")
      .limit(1)
      .single();

    // Get Resend API key from Supabase secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend API Key is not configured. Add RESEND_API_KEY to your project secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (settings && !settings.email_enabled) {
      return new Response(JSON.stringify({ success: true, status: "skipped", reason: "Email notifications disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromName = settings?.from_name || "BuildTrack";
    const fromEmail = settings?.from_email || "noreply@buildtrack.app";
    const replyTo = settings?.reply_to || undefined;

    if (mode === "test") {
      return await handleTestMode(body, callerId, serviceClient, resendApiKey, fromName, fromEmail, replyTo);
    } else if (mode === "event") {
      return await handleEventMode(body, callerId, serviceClient, resendApiKey, fromName, fromEmail, replyTo, appBaseUrl);
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode. Use 'test' or 'event'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("send-email-notification error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleTestMode(
  body: any,
  callerId: string,
  serviceClient: any,
  resendApiKey: string,
  fromName: string,
  fromEmail: string,
  replyTo?: string
) {
  // Verify caller is admin/super_admin
  const { data: callerRoles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "super_admin"]);

  if (!callerRoles || callerRoles.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { recipientMode, toUserId, toEmail, subject, title, message, url } = body;

  let recipientEmail: string | undefined;
  let recipientUserId: string | null = null;

  if (recipientMode === "user") {
    if (!toUserId) {
      return new Response(JSON.stringify({ error: "toUserId is required for user mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", toUserId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recipientEmail = profile.email;
    recipientUserId = profile.id;
  } else if (recipientMode === "custom") {
    recipientEmail = toEmail;
  } else {
    return new Response(JSON.stringify({ error: "Invalid recipientMode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: "No recipient email provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailHtml = buildEmailHtml(title || "BuildTrack Test Notification", message || "This is a test email.", url);
  const result = await sendResendEmail(resendApiKey, fromName, fromEmail, recipientEmail, subject || "BuildTrack Test Email", emailHtml, replyTo);

  // Log
  await serviceClient.from("email_logs").insert({
    mode: "test",
    event_type: "test_notification",
    to_user_id: recipientUserId,
    to_email: recipientEmail,
    subject: subject || "BuildTrack Test Email",
    status: result.success ? "sent" : "failed",
    provider_message_id: result.messageId || null,
    error: result.error || null,
  });

  return new Response(JSON.stringify({
    success: result.success,
    results: {
      email: {
        status: result.success ? "sent" : "failed",
        error: result.error,
        messageId: result.messageId,
      },
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleEventMode(
  body: any,
  callerId: string,
  serviceClient: any,
  resendApiKey: string,
  fromName: string,
  fromEmail: string,
  replyTo: string | undefined,
  appBaseUrl: string
) {
  const { eventType, projectId, entityType, entityId, subject, title, message, url, actorUserId } = body;

  if (!projectId || !subject || !title || !message) {
    return new Response(JSON.stringify({ error: "Missing required fields: projectId, subject, title, message" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get project members
  const { data: members } = await serviceClient
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  // Also get admin/super_admin users
  const { data: adminRoles } = await serviceClient
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);

  const allUserIds = new Set<string>();
  (members || []).forEach((m: any) => allUserIds.add(m.user_id));
  (adminRoles || []).forEach((r: any) => allUserIds.add(r.user_id));

  // Exclude the actor
  const excludeId = actorUserId || callerId;
  allUserIds.delete(excludeId);

  if (allUserIds.size === 0) {
    return new Response(JSON.stringify({ success: true, status: "no_recipients" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get profiles with email_opt_in
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, email, full_name, email_opt_in")
    .in("id", Array.from(allUserIds));

  const recipients = (profiles || []).filter((p: any) => p.email && p.email_opt_in);

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ success: true, status: "no_recipients" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailHtml = buildEmailHtml(title, message, url || appBaseUrl);
  const results: { email: string; status: string; error?: string }[] = [];

  // Send emails (non-blocking per recipient)
  for (const recipient of recipients) {
    try {
      const result = await sendResendEmail(resendApiKey, fromName, fromEmail, recipient.email, subject, emailHtml, replyTo);
      results.push({ email: recipient.email, status: result.success ? "sent" : "failed", error: result.error });

      // Log
      await serviceClient.from("email_logs").insert({
        mode: "event",
        event_type: eventType || null,
        entity_type: entityType || null,
        entity_id: entityId || null,
        project_id: projectId,
        to_user_id: recipient.id,
        to_email: recipient.email,
        subject,
        status: result.success ? "sent" : "failed",
        provider_message_id: result.messageId || null,
        error: result.error || null,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      results.push({ email: recipient.email, status: "failed", error: errMsg });
    }
  }

  return new Response(JSON.stringify({ success: true, sent: results.filter(r => r.status === "sent").length, total: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendResendEmail(
  apiKey: string,
  fromName: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload: any = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.id) {
      return { success: true, messageId: data.id };
    } else {
      return { success: false, error: data.message || data.error || `HTTP ${response.status}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildEmailHtml(title: string, message: string, url?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#18181b;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">BuildTrack</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#18181b;font-size:16px;font-weight:600;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;line-height:1.6;">${escapeHtml(message)}</p>
      ${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 24px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">View in BuildTrack</a>` : ""}
    </div>
    <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
      <p style="margin:0;color:#a1a1aa;font-size:12px;">This email was sent by BuildTrack. You can manage your notification preferences in the app.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
