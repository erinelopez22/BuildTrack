import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SMSNotificationRequest {
  eventType: string;
  projectId: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  actorUserId: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const pingramApiKey = Deno.env.get("PINGRAM_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pingramApiKey) {
      return new Response(JSON.stringify({ error: "Pingram API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const body: SMSNotificationRequest = await req.json();
    const { eventType, projectId, entityType, entityId, title, message: smsMessageBody, actorUserId, timestamp } = body;

    // Check if SMS is enabled globally
    const { data: smsSettings } = await serviceClient
      .from("sms_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!smsSettings?.is_enabled) {
      return new Response(JSON.stringify({ success: true, message: "SMS disabled", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which roles should receive SMS for this event type
    const rules = smsSettings.event_rules as Record<string, string[]> | null;
    const targetRoles = rules?.[eventType] || rules?.["order_status_change"] || [];

    // Get project members
    const { data: members } = await serviceClient
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    const allRecipientIds = new Set<string>();
    (members || []).forEach((m) => allRecipientIds.add(m.user_id));

    // Get users with target roles (admin/super_admin always included)
    if (targetRoles.length > 0) {
      const { data: roleUsers } = await serviceClient
        .from("user_roles")
        .select("user_id")
        .in("role", targetRoles);
      (roleUsers || []).forEach((r) => allRecipientIds.add(r.user_id));
    }

    // Always include admins
    const { data: adminUsers } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);
    (adminUsers || []).forEach((r) => allRecipientIds.add(r.user_id));

    // Exclude the actor
    if (actorUserId) allRecipientIds.delete(actorUserId);

    if (allRecipientIds.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles with phone + sms_opt_in
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, phone, sms_opt_in, full_name, email")
      .in("id", Array.from(allRecipientIds))
      .eq("sms_opt_in", true)
      .not("phone", "is", null);

    const eligibleProfiles = (profiles || []).filter((p) => p.phone && p.phone.trim() !== "");

    if (eligibleProfiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No eligible recipients", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format timestamp in Manila time
    const ts = timestamp ? new Date(timestamp) : new Date();
    const manilaTime = ts
      .toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", " –");

    const smsMessage = `${smsMessageBody} (${manilaTime}). Reply STOP to opt-out.`;

    // Pingram base URL
    const pingramBaseUrl = "https://api.pingram.io";

    let sentCount = 0;
    const errors: string[] = [];

    for (const profile of eligibleProfiles) {
      try {
        const pingramResponse = await fetch(`${pingramBaseUrl}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${pingramApiKey}`,
          },
          body: JSON.stringify({
            type: "buildtracknotification",
            to: {
              id: profile.email || profile.id,
              email: profile.email || "",
              number: profile.phone!,
            },
            sms: {
              message: smsMessage,
            },
            inapp: {
              title,
              url: `https://stockwell-build.lovable.app/projects`,
            },
          }),
        });

        const responseText = await pingramResponse.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const status = pingramResponse.ok ? "sent" : "failed";

        // Log SMS attempt
        await serviceClient.from("sms_logs").insert({
          event_type: eventType,
          recipient_user_id: profile.id,
          phone_number: profile.phone!,
          message: smsMessage,
          status,
          provider_message_id: responseData?.id || responseData?.messageId || null,
          error_message: pingramResponse.ok ? null : (responseData?.message || responseData?.error || "Unknown error"),
          reference_id: entityId || null,
          reference_type: entityType || null,
        });

        if (pingramResponse.ok) sentCount++;
        else errors.push(`${profile.phone}: ${responseData?.message || "Failed"}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${profile.phone}: ${errMsg}`);

        await serviceClient.from("sms_logs").insert({
          event_type: eventType,
          recipient_user_id: profile.id,
          phone_number: profile.phone!,
          message: smsMessage,
          status: "failed",
          error_message: errMsg,
          reference_id: entityId || null,
          reference_type: entityType || null,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: eligibleProfiles.length,
        warnings: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Send SMS Notification error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
