/**
 * Outbound email, replacing Supabase's built-in mailer.
 *
 * Only one message matters to the application: the staff invitation /
 * set-password link. Supabase used to compose and send it from the templates
 * in src/lib/email-templates; now the application owns both.
 *
 * Delivery goes through SMTP when SMTP_URL is configured. When it is not --
 * local development, or a deployment where mail is not wired up yet -- the
 * message is logged instead of being dropped, so the invitation link is still
 * recoverable from the server output. sendInvite() reports which of the two
 * happened, because an administrator needs to know whether to expect an email
 * or to copy a link by hand.
 *
 * Server-only.
 */

export type MailResult =
  | { delivered: true; transport: "smtp" }
  | { delivered: false; transport: "console"; link: string }
  | { delivered: false; transport: "smtp"; error: string };

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function fromAddress(): string {
  return process.env["MAIL_FROM"] ?? "Elev8 Services <no-reply@withelev8.com>";
}

/**
 * nodemailer is an optional dependency: the app runs without it, it is only
 * needed to actually deliver mail.
 */
async function smtpTransport() {
  const url = process.env["SMTP_URL"];
  if (!url) return null;
  try {
    const nodemailer = await import("nodemailer");
    return nodemailer.createTransport(url);
  } catch {
    console.warn(
      "[mail] SMTP_URL is set but nodemailer is not installed; falling back to console.",
    );
    return null;
  }
}

async function send(message: Message, fallbackLink: string): Promise<MailResult> {
  const transport = await smtpTransport();

  if (!transport) {
    console.info(
      `\n[mail] No SMTP_URL configured. Not sending "${message.subject}" to ${message.to}.\n` +
        `[mail] Link: ${fallbackLink}\n`,
    );
    return { delivered: false, transport: "console", link: fallbackLink };
  }

  try {
    await transport.sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true, transport: "smtp" };
  } catch (error) {
    return {
      delivered: false,
      transport: "smtp",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * The staff invitation and password-reset email. `mode` only changes the
 * wording -- both carry a single-use link to the set-password page.
 */
export function sendInvite(options: {
  to: string;
  fullName: string;
  link: string;
  mode: "invite" | "recovery";
}): Promise<MailResult> {
  const greeting = options.fullName ? `Hi ${options.fullName},` : "Hello,";
  const subject =
    options.mode === "invite"
      ? "Your Elev8 Services Team Portal invitation"
      : "Set a new Elev8 Services Team Portal password";
  const lead =
    options.mode === "invite"
      ? "An administrator has created a Team Portal account for you. Choose a password to finish setting it up."
      : "A password reset was requested for your Team Portal account. Choose a new password below.";

  const text = `${greeting}\n\n${lead}\n\n${options.link}\n\nThis link can be used once and expires in 72 hours.\n\nIf you were not expecting this email, you can ignore it.\n\n— Elev8 Services California`;

  const html = `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;padding:32px 16px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#17303f">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px">Elev8 Services Team Portal</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${escapeHtml(lead)}</p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(options.link)}"
           style="display:inline-block;background:#0f7d8c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">
          Choose your password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#5b6b76;line-height:1.6">
        This link can be used once and expires in 72 hours.
      </p>
      <p style="margin:0;font-size:13px;color:#5b6b76;line-height:1.6">
        If you were not expecting this email, you can ignore it.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return send({ to: options.to, subject, text, html }, options.link);
}
