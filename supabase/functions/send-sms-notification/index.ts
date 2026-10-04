import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function normalizePhilippineMobile(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    digits = "0" + digits.substring(2);
  } else if (digits.startsWith("9") && digits.length === 10) {
    digits = "0" + digits;
  }
  if (/^09\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const semaphoreApiKey = Deno.env.get("SEMAPHORE_API_KEY");
    const senderName = Deno.env.get("SEMAPHORE_SENDER_NAME") || "ScholarDoc";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    let reqBody: any = {};
    if (req.method === "POST") {
      try {
        reqBody = await req.json();
      } catch (_) {
        reqBody = {};
      }
    }

    const action = reqBody.action || "send"; // 'account' | 'send' | 'batch' | 'broadcast'

    // 1. Account info check
    if (action === "account" || req.method === "GET") {
      if (!semaphoreApiKey) {
        return new Response(
          JSON.stringify({
            configured: false,
            status: "unconfigured",
            message: "SEMAPHORE_API_KEY secret is not configured in Supabase.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const accRes = await fetch(
        `https://api.semaphore.co/api/v4/account?apikey=${encodeURIComponent(semaphoreApiKey)}`
      );
      if (!accRes.ok) {
        return new Response(
          JSON.stringify({
            configured: true,
            status: "error",
            message: `Semaphore API error ${accRes.status}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const accData = await accRes.json();
      return new Response(
        JSON.stringify({
          configured: true,
          status: "active",
          account_id: accData.account_id,
          account_name: accData.account_name,
          credit_balance: accData.credit_balance,
          sender_name: senderName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!semaphoreApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SEMAPHORE_API_KEY secret not configured. Please set the secret in Supabase.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = (supabaseUrl && supabaseServiceKey)
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;

    const {
      student_id,
      uid,
      student_no,
      phone,
      message,
      event_type = "custom",
      feedback = "",
      force = false,
      title = "ScholarDoc",
    } = reqBody;

    // Single send or event notification
    let targetPhone = phone;
    let targetStudent: any = null;
    const targetId = student_id || uid || student_no;

    if (!targetPhone && targetId && supabase) {
      const { data } = await supabase
        .from("student_grantees")
        .select("*")
        .or(`id.eq.${targetId},uid.eq.${targetId},student_no.eq.${targetId}`)
        .limit(1);

      if (data && data.length > 0) {
        targetStudent = data[0];
        targetPhone = targetStudent.mobile_number || targetStudent.contactNumber;
      }
    }

    const normalizedPhone = normalizePhilippineMobile(targetPhone);
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid or missing Philippine mobile number: "${targetPhone || ""}"`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplication
    if (!force && event_type === "grantee_confirmed" && targetStudent?.sms_sent_at) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: `SMS already sent at ${targetStudent.sms_sent_at}`,
          phone: normalizedPhone,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalMessage = message;
    const name = targetStudent?.full_name || targetStudent?.fullName || "Student";
    const scholarship = targetStudent?.scholarship_name || targetStudent?.scholarshipName || "Scholarship";

    if (!finalMessage) {
      switch (event_type) {
        case "grantee_confirmed":
          finalMessage = `[ScholarDoc] Congratulations ${name}! You are confirmed as a ${scholarship} grantee. Download the app to submit requirements and track your stipend.`;
          break;
        case "application_approved":
          finalMessage = `[ScholarDoc] Good news ${name}! Your scholarship documents have been verified and approved by the Scholarship Office.`;
          break;
        case "application_rejected":
          finalMessage = `[ScholarDoc Notice] Hello ${name}, your scholarship submission requires attention/correction.${feedback ? " Feedback: " + feedback : ""} Please open the ScholarDoc app for details.`;
          break;
        case "sa_revision":
          finalMessage = `[ScholarDoc Notice] Hello ${name}, your SA Number submission requires correction.${feedback ? " Feedback: " + feedback : ""} Please update it in the ScholarDoc app.`;
          break;
        case "id_revision":
          finalMessage = `[ScholarDoc Notice] Hello ${name}, your School ID document requires correction.${feedback ? " Feedback: " + feedback : ""} Please review feedback in the ScholarDoc app.`;
          break;
        default:
          finalMessage = `[ScholarDoc] Important scholarship update for ${name}.${feedback ? " " + feedback : ""} Check the ScholarDoc app.`;
      }
    }

    const payload: any = {
      apikey: semaphoreApiKey,
      number: normalizedPhone,
      message: finalMessage.trim(),
    };
    if (senderName) {
      payload.sendername = senderName.trim().slice(0, 11);
    }

    const semRes = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const semData = await semRes.json().catch(() => ({}));

    if (!semRes.ok) {
      const errMsg = Array.isArray(semData)
        ? semData.map((d: any) => d.message || JSON.stringify(d)).join(", ")
        : (semData.error || semData.message || `HTTP ${semRes.status}`);

      // Log failure in Supabase if available
      if (supabase) {
        try {
          await supabase.from("sms_logs").insert({
            student_id: targetStudent?.student_no || targetId,
            grantee_uid: targetStudent?.uid || targetId,
            recipient_phone: normalizedPhone,
            message: finalMessage,
            event_type,
            status: "failed",
            error_message: errMsg,
          });
        } catch (_) {}
      }

      return new Response(
        JSON.stringify({ success: false, status: "failed", error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const first = Array.isArray(semData) ? semData[0] : semData;
    const now = new Date().toISOString();

    if (supabase) {
      try {
        await supabase.from("sms_logs").insert({
          student_id: targetStudent?.student_no || targetId,
          grantee_uid: targetStudent?.uid || targetId,
          recipient_phone: normalizedPhone,
          message: finalMessage,
          event_type,
          status: "sent",
          semaphore_message_id: first?.message_id ? String(first.message_id) : null,
          network: first?.network || null,
          sent_at: now,
        });

        if (targetId) {
          await supabase
            .from("student_grantees")
            .update({
              sms_sent_at: now,
              sms_status: "sent",
              sms_sent_to: normalizedPhone,
              sms_message_id: first?.message_id ? String(first.message_id) : null,
            })
            .or(`id.eq.${targetId},uid.eq.${targetId},student_no.eq.${targetId}`);
        }
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "sent",
        message_id: first?.message_id,
        recipient: normalizedPhone,
        phone: normalizedPhone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
