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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing env vars");
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

    const userId = claimsData.claims.sub as string;

    // Verify super_admin role server-side
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete all app data in FK-safe order using service role client
    const tablesToClear = [
      "receiver_evidence",
      "order_tracking_evidence",
      "tracking_driver_materials",
      "order_tracking_assignments",
      "delivery_items",
      "deliveries",
      "order_items",
      "orders",
      "inventory_transactions",
      "project_inventory",
      "quotation_items",
      "quotation_change_requests",
      "project_quotations",
      "project_members",
      "borrow_transactions",
      "company_assets",
      "projects",
      "skus",
      "notifications",
      "audit_logs",
      "sms_logs",
      "sms_settings",
    ];

    const errors: string[] = [];
    for (const table of tablesToClear) {
      const { error } = await serviceClient.from(table).delete().gte("created_at", "1970-01-01");
      if (error) {
        errors.push(`${table}: ${error.message}`);
        console.error(`Error clearing ${table}:`, error.message);
      }
    }

    // Handle Test table separately (numeric id)
    const { error: testErr } = await serviceClient.from("Test").delete().gte("id", 0);
    if (testErr) {
      errors.push(`Test: ${testErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "All application data has been reset.",
        warnings: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Reset data error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
