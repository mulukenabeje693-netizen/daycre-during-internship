const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Gmail SMTP Transporter
// ---------------------------------------------------------------------------
// To generate a Gmail App Password:
//   1. Go to your Google Account → Security → 2-Step Verification (must be ON)
//   2. At the bottom of the 2-Step Verification page click "App passwords"
//   3. Select app: "Mail" and device: "Other (custom name)" → name it "Daycare App"
//   4. Google will show a 16-character password — copy it
//   5. Paste it as EMAIL_PASS in your .env file (no spaces needed)
//   6. Set EMAIL_USER to your full Gmail address (e.g. yourname@gmail.com)
// ---------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // allow self-signed / untrusted certs in dev
  }
});

// Verify transporter config on startup (logs a warning if credentials are missing)
transporter.verify((error) => {
  if (error) {
    console.warn('[Email] Transporter verification failed:', error.message);
  } else {
    console.log('[Email] SMTP transporter is ready to send mail');
  }
});

// ---------------------------------------------------------------------------
// HTML email template for OTP
// ---------------------------------------------------------------------------
const buildOtpEmailHtml = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#4f8ef7;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                         letter-spacing:0.5px;">🔒 Password Reset</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Hello,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                We received a request to reset the password for your
                <strong>Daycare</strong> account. Use the verification
                code below to proceed:
              </p>

              <!-- OTP Box -->
              <div style="text-align:center;margin:28px 0;">
                <span style="display:inline-block;background:#f0f5ff;border:2px dashed #4f8ef7;
                             border-radius:10px;padding:16px 40px;
                             font-size:36px;font-weight:800;letter-spacing:10px;
                             color:#1d4ed8;">
                  ${otp}
                </span>
              </div>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center;">
                This code is valid for <strong>15 minutes</strong>.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:13px;text-align:center;">
                If you did not request a password reset, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                For security, never share this code with anyone.<br/>
                The Daycare team will never ask for your OTP.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;text-align:center;
                       border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} Daycare Management System. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// sendOtpEmail  –  sends the OTP to the user's real email address
// ---------------------------------------------------------------------------
/**
 * @param {string} toEmail   - Recipient email address
 * @param {string} otp       - 6-digit numeric OTP code
 * @returns {Promise<void>}
 */
const sendOtpEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: `"Daycare Support" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Password Reset Code',
    text: `Your Daycare password reset code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: buildOtpEmailHtml(otp)
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Email] OTP sent to ${toEmail} — Message ID: ${info.messageId}`);
};

// ---------------------------------------------------------------------------
// HTML email template for registration email verification OTP
// ---------------------------------------------------------------------------
const buildVerificationEmailHtml = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f9f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:14px;overflow:hidden;
                      box-shadow:0 4px 20px rgba(0,0,0,0.09);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#00898e,#006b70);padding:32px 40px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">✉️</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.4px;">
                Verify Your Email Address
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.78);font-size:13px;">
                DaycareHQ Account Registration
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6;">Hello,</p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Thank you for registering with <strong>DaycareHQ</strong>. To complete your
                account setup, please enter the verification code below on the registration page.
              </p>

              <!-- OTP Box -->
              <div style="text-align:center;margin:28px 0;">
                <span style="display:inline-block;background:#f0fafa;border:2px dashed #00898e;
                             border-radius:12px;padding:18px 44px;
                             font-size:40px;font-weight:800;letter-spacing:12px;
                             color:#005f63;font-family:'Courier New',monospace;">
                  ${otp}
                </span>
              </div>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center;">
                This code is valid for <strong>5 minutes</strong> only.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:13px;text-align:center;">
                If you did not create a DaycareHQ account, you can safely ignore this email.
              </p>

              <!-- Info box -->
              <div style="background:#f8fffe;border-left:4px solid #00898e;border-radius:8px;
                          padding:14px 18px;margin-top:8px;">
                <p style="margin:0;color:#374151;font-size:12px;line-height:1.7;">
                  🔐 <strong>Security tip:</strong> Never share this code with anyone.
                  DaycareHQ staff will never ask for your verification code.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;text-align:center;
                       border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} DaycareHQ Management System. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// sendVerificationOtp  –  sends a registration email-verification OTP
// ---------------------------------------------------------------------------
/**
 * @param {string} toEmail   - Recipient email address
 * @param {string} otp       - 6-digit numeric OTP code
 * @returns {Promise<void>}
 */
const sendVerificationOtp = async (toEmail, otp) => {
  try {
    // Explicit log so you can confirm the dynamic recipient in the terminal
    console.log('Sending OTP to:', toEmail);

    const mailOptions = {
      from: `"DaycareHQ" <${process.env.EMAIL_USER}>`,
      to: toEmail,           // ← always the dynamic address from req.body.email
      subject: 'Your DaycareHQ Email Verification Code',
      text: `Your DaycareHQ email verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not register for a DaycareHQ account, please ignore this email.`,
      html: buildVerificationEmailHtml(otp)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification OTP sent to ${toEmail} — Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('Nodemailer Send Error:', error);
    throw error; // re-throw → controller returns 500 JSON to the frontend
  }
};

module.exports = { sendOtpEmail, sendVerificationOtp };
