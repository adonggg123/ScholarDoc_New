const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'judeesidorejariol@gmail.com',
    pass: 'eoueeoikuorzymkq'
  },
  tls: { rejectUnauthorized: false }
});

async function run() {
  const nowStr = new Date().toLocaleTimeString('en-US');
  const info = await transporter.sendMail({
    from: '"ScholarDoc Scholarship Office" <judeesidorejariol@gmail.com>',
    to: 'judeesidorejariol@gmail.com',
    subject: `[ScholarDoc] Grantee Notice for Jude Esidore Z. Jariol (${nowStr})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
        <img src="https://ywavesulvkqwpsejprxp.supabase.co/storage/v1/object/public/public-assets/app_logo3.png" width="80" height="80" style="border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white; padding: 6px; margin-bottom: 12px;" />
        <h2 style="color: #0F3260; margin: 0 0 8px 0;">Official Grantee Notice</h2>
        <p style="color: #475569; font-size: 14px;">Delivered at <strong>${nowStr}</strong> directly via your verified Gmail SMTP.</p>
        <div style="margin-top: 20px;">
          <a href="https://scholardoc.app/download" style="background: #0F3260; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Download ScholarDoc App</a>
        </div>
      </div>
    `
  });

  console.log('SUCCESS! Email sent to judeesidorejariol@gmail.com. Message ID:', info.messageId);
}

run().catch(console.error);
