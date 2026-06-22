/**
 * Resend email alert sender for CardStrike.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "alerts@cardstrike.gg";

// Brand palette
const PURPLE = "#1D1160";
const ORANGE = "#E56020";
const GOLD = "#F9AD1B";
const PURPLE_DEEP = "#150B45";

export interface AlertEmailParams {
  toEmail: string;
  toName: string | null;
  cardName: string;
  grade: string;
  listingPrice: number; // cents
  fairValue: number; // cents
  discountPct: number;
  listingUrl: string;
}

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

function buildHtml(p: AlertEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CardStrike Alert</title>
</head>
<body style="margin:0;padding:0;background:${PURPLE_DEEP};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PURPLE_DEEP};padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PURPLE};border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${PURPLE};padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.1);">
              <span style="font-size:20px;font-weight:700;color:#fff;">
                Card<span style="color:${GOLD};">Strike</span>
              </span>
            </td>
          </tr>

          <!-- Lightning badge -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="display:inline-block;background:${ORANGE};color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 16px;border-radius:999px;text-transform:uppercase;">
                ⚡ Strike Alert
              </div>
            </td>
          </tr>

          <!-- Card name -->
          <tr>
            <td style="padding:20px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:22px;color:#fff;line-height:1.3;">
                ${p.cardName}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:14px;">${p.grade}</p>
            </td>
          </tr>

          <!-- Price block -->
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="width:50%;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Listing Price</p>
                    <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:${GOLD};">${cents(p.listingPrice)}</p>
                  </td>
                  <td width="16"></td>
                  <td align="center" style="width:50%;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Market Value</p>
                    <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:rgba(255,255,255,0.4);text-decoration:line-through;">${cents(p.fairValue)}</p>
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px;text-align:center;background:rgba(229,96,32,0.15);border:1px solid rgba(229,96,32,0.4);border-radius:8px;padding:12px;">
                <span style="color:${ORANGE};font-size:18px;font-weight:700;">${p.discountPct}% below market</span>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${p.listingUrl}"
                 style="display:inline-block;background:${ORANGE};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:999px;">
                View Listing on eBay →
              </a>
              <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);">
                You set this alert on CardStrike. Reply to unsubscribe.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<void> {
  const subject = `⚡ CardStrike Alert — ${params.cardName} is ${params.discountPct}% below market`;
  await resend.emails.send({
    from: FROM,
    to: params.toEmail,
    subject,
    html: buildHtml(params),
  });
}

// ---------------------------------------------------------------------------
// Trade offer emails
// ---------------------------------------------------------------------------

export interface TradeOfferEmailParams {
  toEmail: string;
  toName: string | null;
  listingCardName: string;
  offererName: string;
  offeredCards: { name: string; grade: string; estimatedValue: number }[];
  cashAddon: number;
  message: string | null;
  offerUrl: string;
}

export async function sendTradeOfferEmail(p: TradeOfferEmailParams): Promise<void> {
  const cardRows = p.offeredCards
    .map(
      (c) =>
        `<tr><td style="padding:6px 0;color:#fff;font-size:14px;">${c.name}</td><td style="padding:6px 0;color:${GOLD};font-size:14px;text-align:right;">$${c.estimatedValue.toFixed(2)} · ${c.grade}</td></tr>`,
    )
    .join("");

  const cashRow =
    p.cashAddon > 0
      ? `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.5);font-size:14px;">+ Cash add-on</td><td style="padding:6px 0;color:${GOLD};font-size:14px;text-align:right;">$${p.cashAddon.toFixed(2)}</td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Trade Offer</title></head>
<body style="margin:0;padding:0;background:${PURPLE_DEEP};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PURPLE_DEEP};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PURPLE};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:20px;font-weight:700;color:#fff;">Card<span style="color:${GOLD};">Strike</span></span>
        </td></tr>
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <div style="display:inline-block;background:${ORANGE};color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 16px;border-radius:999px;text-transform:uppercase;">🤝 New Trade Offer</div>
        </td></tr>
        <tr><td style="padding:20px 32px 0;text-align:center;">
          <h1 style="margin:0;font-size:20px;color:#fff;">${p.offererName} wants to trade for your</h1>
          <p style="margin:8px 0 0;font-size:22px;font-weight:700;color:${GOLD};">${p.listingCardName}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">They're offering</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.1);">
            ${cardRows}${cashRow}
          </table>
          ${p.message ? `<div style="margin-top:16px;background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Message</p><p style="margin:6px 0 0;font-size:14px;color:#fff;">${p.message}</p></div>` : ""}
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="${p.offerUrl}" style="display:inline-block;background:${ORANGE};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:999px;">View Offer →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: p.toEmail,
    subject: `⚡ CardStrike — New trade offer on your ${p.listingCardName}`,
    html,
  });
}

export interface TradeAcceptedEmailParams {
  toEmail: string;
  toName: string | null;
  yourCardName: string;
  theirCardName: string;
  traderName: string;
  tradeUrl: string;
}

export async function sendTradeAcceptedEmail(p: TradeAcceptedEmailParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Trade Accepted</title></head>
<body style="margin:0;padding:0;background:${PURPLE_DEEP};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PURPLE_DEEP};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PURPLE};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:20px;font-weight:700;color:#fff;">Card<span style="color:${GOLD};">Strike</span></span>
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <div style="display:inline-block;background:#22c55e;color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 16px;border-radius:999px;text-transform:uppercase;">✓ Trade Accepted</div>
          <h1 style="margin:20px 0 8px;font-size:22px;color:#fff;">Your trade with ${p.traderName} is on!</h1>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);">${p.yourCardName} ↔ ${p.theirCardName}</p>
          <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">Please coordinate shipping and payment of any platform fees through the CardStrike platform.</p>
          <a href="${p.tradeUrl}" style="display:inline-block;margin-top:24px;background:${ORANGE};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:999px;">View Trade Details →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: p.toEmail,
    subject: `✓ CardStrike — Trade accepted with ${p.traderName}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Parent approval email
// ---------------------------------------------------------------------------

export interface ParentApprovalEmailParams {
  toEmail: string;
  childUsername: string;
  approvalUrl: string;
}

export async function sendParentApprovalEmail(p: ParentApprovalEmailParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Parent Approval</title></head>
<body style="margin:0;padding:0;background:${PURPLE_DEEP};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PURPLE_DEEP};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PURPLE};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:20px;font-weight:700;color:#fff;">Card<span style="color:${GOLD};">Strike</span></span>
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#fff;">Parental Approval Required</h1>
          <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.7);">
            Your child <strong style="color:#fff;">${p.childUsername}</strong> has created a CardStrike account
            for trading sports and collectible cards. Their account is currently limited to browse-only
            until you approve it.
          </p>
          <a href="${p.approvalUrl}" style="display:inline-block;background:${ORANGE};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:999px;">
            Approve Account →
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);">
            If you did not expect this email, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  await resend.emails.send({
    from: FROM,
    to: p.toEmail,
    subject: `CardStrike — Parental approval needed for ${p.childUsername}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Admin report notification
// ---------------------------------------------------------------------------

export interface ReportNotificationParams {
  reporterName: string;
  reportedUserName: string;
  reason: string;
  details: string | null;
  listingId: string | null;
  offerId: string | null;
}

export async function sendReportNotification(p: ReportNotificationParams): Promise<void> {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "poundmatt1122@gmail.com";
  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[CardStrike] New report: ${p.reason}`,
    html: `<pre style="font-family:monospace;background:#111;color:#eee;padding:16px;border-radius:8px;">${JSON.stringify(p, null, 2)}</pre>`,
  });
}
