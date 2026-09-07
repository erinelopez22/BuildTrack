// Email is declared but never actually sent in the .NET backend (MailKit is referenced
// but no send path exists). Kept as a no-op stub so notification code can call it.
// TODO: wire up a real transactional email provider (Resend / SES / SMTP via nodemailer).

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email:stub] to=${msg.to} subject="${msg.subject}"`);
  }
}
