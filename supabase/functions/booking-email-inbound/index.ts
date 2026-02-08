import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-inbound-secret',
};

interface ExtractedBooking {
  booking_id: string | null;
  status: 'new' | 'modified' | 'cancelled';
  check_in_date: string | null;
  check_out_date: string | null;
  guest_name: string | null;
  room_type: string | null;
  total_price: number | null;
  guest_email: string | null;
  guest_phone: string | null;
  num_guests: number | null;
}

// Detect which OTA the email is from
function detectOTASource(subject: string, fromEmail: string): 'booking.com' | 'airbnb' | 'unknown' {
  const subjectLower = subject.toLowerCase();
  const emailLower = fromEmail.toLowerCase();
  
  if (emailLower.includes('booking.com') || subjectLower.includes('booking.com')) {
    return 'booking.com';
  }
  if (emailLower.includes('airbnb') || subjectLower.includes('airbnb')) {
    return 'airbnb';
  }
  // Check body patterns
  return 'unknown';
}

// Deterministic parsing patterns for Booking.com emails
function parseBookingComEmail(subject: string, body: string): Partial<ExtractedBooking> {
  const result: Partial<ExtractedBooking> = {};
  const combinedText = `${subject}\n${body}`;

  // Detect status from subject
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes('new booking') || subjectLower.includes('new reservation')) {
    result.status = 'new';
  } else if (subjectLower.includes('modification') || subjectLower.includes('modified') || subjectLower.includes('changed')) {
    result.status = 'modified';
  } else if (subjectLower.includes('cancel') || subjectLower.includes('cancelled')) {
    result.status = 'cancelled';
  }

  // Extract booking/confirmation number - multiple patterns
  const bookingIdPatterns = [
    /confirmation(?:\s+number)?[:\s]*(\d{8,15})/i,
    /booking(?:\s+number)?[:\s]*(\d{8,15})/i,
    /reservation(?:\s+number)?[:\s]*(\d{8,15})/i,
    /reference[:\s]*(\d{8,15})/i,
    /conf\.?\s*#?\s*:?\s*(\d{8,15})/i,
  ];
  for (const pattern of bookingIdPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.booking_id = match[1];
      break;
    }
  }

  // Extract check-in date
  const checkInPatterns = [
    /check[- ]?in[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
    /check[- ]?in[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /arrival[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
    /arrival[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ];
  for (const pattern of checkInPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.check_in_date = parseDate(match[1]);
      break;
    }
  }

  // Extract check-out date
  const checkOutPatterns = [
    /check[- ]?out[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
    /check[- ]?out[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /departure[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
    /departure[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ];
  for (const pattern of checkOutPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.check_out_date = parseDate(match[1]);
      break;
    }
  }

  // Extract guest name - stop at newline
  const guestNamePatterns = [
    /Guest[:\s]+([A-Z][a-zA-Z '-]+)/,
    /guest(?:\s+name)?[:\s]+([A-Z][a-zA-Z '-]+)/i,
    /booker[:\s]+([A-Z][a-zA-Z '-]+)/i,
  ];
  for (const pattern of guestNamePatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      // Take only the first line and clean up
      let name = match[1].split('\n')[0].split('Check')[0].split('Room')[0].trim();
      if (name.length > 2 && name.split(/\s+/).length <= 5) {
        result.guest_name = name;
        break;
      }
    }
  }

  // Extract room type
  const roomPatterns = [
    /room(?:\s+type)?[:\s]*([A-Za-z0-9\s-]+?)(?:\n|$|,|\d)/i,
    /accommodation[:\s]*([A-Za-z0-9\s-]+?)(?:\n|$|,)/i,
    /unit(?:\s+type)?[:\s]*([A-Za-z0-9\s-]+?)(?:\n|$|,)/i,
  ];
  for (const pattern of roomPatterns) {
    const match = combinedText.match(pattern);
    if (match && match[1].trim().length > 1) {
      result.room_type = match[1].trim();
      break;
    }
  }

  // Extract total price
  const pricePatterns = [
    /total[:\s]*(?:Rs\.?|₹|USD|\$|EUR|€)?\s*([\d,]+(?:\.\d{2})?)/i,
    /price[:\s]*(?:Rs\.?|₹|USD|\$|EUR|€)?\s*([\d,]+(?:\.\d{2})?)/i,
    /amount[:\s]*(?:Rs\.?|₹|USD|\$|EUR|€)?\s*([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.total_price = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract guest count - be more specific to avoid matching booking IDs
  const guestCountPatterns = [
    /(\d{1,2})\s*guests?\b/i,
    /guests?[:\s]+(\d{1,2})\b/i,
    /(\d{1,2})\s*adults?\b/i,
    /number\s+of\s+guests?[:\s]+(\d{1,2})/i,
  ];
  for (const pattern of guestCountPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count > 0 && count <= 20) {
        result.num_guests = count;
        break;
      }
    }
  }

  // Extract guest email
  const emailMatch = combinedText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch && !emailMatch[0].includes('booking.com')) {
    result.guest_email = emailMatch[0];
  }

  return result;
}

// Deterministic parsing patterns for Airbnb emails
function parseAirbnbEmail(subject: string, body: string): Partial<ExtractedBooking> {
  const result: Partial<ExtractedBooking> = {};
  const combinedText = `${subject}\n${body}`;

  // Detect status from subject
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes('reservation confirmed') || subjectLower.includes('new reservation') || subjectLower.includes('booking confirmed')) {
    result.status = 'new';
  } else if (subjectLower.includes('reservation updated') || subjectLower.includes('change') || subjectLower.includes('modified')) {
    result.status = 'modified';
  } else if (subjectLower.includes('cancel') || subjectLower.includes('cancelled')) {
    result.status = 'cancelled';
  }

  // Extract Airbnb confirmation code (usually like HMXXXXXXXX or alphanumeric)
  const confirmationPatterns = [
    /confirmation\s*code[:\s]*([A-Z0-9]{8,12})/i,
    /reservation\s*code[:\s]*([A-Z0-9]{8,12})/i,
    /booking\s*code[:\s]*([A-Z0-9]{8,12})/i,
    /HM[A-Z0-9]{6,10}/i,  // Airbnb format often starts with HM
    /(?:code|#)[:\s]*([A-Z0-9]{8,12})/i,
  ];
  for (const pattern of confirmationPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.booking_id = match[1] || match[0];
      break;
    }
  }

  // Extract dates - Airbnb uses formats like "Feb 15 - 18, 2026" or "February 15, 2026"
  const dateRangePatterns = [
    /([A-Za-z]+\s+\d{1,2})\s*[-–]\s*(\d{1,2})[,\s]+(\d{4})/i,  // "Feb 15 - 18, 2026"
    /([A-Za-z]+\s+\d{1,2})[,\s]+(\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{1,2})[,\s]+(\d{4})/i,  // "Feb 15, 2026 - Feb 18, 2026"
  ];
  
  for (const pattern of dateRangePatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      if (match.length === 4) {
        // Format: "Feb 15 - 18, 2026"
        const startMonth = match[1];
        const endDay = match[2];
        const year = match[3];
        result.check_in_date = parseDate(`${startMonth}, ${year}`);
        // Extract month from startMonth for checkout
        const monthMatch = startMonth.match(/([A-Za-z]+)/);
        if (monthMatch) {
          result.check_out_date = parseDate(`${monthMatch[1]} ${endDay}, ${year}`);
        }
      } else if (match.length === 5) {
        // Format: "Feb 15, 2026 - Feb 18, 2026"
        result.check_in_date = parseDate(`${match[1]}, ${match[2]}`);
        result.check_out_date = parseDate(`${match[3]}, ${match[4]}`);
      }
      break;
    }
  }

  // Fallback date patterns
  if (!result.check_in_date) {
    const checkInPatterns = [
      /check[- ]?in[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
      /arrives?[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    ];
    for (const pattern of checkInPatterns) {
      const match = combinedText.match(pattern);
      if (match) {
        result.check_in_date = parseDate(match[1]);
        break;
      }
    }
  }

  if (!result.check_out_date) {
    const checkOutPatterns = [
      /check[- ]?out[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
      /departs?[:\s]*([A-Za-z]+[\s,]+\d{1,2}[\s,]+\d{4})/i,
    ];
    for (const pattern of checkOutPatterns) {
      const match = combinedText.match(pattern);
      if (match) {
        result.check_out_date = parseDate(match[1]);
        break;
      }
    }
  }

  // Extract guest name - Airbnb patterns
  const guestNamePatterns = [
    /(?:from|by)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
    /guest[:\s]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    /([A-Z][a-zA-Z]+)\s+(?:booked|reserved|is\s+arriving)/i,
  ];
  for (const pattern of guestNamePatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      let name = match[1].trim();
      // Filter out common false positives
      if (name.length > 2 && !['Airbnb', 'Your', 'The', 'This'].includes(name)) {
        result.guest_name = name;
        break;
      }
    }
  }

  // Extract listing/property name (Airbnb shows listing names)
  const listingPatterns = [
    /(?:at|for)\s+"([^"]+)"/i,
    /listing[:\s]*([^\n]+)/i,
    /property[:\s]*([^\n]+)/i,
  ];
  for (const pattern of listingPatterns) {
    const match = combinedText.match(pattern);
    if (match && match[1].trim().length > 2) {
      result.room_type = match[1].trim();
      break;
    }
  }

  // Extract total payout/price
  const pricePatterns = [
    /(?:total|payout|you['']ll\s+earn)[:\s]*(?:Rs\.?|₹|USD|\$|EUR|€)?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:Rs\.?|₹|USD|\$|EUR|€)\s*([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      result.total_price = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract guest count
  const guestCountPatterns = [
    /(\d{1,2})\s*guests?\b/i,
    /guests?[:\s]+(\d{1,2})\b/i,
  ];
  for (const pattern of guestCountPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count > 0 && count <= 20) {
        result.num_guests = count;
        break;
      }
    }
  }

  // Extract guest email (if visible)
  const emailMatch = combinedText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch && !emailMatch[0].includes('airbnb')) {
    result.guest_email = emailMatch[0];
  }

  return result;
}

function parseDate(dateStr: string): string | null {
  try {
    // Try multiple date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try DD/MM/YYYY or MM/DD/YYYY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p));
      // Assume DD/MM/YYYY if first number > 12
      if (a > 12) {
        return new Date(c < 100 ? 2000 + c : c, b - 1, a).toISOString().split('T')[0];
      }
      // Assume MM/DD/YYYY
      return new Date(c < 100 ? 2000 + c : c, a - 1, b).toISOString().split('T')[0];
    }
  } catch {
    return null;
  }
  return null;
}

async function parseWithAI(subject: string, body: string, otaSource: string): Promise<ExtractedBooking | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[Email Parser] LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an email parser for hotel/vacation rental booking confirmations from ${otaSource === 'airbnb' ? 'Airbnb' : 'Booking.com and similar OTAs'}.
Extract the following fields from the email. Return ONLY a JSON object, no markdown, no explanation.

Required fields:
- booking_id: The reservation/confirmation number (string)
- status: "new", "modified", or "cancelled"
- check_in_date: YYYY-MM-DD format
- check_out_date: YYYY-MM-DD format
- guest_name: Full name of the guest
- room_type: Room/listing type or name
- total_price: Numeric value only (no currency symbols)
- guest_email: Email if visible
- guest_phone: Phone if visible
- num_guests: Number of guests

If a field cannot be extracted, use null.`
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nBody:\n${body}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('[Email Parser] AI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return null;
    }

    // Parse JSON from response (handle possible markdown wrapping)
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('[Email Parser] AI parsing error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const contentType = req.headers.get('content-type') || '';
    console.log('[Email Inbound] Content-Type:', contentType);
    
    let body: any;
    
    // Parse body - always try JSON first since that's most common
    const rawBody = await req.text();
    console.log('[Email Inbound] Raw body length:', rawBody.length);
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Not JSON, try form data parsing
      if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        // Re-create request to parse form data
        const formReq = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: rawBody,
        });
        const formData = await formReq.formData().catch(() => new FormData());
        body = Object.fromEntries(formData);
      } else {
        body = {};
      }
    }

    console.log('[Email Inbound] Parsed body testMode:', body?.testMode);
    const isTestMode = body?.testMode === true;
    console.log('[Email Inbound] isTestMode:', isTestMode);
    
    // Verify inbound secret (skip for test mode)
    const inboundSecret = req.headers.get('x-inbound-secret');
    const expectedSecret = Deno.env.get('EMAIL_INBOUND_SECRET');
    
    console.log('[Email Inbound] Secret check:', { isTestMode, hasExpectedSecret: !!expectedSecret, hasInboundSecret: !!inboundSecret });
    
    if (!isTestMode && expectedSecret && inboundSecret !== expectedSecret) {
      console.error('[Email Inbound] Invalid secret - rejecting');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Email Inbound] Received request:', {
      testMode: isTestMode,
      hasBody: !!body,
      bodyKeys: Object.keys(body || {}),
    });

    // Extract email content
    let subject = '';
    let bodyText = '';
    let fromEmail = '';
    let messageId = '';
    let provider = 'unknown';
    let propertyId = body.propertyId || body.property_id || null;

    // Handle different email provider formats
    if (body.testMode) {
      // Test mode - direct content
      provider = 'test';
      subject = body.subject || '';
      bodyText = body.body || body.text || body.rawText || '';
      fromEmail = body.from || 'test@test.com';
      messageId = `test-${Date.now()}`;
    } else if (body.Subject || body.subject) {
      // Mailgun / generic format
      provider = 'mailgun';
      subject = body.Subject || body.subject || '';
      bodyText = body['stripped-text'] || body['body-plain'] || body.text || body.body || '';
      fromEmail = body.From || body.from || body.sender || '';
      messageId = body['Message-Id'] || body.messageId || '';
    } else if (body.TextBody || body.HtmlBody) {
      // Postmark format
      provider = 'postmark';
      subject = body.Subject || '';
      bodyText = body.TextBody || body.StrippedTextReply || '';
      fromEmail = body.FromFull?.Email || body.From || '';
      messageId = body.MessageID || '';
    } else if (body.text || body.html) {
      // SendGrid format
      provider = 'sendgrid';
      subject = body.subject || '';
      bodyText = body.text || '';
      fromEmail = body.from || '';
      messageId = body.headers?.['Message-ID'] || '';
    }

    // If no text body, try to strip HTML
    if (!bodyText && (body.html || body.Html || body.HtmlBody || body['body-html'])) {
      const html = body.html || body.Html || body.HtmlBody || body['body-html'];
      bodyText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    console.log('[Email Inbound] Parsed content:', {
      provider,
      subject: subject.substring(0, 100),
      bodyLength: bodyText.length,
      fromEmail,
      propertyId,
    });

    // Detect OTA source
    const otaSource = detectOTASource(subject, fromEmail);
    console.log('[Email Inbound] Detected OTA source:', otaSource);

    // Try deterministic parsing first based on OTA
    let extracted: Partial<ExtractedBooking>;
    if (otaSource === 'airbnb') {
      extracted = parseAirbnbEmail(subject, bodyText);
    } else {
      extracted = parseBookingComEmail(subject, bodyText);
    }
    let usedAI = false;

    // If key fields are missing, try AI fallback
    if (!extracted.booking_id || !extracted.check_in_date || !extracted.check_out_date) {
      console.log('[Email Inbound] Trying AI fallback...');
      const aiResult = await parseWithAI(subject, bodyText, otaSource);
      if (aiResult) {
        extracted = { ...extracted, ...aiResult };
        usedAI = true;
      }
    }

    // Set default status if not detected
    if (!extracted.status) {
      extracted.status = 'new';
    }

    console.log('[Email Inbound] Extracted data:', extracted);

    // Log the ingest attempt
    const { data: logEntry, error: logError } = await supabase
      .from('email_ingest_logs')
      .insert({
        property_id: propertyId,
        provider,
        message_id: messageId,
        subject: subject.substring(0, 500),
        from_email: fromEmail,
        parse_status: extracted.booking_id ? 'success' : 'failed',
        parse_error: !extracted.booking_id ? 'Could not extract booking ID' : null,
        extracted: extracted as any,
        raw_text: bodyText.substring(0, 10000),
      })
      .select()
      .single();

    if (logError) {
      console.error('[Email Inbound] Failed to log:', logError);
    }

    // If we couldn't extract essential data, return early
    if (!extracted.booking_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract booking ID from email',
          extracted,
          logId: logEntry?.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For test mode, just return the extracted data without creating booking
    if (isTestMode && !body.confirmCreate) {
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          extracted,
          logId: logEntry?.id,
          usedAI,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure we have a property ID to create the booking
    if (!propertyId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Property ID is required to create booking',
          extracted,
          logId: logEntry?.id,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle cancellation
    if (extracted.status === 'cancelled') {
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('external_source', 'booking.com_email')
        .eq('external_booking_id', extracted.booking_id)
        .maybeSingle();

      if (existingBooking) {
        await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', existingBooking.id);

        // Update log
        await supabase
          .from('email_ingest_logs')
          .update({ parse_status: 'success' })
          .eq('id', logEntry?.id);

        return new Response(
          JSON.stringify({
            success: true,
            action: 'cancelled',
            bookingId: existingBooking.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Find or create guest
    let guestId: string | null = null;
    
    if (extracted.guest_name) {
      // Check for existing guest by name in this property
      const { data: existingGuest } = await supabase
        .from('guests')
        .select('id')
        .eq('property_id', propertyId)
        .ilike('name', extracted.guest_name)
        .maybeSingle();

      if (existingGuest) {
        guestId = existingGuest.id;
        // Update guest info if we have more data
        const updates: any = {};
        if (extracted.guest_email) updates.email = extracted.guest_email;
        if (extracted.guest_phone) updates.phone = extracted.guest_phone;
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('guests')
            .update(updates)
            .eq('id', guestId);
        }
      } else {
        // Create new guest
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert({
            name: extracted.guest_name,
            email: extracted.guest_email,
            phone: extracted.guest_phone,
            property_id: propertyId,
            notes: `Auto-imported from Booking.com email`,
          })
          .select()
          .single();

        if (guestError) {
          console.error('[Email Inbound] Failed to create guest:', guestError);
          await supabase
            .from('email_ingest_logs')
            .update({ 
              parse_status: 'failed',
              parse_error: `Failed to create guest: ${guestError.message}`
            })
            .eq('id', logEntry?.id);

          return new Response(
            JSON.stringify({ success: false, error: 'Failed to create guest' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        guestId = newGuest.id;
      }
    }

    // Try to map room type
    let roomId: string | null = null;
    let needsReview = false;
    let reviewReason: string | null = null;

    if (extracted.room_type) {
      // Try to find matching room by type
      const { data: matchingRoom } = await supabase
        .from('rooms')
        .select('id, room_number, room_type')
        .eq('property_id', propertyId)
        .eq('status', 'available')
        .ilike('room_type', `%${extracted.room_type}%`)
        .limit(1)
        .maybeSingle();

      if (matchingRoom) {
        roomId = matchingRoom.id;
      }
    }

    // If no room match, get any available room (but flag for review)
    if (!roomId) {
      const { data: anyRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('property_id', propertyId)
        .limit(1)
        .single();

      if (anyRoom) {
        roomId = anyRoom.id;
        needsReview = true;
        reviewReason = extracted.room_type 
          ? `Unmapped room type: ${extracted.room_type}` 
          : 'Room type not specified in email';
      } else {
        await supabase
          .from('email_ingest_logs')
          .update({ 
            parse_status: 'failed',
            parse_error: 'No rooms found in property'
          })
          .eq('id', logEntry?.id);

        return new Response(
          JSON.stringify({ success: false, error: 'No rooms found in property' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!guestId) {
      // Create placeholder guest
      const otaName = otaSource === 'airbnb' ? 'Airbnb' : 'Booking.com';
      const { data: placeholderGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          name: `${otaName} Guest`,
          property_id: propertyId,
          notes: `Auto-imported from ${otaName} email - ${extracted.booking_id}`,
        })
        .select()
        .single();

      if (guestError) {
        console.error('[Email Inbound] Failed to create placeholder guest:', guestError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create guest' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      guestId = placeholderGuest.id;
      needsReview = true;
      reviewReason = reviewReason 
        ? `${reviewReason}; Guest name not extracted`
        : 'Guest name not extracted from email';
    }

    // Determine booking source based on OTA
    const bookingSource = otaSource === 'airbnb' ? 'airbnb' as const : 'booking_com' as const;
    const externalSource = otaSource === 'airbnb' ? 'airbnb_email' : 'booking.com_email';

    // Upsert booking
    const bookingData = {
      property_id: propertyId,
      room_id: roomId!,
      guest_id: guestId!,
      check_in: extracted.check_in_date,
      check_out: extracted.check_out_date,
      booking_source: bookingSource,
      external_source: externalSource,
      external_booking_id: extracted.booking_id,
      imported_via: 'email',
      raw_email_id: messageId || null,
      total_amount: extracted.total_price || 0,
      num_guests: extracted.num_guests || 1,
      status: 'confirmed' as const,
      needs_review: needsReview,
      review_reason: reviewReason,
    };

    // Check for existing booking
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('external_source', externalSource)
      .eq('external_booking_id', extracted.booking_id!)
      .maybeSingle();

    let bookingResult;
    let action: 'created' | 'updated';

    if (existingBooking) {
      // Update existing
      const { data, error } = await supabase
        .from('bookings')
        .update({
          check_in: extracted.check_in_date,
          check_out: extracted.check_out_date,
          total_amount: extracted.total_price || 0,
          num_guests: extracted.num_guests || 1,
          needs_review: needsReview,
          review_reason: reviewReason,
        })
        .eq('id', existingBooking.id)
        .select()
        .single();

      if (error) throw error;
      bookingResult = data;
      action = 'updated';
    } else {
      // Create new
      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;
      bookingResult = data;
      action = 'created';
    }

    // Update log status
    await supabase
      .from('email_ingest_logs')
      .update({ parse_status: 'success' })
      .eq('id', logEntry?.id);

    // Create notification for staff
    const otaName = otaSource === 'airbnb' ? 'Airbnb' : 'Booking.com';
    const notificationTitle = action === 'created' 
      ? `New ${otaName} Booking` 
      : `${otaName} Booking Updated`;
    const notificationMessage = `${extracted.guest_name || 'Guest'} - ${extracted.check_in_date} to ${extracted.check_out_date}${needsReview ? ' (Needs Review)' : ''}`;
    
    await supabase
      .from('notifications')
      .insert({
        property_id: propertyId,
        type: needsReview ? 'warning' : 'info',
        title: notificationTitle,
        message: notificationMessage,
        link: `/bookings/${bookingResult.id}`,
      });

    console.log(`[Email Inbound] Booking ${action}:`, bookingResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        bookingId: bookingResult.id,
        needsReview,
        reviewReason,
        extracted,
        usedAI,
        otaSource,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Email Inbound] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
