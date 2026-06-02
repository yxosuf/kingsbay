import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface SyncRequest {
  integration_id: string;
  action: 'rate_push' | 'availability_push';
  payload: {
    dates?: string[];
    rates?: number[];
    date?: string;
    available?: boolean;
    room_id?: string;
    rate_plan_id?: string;
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const syncRequest: SyncRequest = await req.json();

    // Get integration details
    const { data: integration, error: intError } = await supabaseAdmin
      .from("ota_integrations")
      .select("*")
      .eq("id", syncRequest.integration_id)
      .single();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!integration.is_enabled || !integration.api_key) {
      return new Response(
        JSON.stringify({ error: "Integration not enabled or missing API key" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from("ota_sync_logs")
      .insert({
        property_id: integration.property_id,
        integration_id: integration.id,
        ota_name: integration.ota_name,
        action_type: syncRequest.action,
        status: "pending",
        request_payload: syncRequest.payload,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create sync log:", logError);
      return new Response(
        JSON.stringify({ error: "Failed to create sync log" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process sync with exponential backoff retry
    const maxRetries = integration.auto_retry_enabled ? integration.max_retries : 0;
    let retryCount = 0;
    let success = false;
    let errorMessage = "";

    while (retryCount <= maxRetries && !success) {
      try {
        // TODO: Actual OTA API call would go here based on integration.ota_name
        // For now, simulate success
        await new Promise((resolve) => setTimeout(resolve, 100));
        success = true;

        // Update sync log on success
        await supabaseAdmin
          .from("ota_sync_logs")
          .update({
            status: "success",
            response_message: "Sync completed successfully",
            retry_count: retryCount,
          })
          .eq("id", syncLog.id);

        // Update last sync timestamp
        const updateField = syncRequest.action === "rate_push"
          ? "last_rate_push_at"
          : "last_availability_push_at";

        await supabaseAdmin
          .from("ota_integrations")
          .update({ [updateField]: new Date().toISOString() })
          .eq("id", integration.id);

      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
        retryCount++;

        if (retryCount <= maxRetries) {
          // Exponential backoff: 2^retryCount seconds
          const delayMs = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (!success) {
      // Update sync log on failure
      await supabaseAdmin
        .from("ota_sync_logs")
        .update({
          status: "failure",
          error_message: errorMessage,
          retry_count: retryCount,
        })
        .eq("id", syncLog.id);

      // Send notification after 3+ retries
      if (retryCount >= 3) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            property_id: integration.property_id,
            type: "channel_sync",
            category: "channel_sync",
            priority: "high",
            title: "OTA Sync Failed",
            message: `${integration.display_name} sync failed after ${retryCount} retries: ${errorMessage}`,
            target_roles: ["admin", "manager"],
          }),
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          retries: retryCount,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_log_id: syncLog.id,
        retries: retryCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
