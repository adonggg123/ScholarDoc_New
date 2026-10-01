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

async function main() {
  console.log('Verifying SMTP connection...');
  await transporter.verify();
  console.log('Authenticated with Gmail successfully!');

  const info = await transporter.sendMail({
    from: '"ScholarDoc Scholarship Office" <judeesidorejariol@gmail.com>',
    to: 'judeesidorejariol@gmail.com',
    subject: '[ScholarDoc] Gmail SMTP Active - Official Notice',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
        <img src="https://ywavesulvkqwpsejprxp.supabase.co/storage/v1/object/public/public-assets/app_logo3.png" width="80" height="80" style="border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white; padding: 6px; margin-bottom: 12px;" />
        <h2 style="color: #0F3260; margin: 0 0 8px 0;">ScholarDoc Gmail SMTP Configured!</h2>
        <p style="color: #475569; font-size: 14px;">Emails can now be delivered to <strong>all scholarship grantee students</strong> directly from your Gmail account without domain restrictions.</p>
      </div>
    `
  });

  console.log('SUCCESS! Sent test email. Message ID:', info.messageId);
}

main().catch(err => {
  console.error('FAILED:', err);
});
