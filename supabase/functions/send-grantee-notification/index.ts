import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GranteeRecord {
  id?: string;
  uid?: string;
  student_no?: string;
  studentId?: string;
  full_name?: string;
  fullName?: string;
  email_address?: string;
  email?: string;
  scholarship_name?: string;
  scholarshipName?: string;
  course?: string;
  program_name?: string;
  academic_year?: string;
  academicYear?: string;
  semester?: string;
  sa_number?: string;
  saNumber?: string;
  email_sent_at?: string;
  email_status?: string;
}

function generateEmailHtml(grantee: {
  fullName: string;
  studentId: string;
  course: string;
  scholarshipName: string;
  academicTerm: string;
  saNumber: string;
  downloadUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scholarship Grantee Notification - ScholarDoc</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 16px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0F3260 0%, #172554 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 0;
      font-size: 13px;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      margin-top: 14px;
      padding: 6px 16px;
      background-color: rgba(245, 158, 11, 0.2);
      border: 1px solid #f59e0b;
      color: #fbbf24;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .card-info {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13.5px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .cta-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      margin-bottom: 28px;
    }
    .cta-box h3 {
      margin: 0 0 8px 0;
      color: #166534;
      font-size: 17px;
      font-weight: 700;
    }
    .cta-box p {
      margin: 0 0 18px 0;
      color: #15803d;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .btn-download {
      display: inline-block;
      background: linear-gradient(135deg, #0F3260 0%, #1e40af 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(15, 50, 96, 0.25);
      letter-spacing: 0.3px;
    }
    .instructions {
      background-color: #ffffff;
      border-left: 4px solid #0F3260;
      padding: 14px 18px;
      margin-bottom: 28px;
      border-radius: 0 8px 8px 0;
      background: #f8fafc;
    }
    .instructions h4 {
      margin: 0 0 8px 0;
      font-size: 13.5px;
      color: #0F3260;
      font-weight: 700;
    }
    .instructions ol {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #0F3260;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- Header -->
      <div class="header">
        <div style="margin-bottom: 16px;">
          <img src="https://ywavesulvkqwpsejprxp.supabase.co/storage/v1/object/public/public-assets/app_logo3.png" 
               alt="ScholarDoc Logo" 
               width="80" 
               height="80" 
               style="width: 80px; height: 80px; border-radius: 50%; background: #ffffff; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain;" />
        </div>
        <h1>ScholarDoc</h1>
        <p>Scholarship Management & Verification System</p>
        <div class="badge">Official Grantee Notice</div>
      </div>

      <!-- Main Content -->
      <div class="content">
        <div class="greeting">Dear ${grantee.fullName},</div>
        <p class="lead-text">
          Congratulations! We are pleased to formally inform you that you have been identified and confirmed as an official <strong>scholarship grantee</strong> of the institution for <strong>${grantee.scholarshipName}</strong>.
        </p>

        <!-- Grantee Details Summary Card -->
        <div class="card-info">
          <div class="card-title">Your Grantee Details</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Student ID:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.studentId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Program / Course:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.course}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Scholarship Program:</td>
              <td style="padding: 6px 0; color: #047857; font-size: 13px; font-weight: 700; text-align: right;">${grantee.scholarshipName}</td>
            </tr>
            ${grantee.saNumber && grantee.saNumber !== 'N/A' ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">SA Number:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.saNumber}</td>
            </tr>` : ''}
            ${grantee.academicTerm ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Academic Term:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.academicTerm}</td>
            </tr>` : ''}
          </table>
        </div>

        <!-- Call to Action Box: Download ScholarDoc App -->
        <div class="cta-box">
          <h3>Get Started with ScholarDoc Mobile</h3>
          <p>
            Submit your scholarship documents (Certificate of Registration, School ID, and SA form) and track your stipend disbursement seamlessly on your mobile device.
          </p>
          <a href="${grantee.downloadUrl}" class="btn-download" target="_blank">
            Download ScholarDoc Application
          </a>
          <div style="margin-top: 14px; font-size: 11.5px; color: #64748b;">
            Direct link: <a href="${grantee.downloadUrl}" style="color: #0F3260; word-break: break-all;">${grantee.downloadUrl}</a>
          </div>
        </div>

        <!-- Next Steps -->
        <div class="instructions">
          <h4>Next Steps for Confirmed Grantees:</h4>
          <ol>
            <li>Download and install the <strong>ScholarDoc</strong> app using the button above.</li>
            <li>Log in using your registered student ID number and email address.</li>
            <li>Complete your student profile and upload the required verification requirements.</li>
            <li>Monitor the real-time approval status and billing updates from your Scholarship Coordinator.</li>
          </ol>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
          If you have any questions or require assistance with your account, please reach out to your University Scholarship & Financial Assistance Office.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>ScholarDoc System</strong> • University Scholarship and Financial Assistance Unit</p>
        <p>This is an automated notification. Please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} ScholarDoc. All rights reserved.</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

/**
 * Send email via Resend REST API
 */
async function sendEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.message || data?.error?.message || JSON.stringify(data);
      console.error(`Resend API error (${res.status}):`, errMsg);
      return { success: false, error: `Resend API error: ${errMsg}` };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("Resend fetch error:", err);
    return { success: false, error: err.message || String(err) };
  }
}

serve(async (req) => {
  // Handle pre-flight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate environment configuration
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "ScholarDoc <onboarding@resend.dev>";
    const downloadUrl = Deno.env.get("APP_DOWNLOAD_URL") || "https://scholardoc.app/download";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: "Resend API key not configured. Please set the RESEND_API_KEY secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: "Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) are missing.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse request payload
    let reqBody: any = {};
    try {
      reqBody = await req.json();
    } catch (_) {
      reqBody = {};
    }

    const {
      student_id,
      uid,
      student_no,
      email,
      mode = "single", // "single" | "batch"
      limit = 50,
      force = false, // If true, bypasses duplicate check
      record, // For Supabase Database Webhooks
    } = reqBody;

    // Helper to send email to a single grantee record
    async function sendNotificationToGrantee(grantee: GranteeRecord): Promise<{
      success: boolean;
      skipped?: boolean;
      reason?: string;
      student_id?: string;
      email?: string;
      error?: string;
    }> {
      const targetEmail = grantee.email_address || grantee.email;
      const targetId = grantee.uid || grantee.id || grantee.student_no || grantee.studentId;

      if (!targetEmail || !targetEmail.includes("@")) {
        return {
          success: false,
          student_id: targetId,
          error: `Missing or invalid email address: "${targetEmail || ''}"`,
        };
      }

      // Check duplicate status
      if (!force && grantee.email_sent_at) {
        return {
          success: true,
          skipped: true,
          student_id: targetId,
          email: targetEmail,
          reason: `Email already sent at ${grantee.email_sent_at}`,
        };
      }

      const fullName = grantee.full_name || grantee.fullName || "Student Grantee";
      const studentNumber = grantee.student_no || grantee.studentId || "N/A";
      const course = grantee.program_name || grantee.course || "General Course";
      const scholarshipName = grantee.scholarship_name || grantee.scholarshipName || "CHED TES";
      const saNumber = grantee.sa_number || grantee.saNumber || "N/A";
      const academicTerm = [grantee.academic_year || grantee.academicYear, grantee.semester]
        .filter(Boolean)
        .join(" - ") || "Current Academic Year";

      const htmlContent = generateEmailHtml({
        fullName,
        studentId: studentNumber,
        course,
        scholarshipName,
        academicTerm,
        saNumber,
        downloadUrl,
      });

      const textContent = `Dear ${fullName},\n\nCongratulations! You have been confirmed as an official scholarship grantee for ${scholarshipName}.\n\nStudent ID: ${studentNumber}\nCourse: ${course}\n\nPlease download the ScholarDoc mobile app to upload your documents and track your scholarship:\n${downloadUrl}\n\nScholarDoc Scholarship Office`;

      const subject = `[ScholarDoc] Official Notice: You are confirmed as a ${scholarshipName} Grantee`;

      try {
        const result = await sendEmailViaResend(
          resendApiKey,
          senderEmail,
          targetEmail,
          subject,
          htmlContent,
          textContent
        );

        if (!result.success) {
          // Record failure status
          try {
            let errQuery = supabase.from("student_grantees").update({
              email_status: "failed",
              email_error: result.error || "Unknown Resend error",
            });
            if (grantee.uid) errQuery = errQuery.eq("uid", grantee.uid);
            else if (grantee.id) errQuery = errQuery.eq("id", grantee.id);
            else if (grantee.student_no) errQuery = errQuery.eq("student_no", grantee.student_no);
            await errQuery;
          } catch (_) {}

          return {
            success: false,
            student_id: targetId,
            email: targetEmail,
            error: result.error,
          };
        }

        const now = new Date().toISOString();

        // Update student_grantees table
        let query = supabase.from("student_grantees").update({
          email_sent_at: now,
          email_status: "sent",
          email_sent_to: targetEmail,
        });

        if (grantee.uid) {
          query = query.eq("uid", grantee.uid);
        } else if (grantee.id) {
          query = query.eq("id", grantee.id);
        } else if (grantee.student_no) {
          query = query.eq("student_no", grantee.student_no);
        } else if (grantee.studentId) {
          query = query.eq("studentId", grantee.studentId);
        }

        const { error: updateErr } = await query;
        if (updateErr) {
          console.warn("Could not update email_sent_at in student_grantees:", updateErr.message);
        }

        // Try inserting into grantee_email_logs if the table exists
        try {
          await supabase.from("grantee_email_logs").insert([
            {
              student_id: studentNumber,
              grantee_uid: grantee.uid || grantee.id,
              recipient_email: targetEmail,
              scholarship_name: scholarshipName,
              status: "sent",
              sent_at: now,
            },
          ]);
        } catch (_) {
          // Table may not exist yet, safe to ignore
        }

        return {
          success: true,
          student_id: targetId,
          email: targetEmail,
        };
      } catch (err: any) {
        console.error(`Failed to send email to ${targetEmail}:`, err);

        // Record failure status
        try {
          let errQuery = supabase.from("student_grantees").update({
            email_status: "failed",
          });
          if (grantee.uid) errQuery = errQuery.eq("uid", grantee.uid);
          else if (grantee.student_no) errQuery = errQuery.eq("student_no", grantee.student_no);
          await errQuery;
        } catch (_) {}

        return {
          success: false,
          student_id: targetId,
          email: targetEmail,
          error: err.message || String(err),
        };
      }
    }

    // SCENARIO 1: Webhook payload (triggered directly from Postgres Insert/Update)
    if (record && (record.email_address || record.email)) {
      const res = await sendNotificationToGrantee(record);
      return new Response(JSON.stringify(res), {
        status: res.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SCENARIO 2: Batch mode — Notify all pending / unsent grantees
    if (mode === "batch") {
      let query = supabase.from("student_grantees").select("*");

      if (!force) {
        query = query.is("email_sent_at", null);
      }

      const { data: candidates, error: fetchErr } = await query.limit(limit);

      if (fetchErr) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch grantees", details: fetchErr }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!candidates || candidates.length === 0) {
        return new Response(
          JSON.stringify({
            message: "No pending grantees found needing email notification.",
            total: 0,
            sent: 0,
            skipped: 0,
            failed: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      let sentCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const grantee of candidates) {
        const result = await sendNotificationToGrantee(grantee);
        results.push(result);

        if (result.success && !result.skipped) sentCount++;
        else if (result.skipped) skippedCount++;
        else failedCount++;

        // Add a gentle 200ms delay between emails to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
      }

      return new Response(
        JSON.stringify({
          message: `Processed ${candidates.length} grantees. Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
          total: candidates.length,
          sent: sentCount,
          skipped: skippedCount,
          failed: failedCount,
          details: results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SCENARIO 3: Single student notification by ID, UID, or student_no
    const lookupId = student_id || uid || student_no;
    if (lookupId) {
      const { data: grantees, error: findErr } = await supabase
        .from("student_grantees")
        .select("*")
        .or(`uid.eq.${lookupId},student_no.eq.${lookupId},studentId.eq.${lookupId}`)
        .limit(1);

      if (findErr || !grantees || grantees.length === 0) {
        return new Response(
          JSON.stringify({ error: `Grantee not found with ID ${lookupId}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendNotificationToGrantee(grantees[0]);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SCENARIO 4: Direct email recipient with custom data
    if (email) {
      const directGrantee: GranteeRecord = {
        fullName: reqBody.fullName || reqBody.full_name || "Student Grantee",
        studentId: reqBody.studentId || reqBody.student_no || "N/A",
        email_address: email,
        course: reqBody.course || reqBody.program_name || "General Course",
        scholarshipName: reqBody.scholarshipName || reqBody.scholarship_name || "CHED TES",
        saNumber: reqBody.saNumber || reqBody.sa_number || "N/A",
        academicYear: reqBody.academicYear || reqBody.academic_year || "",
        semester: reqBody.semester || "",
      };

      const result = await sendNotificationToGrantee(directGrantee);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Missing required parameters. Provide 'student_id', 'mode: batch', or 'email'.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (globalErr: any) {
    console.error("Unhandled error in send-grantee-notification:", globalErr);
    return new Response(
      JSON.stringify({ error: globalErr.message || String(globalErr) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
