import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends transactional email via Resend when RESEND_API_KEY is configured.
 * Falls back cleanly to console.log when the key is missing (Roadmap Phase 9 decision)
 * and never throws so order/status mutations are never blocked by email transport issues.
 */
export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean; fallback: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Digital Heroes <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("[email:fallback]", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { delivered: false, fallback: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      console.error("[email:error]", error.message);
      return { delivered: false, fallback: false };
    }

    return { delivered: true, fallback: false };
  } catch (error) {
    console.error("[email:exception]", error);
    return { delivered: false, fallback: false };
  }
}

export async function sendOrderStatusEmail(params: {
  to: string;
  orderReference: string;
  fromStatus: string;
  toStatus: string;
}) {
  const subject = `Order ${params.orderReference} moved to ${params.toStatus}`;
  const text = [
    `Hello,`,
    ``,
    `Your Digital Heroes order ${params.orderReference} has been updated from "${params.fromStatus}" to "${params.toStatus}".`,
    ``,
    `Sign in to your customer dashboard to view the latest status and proofs.`,
  ].join("\n");

  return sendEmail({ to: params.to, subject, text });
}

export async function sendOrderPaidEmail(params: {
  to: string;
  orderReference: string;
  totalFormatted: string;
}) {
  const subject = `Payment confirmed for order ${params.orderReference}`;
  const text = [
    `Hello,`,
    ``,
    `We have received your payment of ${params.totalFormatted} for order ${params.orderReference}.`,
    `Your next step is to review and approve your digital proof in your customer dashboard.`,
  ].join("\n");

  return sendEmail({ to: params.to, subject, text });
}

export async function sendProofStatusEmail(params: {
  to: string;
  orderReference: string;
  version: number;
  action: "approved" | "changes_requested";
  note?: string;
}) {
  const label = params.action === "approved" ? "approved" : "changes requested";
  const subject = `Proof v${params.version} ${label} — Order ${params.orderReference}`;
  const lines = [
    `Hello,`,
    ``,
    `Proof v${params.version} for order ${params.orderReference} has been marked as: ${label}.`,
  ];
  if (params.note) {
    lines.push(``, `Customer note: ${params.note}`);
  }

  return sendEmail({ to: params.to, subject, text: lines.join("\n") });
}
