import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Resend with API key from environment variable
// If not provided, it will log the email to console for development
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Default "from" address - should be a verified domain in production
const DEFAULT_FROM = process.env.EMAIL_FROM || 'SafeCampus <onboarding@resend.dev>';

const createEmailTemplate = (title: string, message: string, actionText?: string, actionUrl?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #0f172a;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background-color: #0f172a;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 32px 24px;
    }
    .content h2 {
      margin-top: 0;
      color: #0f172a;
      font-size: 20px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #334155;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .button-container {
      text-align: center;
      margin-top: 32px;
      margin-bottom: 32px;
    }
    .button {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff !important;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 16px;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #2563eb;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SafeCampus</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <p>${message}</p>
      
      ${actionText && actionUrl ? `
      <div class="button-container">
        <a href="${actionUrl}" class="button">${actionText}</a>
      </div>
      ` : ''}
      
      <p style="font-size: 14px; color: #64748b; margin-bottom: 0; border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SafeCampus Security System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const sendEmail = async ({
  to,
  subject,
  title,
  message,
  actionText,
  actionUrl,
  attachments,
  isRawHtml
}: {
  to: string;
  subject: string;
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  attachments?: { filename: string; content: string }[];
  isRawHtml?: boolean;
}) => {
  const html = isRawHtml ? message : createEmailTemplate(title, message, actionText, actionUrl);

  // If no Resend API key, log to console (useful for development)
  if (!resend) {
    console.log('--- EMAIL MOCK ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);
    if (actionUrl) console.log(`Action: ${actionText} -> ${actionUrl}`);
    console.log('------------------');
    return { id: 'mock-id', message: 'Email logged to console (no API key)' };
  }

  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject,
      html,
      attachments,
    });
    
    if (data.error) {
      // Check for Resend trial restriction
      if (data.error.message.includes('can only send testing emails')) {
        console.log('--- EMAIL TRIAL RESTRICTION (MOCKED) ---');
        console.log('Resend trial restriction hit. Logging email instead:');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Title: ${title}`);
        console.log(`Message: ${message}`);
        if (actionUrl) console.log(`Action: ${actionText} -> ${actionUrl}`);
        console.log('----------------------------------------');
        return { id: 'mock-id', message: 'Email logged to console due to trial restrictions' };
      }

      console.error('Resend API Error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('Email sent successfully:', data.data?.id);
    return data;
  } catch (error: any) {
    // Also catch network-level errors that might contain the restriction message
    if (error.message?.includes('can only send testing emails')) {
        console.log('--- EMAIL TRIAL RESTRICTION (MOCKED) ---');
        console.log(`To: ${to}`);
        console.log('----------------------------------------');
        return { id: 'mock-id', message: 'Email logged to console' };
    }

    console.error('Error sending email:', error);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};
