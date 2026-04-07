import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = "booking_confirmation" | "pre_arrival" | "checkout_summary";

interface EmailRequest {
  booking_id: string;
  email_type: EmailType;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { booking_id, email_type } = (await req.json()) as EmailRequest;

    if (!booking_id || !email_type) {
      return new Response(
        JSON.stringify({ error: "booking_id and email_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking with guest and room details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        guests!inner(name, email, phone),
        rooms!inner(room_number, room_type, price)
      `)
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found", details: bookingError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestEmail = booking.guests?.email;
    if (!guestEmail) {
      return new Response(
        JSON.stringify({ error: "Guest has no email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch property details
    let propertyName = "Kings Bay";
    let propertyPhone = "";
    let propertyEmail = "info@kingsbay.lk";
    if (booking.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("name, phone, email")
        .eq("id", booking.property_id)
        .single();
      if (prop) {
        propertyName = prop.name || propertyName;
        propertyPhone = prop.phone || "";
        propertyEmail = prop.email || propertyEmail;
      }
    }

    // Fetch property inventory settings for check-in/out times
    let checkinTime = "2:00 PM";
    let checkoutTime = "11:00 AM";
    if (booking.property_id) {
      const { data: settings } = await supabase
        .from("property_inventory_settings")
        .select("checkin_time, checkout_time")
        .eq("property_id", booking.property_id)
        .single();
      if (settings) {
        checkinTime = formatTime(settings.checkin_time);
        checkoutTime = formatTime(settings.checkout_time);
      }
    }

    const guestName = booking.guests?.name || "Guest";
    const roomNumber = booking.rooms?.room_number || "N/A";
    const roomType = booking.rooms?.room_type || "Standard";
    const checkIn = formatDate(booking.check_in);
    const checkOut = formatDate(booking.check_out);
    const totalAmount = booking.total_amount
      ? `LKR ${Number(booking.total_amount).toLocaleString()}`
      : "To be confirmed";

    // Build email content based on type
    const { subject, html } = buildEmail(email_type, {
      guestName,
      roomNumber,
      roomType,
      checkIn,
      checkOut,
      checkinTime,
      checkoutTime,
      totalAmount,
      propertyName,
      propertyPhone,
      propertyEmail,
      bookingSource: booking.booking_source,
      specialRequests: booking.special_requests,
    });

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${propertyName} <info@kingsbay.lk>`,
        to: [guestEmail],
        subject,
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent: ${email_type} for booking ${booking_id} to ${guestEmail}`);

    // Log communication
    await supabase.from('guest_communications').insert({
      guest_id: booking.guest_id,
      booking_id: booking_id,
      property_id: booking.property_id,
      comm_type: 'email',
      subject,
      body: `${email_type} email sent`,
      recipient_email: guestEmail,
    });

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id, type: email_type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

interface EmailData {
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  checkinTime: string;
  checkoutTime: string;
  totalAmount: string;
  propertyName: string;
  propertyPhone: string;
  propertyEmail: string;
  bookingSource: string;
  specialRequests: string | null;
}

function buildEmail(
  type: EmailType,
  data: EmailData
): { subject: string; html: string } {
  const {
    guestName,
    roomNumber,
    roomType,
    checkIn,
    checkOut,
    checkinTime,
    checkoutTime,
    totalAmount,
    propertyName,
    propertyPhone,
    propertyEmail,
    specialRequests,
  } = data;

  const headerHtml = `
    <div style="background-color:#1a1a0a;padding:32px 24px;text-align:center;">
      <h1 style="color:#f5f0e8;font-size:28px;margin:0;font-family:Georgia,serif;">${propertyName}</h1>
    </div>`;

  const footerHtml = `
    <div style="background-color:#f5f0e8;padding:24px;text-align:center;font-size:13px;color:#666;">
      <p style="margin:0 0 8px;">${propertyName}</p>
      ${propertyPhone ? `<p style="margin:0 0 4px;">📞 ${propertyPhone}</p>` : ""}
      <p style="margin:0;">📧 ${propertyEmail}</p>
    </div>`;

  const detailsTable = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Check-in</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${checkIn}<br><span style="font-size:12px;color:#888;font-weight:400;">from ${checkinTime}</span></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Check-out</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${checkOut}<br><span style="font-size:12px;color:#888;font-weight:400;">by ${checkoutTime}</span></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;">Room</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${roomType} — Room ${roomNumber}</td></tr>
      <tr><td style="padding:10px 0;color:#888;font-size:13px;">Total</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;font-size:16px;">${totalAmount}</td></tr>
    </table>`;

  const wrapper = (content: string) => `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;">
        ${headerHtml}
        <div style="padding:32px 24px;">
          ${content}
        </div>
        ${footerHtml}
      </div>
    </body></html>`;

  switch (type) {
    case "booking_confirmation":
      return {
        subject: `Booking Confirmed — ${propertyName}`,
        html: wrapper(`
          <h2 style="color:#1a1a0a;font-size:22px;margin:0 0 8px;">Booking Confirmed</h2>
          <p style="color:#555;margin:0 0 24px;">Dear ${guestName}, your reservation has been confirmed.</p>
          ${detailsTable}
          ${specialRequests ? `<div style="background:#f9f7f2;border-radius:8px;padding:16px;margin-top:16px;"><p style="margin:0;font-size:13px;color:#888;">Special Requests</p><p style="margin:4px 0 0;font-size:14px;">${specialRequests}</p></div>` : ""}
          <p style="color:#555;font-size:14px;margin-top:24px;">We look forward to welcoming you. If you have any questions, please don't hesitate to reach out.</p>
        `),
      };

    case "pre_arrival":
      return {
        subject: `Your Stay Begins Soon — ${propertyName}`,
        html: wrapper(`
          <h2 style="color:#1a1a0a;font-size:22px;margin:0 0 8px;">Welcome Awaits</h2>
          <p style="color:#555;margin:0 0 24px;">Dear ${guestName}, we're preparing for your arrival!</p>
          ${detailsTable}
          <div style="background:#f9f7f2;border-radius:8px;padding:20px;margin-top:16px;">
            <h3 style="margin:0 0 12px;font-size:15px;color:#1a1a0a;">Before You Arrive</h3>
            <ul style="margin:0;padding:0 0 0 16px;color:#555;font-size:14px;line-height:1.8;">
              <li>Check-in is available from <strong>${checkinTime}</strong></li>
              <li>Please have your ID/passport ready</li>
              <li>Contact us for early check-in or late arrival</li>
            </ul>
          </div>
          <p style="color:#555;font-size:14px;margin-top:24px;">Safe travels! We look forward to seeing you soon.</p>
        `),
      };

    case "checkout_summary":
      return {
        subject: `Thank You for Staying — ${propertyName}`,
        html: wrapper(`
          <h2 style="color:#1a1a0a;font-size:22px;margin:0 0 8px;">Thank You, ${guestName}</h2>
          <p style="color:#555;margin:0 0 24px;">We hope you enjoyed your stay with us. Here's your stay summary.</p>
          ${detailsTable}
          <div style="background:#f9f7f2;border-radius:8px;padding:20px;margin-top:16px;text-align:center;">
            <p style="margin:0 0 8px;font-size:14px;color:#555;">We'd love to hear about your experience</p>
            <p style="margin:0;font-size:13px;color:#888;">Please share your feedback with our team at ${propertyEmail}</p>
          </div>
          <p style="color:#555;font-size:14px;margin-top:24px;">Thank you for choosing ${propertyName}. We hope to welcome you again soon!</p>
        `),
      };
  }
}
