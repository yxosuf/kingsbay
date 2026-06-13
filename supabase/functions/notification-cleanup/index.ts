import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only callable via service-role key (cron job)
  const auth = requireServiceRole(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete expired notifications
    const { count: expiredCount } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    // Delete read notifications older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: oldReadCount } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("is_read", true)
      .lt("created_at", thirtyDaysAgo.toISOString());

    // Delete all notifications older than 90 days regardless of read status
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { count: veryOldCount } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .lt("created_at", ninetyDaysAgo.toISOString());

    const summary = {
      success: true,
      deleted: {
        expired: expiredCount || 0,
        old_read: oldReadCount || 0,
        very_old: veryOldCount || 0,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("[Notification Cleanup]", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Notification Cleanup] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
