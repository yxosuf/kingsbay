import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  property_id?: string;
  type?: string;
  category?: string;
  priority?: string;
  title: string;
  message?: string;
  link?: string;
  target_roles?: string[];
  action_type?: string;
  action_entity_id?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth - either service role or authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for insertion (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      // Allow service role key calls (from other edge functions)
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (token !== serviceKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload: NotificationPayload = await req.json();

    if (!payload.title) {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabaseAdmin.from("notifications").insert({
      property_id: payload.property_id || null,
      type: payload.type || payload.category || "general",
      category: payload.category || payload.type || "general",
      priority: payload.priority || "medium",
      title: payload.title,
      message: payload.message || null,
      link: payload.link || null,
      target_roles: payload.target_roles || null,
      action_type: payload.action_type || null,
      action_entity_id: payload.action_entity_id || null,
      expires_at: payload.expires_at || null,
      is_read: false,
    }).select().single();

    if (error) {
      console.error("Error creating notification:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, notification: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
