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
    // Fetch live rate from free API (no key required)
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Exchange rate API error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    const rate = data?.rates?.LKR;

    if (!rate || typeof rate !== "number" || rate <= 0) {
      throw new Error(`Invalid rate received: ${JSON.stringify(data)}`);
    }

    // Update all property settings using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: updated, error } = await supabase
      .from("property_inventory_settings")
      .update({
        fx_usd_lkr_rate: rate,
        fx_updated_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .select("property_id, fx_usd_lkr_rate");

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        rate,
        updated_count: updated?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("FX rate update error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
