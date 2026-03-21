/**
 * Cloudflare Pages Function - Zentura BV Contact/Aanvraag Handler
 * AWS SES via aws4fetch (Workers-compatible, geen Node.js nodig)
 */

import { AwsClient } from 'aws4fetch';

interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_SES_FROM_EMAIL: string;
  MAIL_TO: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_MAX?: string;
}

// Rate limiting (in-memory, reset bij elke deployment)
const submissions = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function isRateLimited(ip: string, max = 5): boolean {
  const now = Date.now();
  const recent = (submissions.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  submissions.set(ip, recent);
  return recent.length >= max;
}

function recordSubmission(ip: string): void {
  const list = submissions.get(ip) || [];
  list.push(Date.now());
  submissions.set(ip, list);
}

async function verifyTurnstile(token: string, ip: string, secretKey?: string): Promise<boolean> {
  if (!secretKey) return true;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

async function sendViaSES(
  env: Env,
  params: { to: string; replyTo?: string; subject: string; text: string; html: string }
): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
  });

  const sesParams = new URLSearchParams({
    Action: 'SendEmail',
    Source: env.AWS_SES_FROM_EMAIL,
    'Destination.ToAddresses.member.1': params.to,
    'Message.Subject.Data': params.subject,
    'Message.Subject.Charset': 'UTF-8',
    'Message.Body.Text.Data': params.text,
    'Message.Body.Text.Charset': 'UTF-8',
    'Message.Body.Html.Data': params.html,
    'Message.Body.Html.Charset': 'UTF-8',
  });

  if (params.replyTo) {
    sesParams.append('ReplyToAddresses.member.1', params.replyTo);
  }

  const response = await aws.fetch(`https://email.${env.AWS_REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: sesParams.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`SES error ${response.status}: ${err}`);
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

interface AanvraagData {
  naam: string;
  email: string;
  telefoon: string;
  bedrijf: string;
  soortWerk: string;
  aantal: string;
  startdatum: string;
  duur: string;
  urgentie: string;
  urgentieRaw: string;
  locatie: string;
  bericht: string;
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:10px 0 2px 0;">${label}</p>
          <p style="font-size:15px;color:#161d30;margin:0 0 6px 0;">${value}</p>`;
}

function notificationHtml(d: AanvraagData): string {
  const urgentieBadge = `<span style="display:inline-block;background:#fe7303;color:white;font-weight:bold;font-size:13px;padding:4px 14px;border-radius:20px;">${d.urgentie}</span>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f1f5f9;">
<div style="max-width:600px;margin:24px auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

  <div style="background:#052771;padding:24px 20px;">
    <h2 style="margin:0;color:#fe7303;font-size:20px;">Nieuwe personeelsaanvraag</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.55);font-size:13px;">Via zentura.nl</p>
  </div>

  <div style="background:#f8fafc;padding:24px 20px;">

    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 12px 0;">Contactgegevens</p>
      ${row('Bedrijf', d.bedrijf)}
      ${row('Naam', d.naam)}
      ${row('Email', `<a href="mailto:${d.email}" style="color:#052771;">${d.email}</a>`)}
      ${row('Telefoon', `<a href="tel:${d.telefoon}" style="color:#052771;">${d.telefoon}</a>`)}
    </div>

    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 12px 0;">De opdracht</p>
      ${row('Soort werkzaamheden', d.soortWerk)}
      ${row('Aantal personen', d.aantal)}
      ${row('Gewenste startdatum', d.startdatum)}
      ${row('Verwachte duur', d.duur)}
      ${row('Locatie / regio', d.locatie)}
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:10px 0 6px 0;">Urgentie</p>
      ${urgentieBadge}
    </div>

    ${d.bericht ? `
    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:0 0 12px 0;">Extra informatie</p>
      <div style="background:#f8fafc;padding:14px;border-radius:6px;font-size:14px;color:#334155;white-space:pre-wrap;">${d.bericht.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>` : ''}

  </div>

  <div style="background:#161d30;color:#94a3b8;padding:14px 20px;font-size:12px;">
    Ontvangen via contactformulier op zentura.nl
  </div>

</div>
</body>
</html>`.trim();
}

function notificationText(d: AanvraagData): string {
  return [
    'NIEUWE PERSONEELSAANVRAAG — zentura.nl',
    '',
    'CONTACTGEGEVENS',
    `Bedrijf:  ${d.bedrijf}`,
    `Naam:     ${d.naam}`,
    `Email:    ${d.email}`,
    `Telefoon: ${d.telefoon}`,
    '',
    'DE OPDRACHT',
    `Soort werk:  ${d.soortWerk || 'Niet opgegeven'}`,
    `Aantal:      ${d.aantal || 'Niet opgegeven'}`,
    `Startdatum:  ${d.startdatum || 'Niet opgegeven'}`,
    `Duur:        ${d.duur || 'Niet opgegeven'}`,
    `Locatie:     ${d.locatie || 'Niet opgegeven'}`,
    `Urgentie:    ${d.urgentie}`,
    d.bericht ? `\nEXTRA INFORMATIE\n${d.bericht}` : '',
  ].join('\n').trim();
}

function confirmationHtml(d: { naam: string; urgentieRaw: string }): string {
  const isSpoed = d.urgentieRaw === 'spoed';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f1f5f9;">
<div style="max-width:600px;margin:24px auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

  <div style="background:#052771;padding:28px 20px;text-align:center;">
    <h2 style="margin:0;color:#fe7303;">Aanvraag ontvangen</h2>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">Zentura BV</p>
  </div>

  <div style="background:#f8fafc;padding:28px 20px;">
    <p>Beste ${d.naam},</p>
    <p>Bedankt voor uw aanvraag bij <strong>Zentura BV</strong>. We hebben uw aanvraag ontvangen en nemen zo snel mogelijk contact met u op.</p>

    <div style="background:white;border-left:4px solid #fe7303;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
      ${isSpoed
        ? '<p style="margin:0 0 4px;font-weight:bold;color:#fe7303;">Spoedaanvraag ontvangen</p><p style="margin:0;font-size:14px;color:#475569;">We streven ernaar u <strong>binnen 5 minuten</strong> terug te bellen.</p>'
        : '<p style="margin:0 0 4px;font-weight:bold;color:#052771;">Reactietijd</p><p style="margin:0;font-size:14px;color:#475569;">We nemen <strong>dezelfde dag</strong> nog contact met u op.</p>'
      }
    </div>

    <p>Met vriendelijke groet,<br><strong style="color:#fe7303;">Zentura BV</strong></p>
    <p style="font-size:13px;color:#94a3b8;">Spoed? Bel direct: +31 6 17 75 26 44 (Bussum) of +31 6 13 77 37 24 (Heerenveen)</p>
  </div>

  <div style="background:#161d30;color:#94a3b8;padding:14px 20px;font-size:12px;text-align:center;">
    Dit is een automatisch bericht. U kunt direct antwoorden op deze email.
  </div>

</div>
</body>
</html>`.trim();
}

function confirmationText(d: { naam: string; urgentieRaw: string }): string {
  const isSpoed = d.urgentieRaw === 'spoed';
  return [
    `Beste ${d.naam},`,
    '',
    'Bedankt voor uw aanvraag bij Zentura BV.',
    isSpoed
      ? 'We streven ernaar u binnen 5 minuten terug te bellen.'
      : 'We nemen dezelfde dag nog contact met u op.',
    '',
    'Met vriendelijke groet,',
    'Zentura BV',
    '',
    'Spoed? Bel direct: +31 6 17 75 26 44 (Bussum) of +31 6 13 77 37 24 (Heerenveen)',
  ].join('\n');
}

// ============================================
// HANDLER
// ============================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const URGENTIE_LABELS: Record<string, string> = {
  spoed:     'Spoed — Vandaag/morgen (€40/u)',
  standaard: 'Standaard — Deze week (€30/u)',
  project:   'Project en Vast — Langdurig (€25/u)',
};

export async function onRequestPost(context: {
  request: Request;
  env: Env;
  waitUntil: (p: Promise<unknown>) => void;
}): Promise<Response> {
  const { request, env, waitUntil } = context;

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const formData = await request.formData();

    // Honeypot
    if (formData.get('website')) return json({ success: true });

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const max = parseInt(env.RATE_LIMIT_MAX || '5');
    if (isRateLimited(ip, max)) {
      return json({ success: false, error: 'Te veel aanvragen. Probeer het later opnieuw.' }, 429);
    }

    // Turnstile
    const turnstileToken = formData.get('cf-turnstile-response')?.toString();
    if (turnstileToken) {
      const valid = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);
      if (!valid) {
        return json({ success: false, error: 'Verificatie mislukt. Ververs de pagina en probeer opnieuw.' }, 400);
      }
    }

    // Velden
    const naam       = formData.get('naam')?.toString().trim() || '';
    const email      = formData.get('email')?.toString().trim() || '';
    const telefoon   = formData.get('telefoon')?.toString().trim() || '';
    const bedrijf    = formData.get('bedrijf')?.toString().trim() || '';
    const soortWerk  = formData.get('soort_werk')?.toString().trim() || '';
    const aantal     = formData.get('aantal')?.toString().trim() || '';
    const startdatum = formData.get('startdatum')?.toString().trim() || '';
    const duur       = formData.get('duur')?.toString().trim() || '';
    const urgentieRaw = formData.get('urgentie')?.toString().trim() || '';
    const locatie    = formData.get('locatie')?.toString().trim() || '';
    const bericht    = formData.get('bericht')?.toString().trim() || '';

    // Validatie
    if (!naam || !email || !telefoon || !bedrijf) {
      return json({ success: false, error: 'Vul alle verplichte velden in.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: 'Voer een geldig emailadres in.' }, 400);
    }

    const urgentie = URGENTIE_LABELS[urgentieRaw] || urgentieRaw || 'Niet opgegeven';
    const urgentieShort = urgentieRaw === 'spoed' ? 'SPOED' : urgentieRaw === 'project' ? 'Project' : 'Standaard';

    const aanvraag: AanvraagData = {
      naam, email, telefoon, bedrijf,
      soortWerk, aantal, startdatum, duur,
      urgentie, urgentieRaw, locatie, bericht,
    };

    const subject = `[${urgentieShort}] Aanvraag: ${bedrijf} — ${soortWerk || naam}`;

    // Notificatie naar Zentura
    await sendViaSES(env, {
      to: env.MAIL_TO,
      replyTo: email,
      subject,
      text: notificationText(aanvraag),
      html: notificationHtml(aanvraag),
    });

    // Bevestiging naar aanvrager (non-blocking)
    waitUntil(
      sendViaSES(env, {
        to: email,
        replyTo: env.MAIL_TO,
        subject: 'Uw aanvraag is ontvangen — Zentura BV',
        text: confirmationText({ naam, urgentieRaw }),
        html: confirmationHtml({ naam, urgentieRaw }),
      }).catch(console.error)
    );

    recordSubmission(ip);

    return json({ success: true, message: 'Bedankt! We nemen zo snel mogelijk contact met u op.' });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Contact form error:', msg);
    return json({ success: false, error: 'Er is iets misgegaan. Probeer het opnieuw of bel ons direct.' }, 500);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { headers: CORS });
}
