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
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Verify super_admin role server-side using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleCheck } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super Admin only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Truncate all app data tables (preserve profiles, user_roles, auth.users)
    const { error: truncateError } = await serviceClient.rpc("exec_sql", {
      sql: "",
    }).catch(() => ({ error: null }));

    // Direct SQL via service role - use individual deletes in correct FK order
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
      "projects",
      "skus",
      "borrow_transactions",
      "company_assets",
      "notifications",
      "audit_logs",
      "sms_logs",
      "sms_settings",
      "Test",
    ];

    const errors: string[] = [];
    for (const table of tablesToClear) {
      const { error } = await serviceClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        // Try with numeric id for Test table
        if (table === "Test") {
          const { error: err2 } = await serviceClient.from(table).delete().neq("id", 0);
          if (err2) errors.push(`${table}: ${err2.message}`);
        } else {
          errors.push(`${table}: ${error.message}`);
        }
      }
    }

    if (errors.length > 0) {
      console.error("Some tables had errors:", errors);
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
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
