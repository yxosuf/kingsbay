import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, context } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey) {
      // Fallback to rule-based suggestions
      return new Response(JSON.stringify(getRuleBasedSuggestions(type, context)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildPrompt(type, context);

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant for a hotel PMS. Provide concise, actionable suggestions. Return valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return new Response(JSON.stringify(getRuleBasedSuggestions(type, context)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    // Try to parse AI JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({ suggestions: parsed.suggestions || [parsed], source: 'ai' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // Fall through to rule-based
    }

    return new Response(JSON.stringify(getRuleBasedSuggestions(type, context)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPrompt(type: string, context: any): string {
  switch (type) {
    case 'room_allocation':
      return `Given these available rooms: ${JSON.stringify(context.availableRooms)}, 
              and this booking: guests=${context.numGuests}, nights=${context.nights}, type=${context.roomType},
              guest history: ${JSON.stringify(context.guestHistory || 'none')},
              suggest the best room and any upgrade opportunities.
              Return JSON: { "suggestions": [{ "type": "room", "room_id": "...", "room_number": "...", "reason": "...", "upgrade": { "available": bool, "room_number": "...", "extra_cost": number, "reason": "..." } }] }`;

    case 'occupancy_forecast':
      return `Given current occupancy ${context.occupancyPercent}% with ${context.totalRooms} rooms,
              ${context.upcomingBookings} bookings in next 7 days, ${context.upcomingBookings30} in next 30 days,
              historical avg occupancy: ${context.historicalAvg || 'unknown'}%,
              predict occupancy trends and suggest pricing adjustments.
              Return JSON: { "suggestions": [{ "type": "forecast", "period": "7d|30d", "predicted_occupancy": number, "risk": "low|medium|high", "recommendation": "..." }] }`;

    case 'cross_sell':
      return `Guest staying ${context.nights} nights in ${context.roomType}, 
              total spend so far: ${context.totalSpend}, VIP: ${context.isVip},
              available services: ${JSON.stringify(context.services || [])},
              suggest upsells and cross-sells.
              Return JSON: { "suggestions": [{ "type": "upsell|service", "name": "...", "price": number, "reason": "..." }] }`;

    default:
      return `Provide hotel management suggestions for: ${JSON.stringify(context)}`;
  }
}

function getRuleBasedSuggestions(type: string, context: any) {
  const suggestions: any[] = [];

  switch (type) {
    case 'room_allocation': {
      const rooms = context.availableRooms || [];
      // Prefer clean rooms first
      const cleanRooms = rooms.filter((r: any) => r.housekeeping_status === 'clean');
      const target = cleanRooms.length > 0 ? cleanRooms : rooms;
      
      if (target.length > 0) {
        suggestions.push({
          type: 'room',
          room_id: target[0].id,
          room_number: target[0].room_number,
          reason: target[0].housekeeping_status === 'clean' ? 'Clean and ready' : 'Best available',
        });
      }

      // Check for upgrade opportunity
      const premiumRooms = rooms.filter((r: any) => 
        r.room_type === 'suite' || r.room_type === 'deluxe'
      );
      if (premiumRooms.length > 0 && context.roomType === 'standard') {
        const upgrade = premiumRooms[0];
        suggestions.push({
          type: 'upgrade',
          room_number: upgrade.room_number,
          room_type: upgrade.room_type,
          extra_cost: Math.round((upgrade.price - (context.currentPrice || 0)) * 0.5),
          reason: `${upgrade.room_type} available — offer discounted upgrade`,
        });
      }
      break;
    }

    case 'occupancy_forecast': {
      const occ = context.occupancyPercent || 0;
      if (occ > 80) {
        suggestions.push({
          type: 'forecast',
          period: '7d',
          predicted_occupancy: Math.min(occ + 5, 100),
          risk: 'high',
          recommendation: 'High demand — consider increasing rates by 10-15%',
        });
      } else if (occ > 50) {
        suggestions.push({
          type: 'forecast',
          period: '7d',
          predicted_occupancy: occ,
          risk: 'medium',
          recommendation: 'Moderate demand — maintain current rates',
        });
      } else {
        suggestions.push({
          type: 'forecast',
          period: '7d',
          predicted_occupancy: Math.max(occ - 5, 0),
          risk: 'low',
          recommendation: 'Low occupancy — consider promotional rates or packages',
        });
      }
      break;
    }

    case 'cross_sell': {
      const nights = context.nights || 1;
      if (nights >= 3) {
        suggestions.push({
          type: 'service',
          name: 'Breakfast Package',
          price: nights * 1500,
          reason: `${nights}-night stay — breakfast package saves 20%`,
        });
      }
      if (context.isVip) {
        suggestions.push({
          type: 'upsell',
          name: 'Late Checkout',
          price: 2000,
          reason: 'VIP guest — offer complimentary or discounted late checkout',
        });
      }
      suggestions.push({
        type: 'service',
        name: 'Airport Transfer',
        price: 5000,
        reason: 'Popular add-on for guests',
      });
      break;
    }
  }

  return { suggestions, source: 'rules' };
}
