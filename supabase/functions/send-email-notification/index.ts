import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth claims error:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    console.log("Authenticated caller:", callerId);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { mode } = body;

    // Get notification settings (SMTP config)
    const { data: settings } = await serviceClient
      .from("notification_settings")
      .select("*")
      .limit(1)
      .single();

    if (settings && !settings.email_enabled) {
      return new Response(JSON.stringify({ success: true, status: "skipped", reason: "Email notifications disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate SMTP configuration
    const smtpHost = settings?.smtp_host || "smtp.gmail.com";
    const smtpPort = settings?.smtp_port || 587;
    const smtpUser = settings?.smtp_user;
    const smtpPass = settings?.smtp_pass;

    if (!smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "Email provider not configured. Set Gmail SMTP credentials in Users & Roles > Notifications." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromName = settings?.from_name || "BuildTrack";
    const fromEmail = smtpUser; // From email = SMTP username (prevents spoofing)
    const replyTo = settings?.reply_to || undefined;

    const smtpConfig = { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass };

    if (mode === "test") {
      return await handleTestMode(body, callerId, serviceClient, smtpConfig, fromName, fromEmail, replyTo);
    } else if (mode === "event") {
      return await handleEventMode(body, callerId, serviceClient, smtpConfig, fromName, fromEmail, replyTo, appBaseUrl);
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode. Use 'test' or 'event'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("send-email-notification error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

async function handleTestMode(
  body: any,
  callerId: string,
  serviceClient: any,
  smtp: SmtpConfig,
  fromName: string,
  fromEmail: string,
  replyTo?: string
) {
  // Verify caller is admin/super_admin
  const { data: callerRoles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "super_admin"]);

  console.log("Caller roles check:", { callerId, callerRoles, rolesError });

  if (!callerRoles || callerRoles.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { recipientMode, toUserId, toEmail, subject, title, message } = body;

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

  const emailHtml = buildEmailHtml(title || "BuildTrack Test Notification", message || "This is a test email.");
  const result = await sendSmtpEmail(smtp, fromName, fromEmail, recipientEmail, subject || "BuildTrack Test Email", emailHtml, replyTo);

  // Log
  await serviceClient.from("email_logs").insert({
    mode: "test",
    event_type: "test_notification",
    to_user_id: recipientUserId,
    to_email: recipientEmail,
    subject: subject || "BuildTrack Test Email",
    status: result.success ? "sent" : "failed",
    error: result.error || null,
    provider: "gmail_smtp",
  });

  return new Response(JSON.stringify({
    success: result.success,
    results: {
      email: {
        status: result.success ? "sent" : "failed",
        error: result.error,
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
  smtp: SmtpConfig,
  fromName: string,
  fromEmail: string,
  replyTo: string | undefined,
  appBaseUrl: string
) {
  const { eventType, projectId, entityType, entityId, subject, title, message, url, actorUserId } = body;

  if (!subject || !title || !message) {
    return new Response(JSON.stringify({ error: "Missing required fields: subject, title, message" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build recipient list
  const allUserIds = new Set<string>();

  // Always include admin/super_admin
  const { data: adminRoles } = await serviceClient
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);
  (adminRoles || []).forEach((r: any) => allUserIds.add(r.user_id));

  // Include project members if projectId is provided
  if (projectId) {
    const { data: members } = await serviceClient
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);
    (members || []).forEach((m: any) => allUserIds.add(m.user_id));
  }

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

  const emailUrl = url || appBaseUrl;
  const emailHtml = buildEmailHtml(title, message, emailUrl);
  const results: { email: string; status: string; error?: string }[] = [];

  for (const recipient of recipients) {
    try {
      const result = await sendSmtpEmail(smtp, fromName, fromEmail, recipient.email, subject, emailHtml, replyTo);
      results.push({ email: recipient.email, status: result.success ? "sent" : "failed", error: result.error });

      await serviceClient.from("email_logs").insert({
        mode: "event",
        event_type: eventType || null,
        entity_type: entityType || null,
        entity_id: entityId || null,
        project_id: projectId || null,
        to_user_id: recipient.id,
        to_email: recipient.email,
        subject,
        status: result.success ? "sent" : "failed",
        error: result.error || null,
        provider: "gmail_smtp",
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

async function sendSmtpEmail(
  smtp: SmtpConfig,
  fromName: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: smtp.port,
        tls: false,
        auth: {
          username: smtp.user,
          password: smtp.pass,
        },
      },
    });

    const mailConfig: any = {
      from: `${fromName} <${fromEmail}>`,
      to: to,
      subject: subject,
      html: html,
    };
    if (replyTo) mailConfig.replyTo = replyTo;

    await client.send(mailConfig);
    await client.close();

    return { success: true };
  } catch (err) {
    console.error("SMTP send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "SMTP error" };
  }
}

function buildEmailHtml(title: string, message: string, url?: string): string {
  const timestamp = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

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
      <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;line-height:1.6;">${message}</p>
      <p style="margin:0 0 24px;color:#71717a;font-size:12px;">Timestamp: ${timestamp}</p>
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
