import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SMSRequest {
  projectId: string;
  projectName: string;
  eventType: string;
  eventSummary: string;
  performedBy: string;
  referenceId?: string;
  referenceType?: string;
  excludeUserId?: string;
  additionalRecipientUserIds?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
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

    // Check if SMS is enabled
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

    const { twilio_account_sid, twilio_auth_token, twilio_sender_number, event_rules } = smsSettings;

    if (!twilio_account_sid || !twilio_auth_token || !twilio_sender_number) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SMSRequest = await req.json();
    const { projectId, projectName, eventType, eventSummary, performedBy, referenceId, referenceType, excludeUserId, additionalRecipientUserIds } = body;

    // Determine which roles should receive SMS for this event type
    const rules = event_rules as Record<string, string[]> | null;
    const targetRoles = rules?.[eventType] || [];

    if (targetRoles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No roles configured for event", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project members
    const { data: members } = await serviceClient
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    const memberUserIds = new Set((members || []).map(m => m.user_id));

    // Get users with target roles
    const { data: roleUsers } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .in("role", targetRoles);

    // Combine: project members + role-based users + additional recipients
    const allRecipientIds = new Set<string>();
    memberUserIds.forEach(id => allRecipientIds.add(id));
    (roleUsers || []).forEach(r => allRecipientIds.add(r.user_id));
    (additionalRecipientUserIds || []).forEach(id => allRecipientIds.add(id));

    // Exclude the actor
    if (excludeUserId) allRecipientIds.delete(excludeUserId);

    if (allRecipientIds.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles with phone + sms_opt_in
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, phone, sms_opt_in, full_name")
      .in("id", Array.from(allRecipientIds))
      .eq("sms_opt_in", true)
      .not("phone", "is", null);

    const eligibleProfiles = (profiles || []).filter(p => p.phone && p.phone.trim() !== "");

    if (eligibleProfiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No eligible recipients with SMS opt-in", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format timestamp in Manila time
    const manilaTime = new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).replace(",", " –");

    const refLabel = referenceId ? ` ${referenceType || "Ref"} #${referenceId}.` : "";
    const smsMessage = `BuildTrack: [${projectName}] ${eventSummary} by ${performedBy} (${manilaTime}).${refLabel}`;

    // Send SMS to each eligible profile
    let sentCount = 0;
    const errors: string[] = [];

    for (const profile of eligibleProfiles) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}/Messages.json`;
      const authString = btoa(`${twilio_account_sid}:${twilio_auth_token}`);

      try {
        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authString}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: profile.phone!,
            From: twilio_sender_number,
            Body: smsMessage,
          }),
        });

        const twilioData = await twilioResponse.json();
        const status = twilioResponse.ok ? "sent" : "failed";

        // Log SMS attempt
        await serviceClient.from("sms_logs").insert({
          event_type: eventType,
          recipient_user_id: profile.id,
          phone_number: profile.phone!,
          message: smsMessage,
          status,
          provider_message_id: twilioData.sid || null,
          error_message: twilioResponse.ok ? null : (twilioData.message || "Unknown error"),
          reference_id: referenceId || null,
          reference_type: referenceType || null,
        });

        if (twilioResponse.ok) sentCount++;
        else errors.push(`${profile.phone}: ${twilioData.message || "Failed"}`);
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
          reference_id: referenceId || null,
          reference_type: referenceType || null,
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
    console.error("Send SMS error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
