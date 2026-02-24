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
    const pingramApiKey = Deno.env.get("PINGRAM_API_KEY");
    const pingramBaseUrl = Deno.env.get("PINGRAM_BASE_URL") || "https://api.pingram.io";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://stockwell-build.lovable.app";

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

    const body = await req.json();
    const {
      recipientMode,
      toUserId,
      to,
      channels,
      title,
      smsMessage,
      emailSubject,
      emailHtml,
    } = body;

    const results: Record<string, { status: string; error?: string }> = {};

    // Resolve recipient info
    let recipientEmail: string | undefined;
    let recipientNumber: string | undefined;
    let recipientLabel: string | undefined;
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
        .select("id, email, phone, sms_opt_in, full_name")
        .eq("id", toUserId)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      recipientUserId = profile.id;
      recipientEmail = profile.email;
      recipientNumber = profile.phone || undefined;
      recipientLabel = profile.full_name || undefined;

      // SMS channel checks for user mode
      if (channels?.sms) {
        if (!profile.phone) {
          results.sms = { status: "failed", error: "User has no mobile number" };
        } else if (!profile.sms_opt_in) {
          results.sms = { status: "failed", error: "User has SMS opt-in disabled" };
        }
      }
    } else if (recipientMode === "custom") {
      recipientEmail = to?.email || undefined;
      recipientNumber = to?.number || undefined;
      recipientLabel = to?.label || undefined;

      if (channels?.sms && !recipientNumber) {
        results.sms = { status: "failed", error: "Mobile number is required for SMS" };
      }
      if (channels?.email && !recipientEmail) {
        results.email = { status: "failed", error: "Email is required for Email channel" };
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid recipientMode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build and send Pingram payload
    const sendSms = channels?.sms && !results.sms;
    const sendEmailChannel = channels?.email && !results.email;

    if (sendSms || sendEmailChannel) {
      try {
        const pingramPayload: Record<string, unknown> = {
          type: "buildtracknotification",
          to: {
            id: recipientEmail || recipientNumber || "test",
            email: recipientEmail || "",
            number: recipientNumber || "",
          },
        };

        if (sendSms && recipientNumber) {
          pingramPayload.sms = { message: smsMessage };
        }
        if (sendEmailChannel && recipientEmail) {
          pingramPayload.email = { subject: emailSubject, html: emailHtml };
        }
        pingramPayload.inapp = { title, url: appBaseUrl };

        const pingramResponse = await fetch(`${pingramBaseUrl}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pingramApiKey}`,
          },
          body: JSON.stringify(pingramPayload),
        });

        const responseText = await pingramResponse.text();
        let responseData: Record<string, unknown> = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (pingramResponse.ok) {
          if (sendSms) results.sms = { status: "sent" };
          if (sendEmailChannel) results.email = { status: "sent" };
        } else {
          const errMsg =
            (responseData?.message as string) ||
            (responseData?.error as string) ||
            `HTTP ${pingramResponse.status}`;
          if (sendSms) results.sms = { status: "failed", error: errMsg };
          if (sendEmailChannel) results.email = { status: "failed", error: errMsg };
        }

        // Log to sms_logs
        if (sendSms && recipientNumber) {
          await serviceClient.from("sms_logs").insert({
            event_type: "test_notification",
            recipient_user_id: recipientUserId,
            phone_number: recipientNumber,
            message: smsMessage,
            status: results.sms?.status === "sent" ? "sent" : "failed",
            provider_message_id:
              (responseData?.id as string) ||
              (responseData?.messageId as string) ||
              null,
            error_message: results.sms?.error || null,
            reference_type: recipientMode === "custom" ? "custom_test" : "user_test",
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        if (sendSms && !results.sms) results.sms = { status: "failed", error: errMsg };
        if (sendEmailChannel && !results.email)
          results.email = { status: "failed", error: errMsg };

        // Log failure
        if (sendSms && recipientNumber) {
          await serviceClient.from("sms_logs").insert({
            event_type: "test_notification",
            recipient_user_id: recipientUserId,
            phone_number: recipientNumber,
            message: smsMessage,
            status: "failed",
            error_message: errMsg,
            reference_type: recipientMode === "custom" ? "custom_test" : "user_test",
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-test-notification error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
