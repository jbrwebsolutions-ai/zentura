import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

// ============================================
// CONFIGURATIE
// ============================================
const CONFIG = {
  companyName: 'Zentura BV',
  websiteUrl: 'zentura.nl',
  rateLimitWindow: 60 * 60 * 1000, // 1 uur
  maxSubmissions: 5,
  urgentieLabels: {
    'spoed': 'Spoed — Vandaag/morgen (€40/u)',
    'standaard': 'Standaard — Deze week (€30/u)',
    'project': 'Project & Vast — Langdurig (€25/u)',
  } as Record<string, string>,
};

// ============================================
// RATE LIMITING
// ============================================
const submissions = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissions.get(ip) || []).filter(t => now - t < CONFIG.rateLimitWindow);
  submissions.set(ip, recent);
  return recent.length >= CONFIG.maxSubmissions;
}

function recordSubmission(ip: string): void {
  const list = submissions.get(ip) || [];
  list.push(Date.now());
  submissions.set(ip, list);
}

// ============================================
// CLOUDFLARE TURNSTILE
// ============================================
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secretKey = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return true;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
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
  locatie: string;
  bericht: string;
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<p class="label">${label}</p><p class="value">${value}</p>`;
}

function notificationHtml(d: AanvraagData): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #052771; padding: 24px 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f8fafc; padding: 24px 20px; border: 1px solid #e2e8f0; border-top: none; }
  .section { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin: 0 0 12px 0; }
  .label { font-weight: bold; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 10px 0 2px 0; }
  .value { color: #161d30; margin: 0 0 8px 0; font-size: 15px; }
  .urgentie { display: inline-block; background: #fe7303; color: white; font-weight: bold; font-size: 13px; padding: 4px 12px; border-radius: 20px; }
  .msg-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; font-size: 14px; color: #334155; }
  .footer { background: #161d30; color: #94a3b8; padding: 15px 20px; font-size: 12px; border-radius: 0 0 8px 8px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;color:#fe7303;font-size:20px">Nieuwe personeelsaanvraag</h2>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px">Via ${CONFIG.websiteUrl}</p>
  </div>
  <div class="content">

    <div class="section">
      <p class="section-title">Contactgegevens</p>
      ${row('Naam', d.naam)}
      ${row('Bedrijf', d.bedrijf)}
      ${row('Email', `<a href="mailto:${d.email}" style="color:#052771">${d.email}</a>`)}
      ${d.telefoon ? row('Telefoon', `<a href="tel:${d.telefoon}" style="color:#052771">${d.telefoon}</a>`) : ''}
    </div>

    <div class="section">
      <p class="section-title">De opdracht</p>
      ${row('Soort werkzaamheden', d.soortWerk)}
      ${row('Aantal personen', d.aantal)}
      ${row('Gewenste startdatum', d.startdatum)}
      ${row('Verwachte duur', d.duur)}
      ${d.locatie ? row('Locatie / regio', d.locatie) : ''}
      ${d.urgentie ? `<p class="label">Urgentie</p><p class="value"><span class="urgentie">${d.urgentie}</span></p>` : ''}
    </div>

    ${d.bericht ? `
    <div class="section">
      <p class="section-title">Extra informatie</p>
      <div class="msg-box">${d.bericht.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
    </div>` : ''}

  </div>
  <div class="footer">Ontvangen via contactformulier op ${CONFIG.websiteUrl}</div>
</div>
</body>
</html>`.trim();
}

function confirmationHtml(d: { naam: string; urgentie: string; bericht: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #052771; padding: 24px 20px; border-radius: 8px 8px 0 0; text-align: center; }
  .content { background: #f8fafc; padding: 24px 20px; border: 1px solid #e2e8f0; border-top: none; }
  .highlight { background: white; border-left: 4px solid #fe7303; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }
  .footer { background: #161d30; color: #94a3b8; padding: 15px 20px; font-size: 12px; border-radius: 0 0 8px 8px; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin:0;color:#fe7303">Aanvraag ontvangen!</h2>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px">Zentura BV</p>
  </div>
  <div class="content">
    <p>Beste ${d.naam},</p>
    <p>Bedankt voor uw aanvraag bij <strong>Zentura BV</strong>. We nemen zo snel mogelijk contact met u op.</p>

    <div class="highlight">
      ${d.urgentie.toLowerCase().includes('spoed')
        ? '<p style="margin:0 0 4px;font-weight:bold;color:#fe7303">⚡ Spoedaanvraag</p><p style="margin:0;font-size:14px;color:#475569">We streven ernaar u <strong>binnen 5 minuten</strong> terug te bellen.</p>'
        : '<p style="margin:0 0 4px;font-weight:bold;color:#052771">Reactietijd</p><p style="margin:0;font-size:14px;color:#475569">We nemen <strong>dezelfde dag</strong> nog contact met u op.</p>'
      }
    </div>

    ${d.bericht ? `
    <p><strong>Uw aanvraag:</strong></p>
    <p style="color:#475569;font-size:14px">${d.bericht.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ''}

    <p>Met vriendelijke groet,<br><strong style="color:#fe7303">Zentura BV</strong></p>
    <p style="font-size:13px;color:#94a3b8">Spoed? Bel direct: +31 6 17 75 26 44 (Bussum) of +31 6 13 77 37 24 (Heerenveen)</p>
  </div>
  <div class="footer">Dit is een automatisch bericht. U kunt direct antwoorden op deze email.</div>
</div>
</body>
</html>`.trim();
}

// ============================================
// API HANDLER
// ============================================
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const formData = await request.formData();

    // Honeypot
    if (formData.get('website')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting
    const ip = clientAddress || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({
        success: false, error: 'Te veel aanvragen. Probeer het later opnieuw.'
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    // Turnstile verificatie
    const turnstileToken = formData.get('cf-turnstile-response')?.toString();
    if (turnstileToken) {
      const valid = await verifyTurnstile(turnstileToken, ip);
      if (!valid) {
        return new Response(JSON.stringify({
          success: false, error: 'Verificatie mislukt. Ververs de pagina en probeer opnieuw.'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Form data — aanvraagformulier velden
    const naam = formData.get('naam')?.toString().trim() || '';
    const email = formData.get('email')?.toString().trim() || '';
    const telefoon = formData.get('telefoon')?.toString().trim() || '';
    const bedrijf = formData.get('bedrijf')?.toString().trim() || '';
    const soortWerk = formData.get('soort_werk')?.toString().trim() || '';
    const aantal = formData.get('aantal')?.toString().trim() || '';
    const startdatum = formData.get('startdatum')?.toString().trim() || '';
    const duur = formData.get('duur')?.toString().trim() || '';
    const urgentieRaw = formData.get('urgentie')?.toString().trim() || '';
    const locatie = formData.get('locatie')?.toString().trim() || '';
    const bericht = formData.get('bericht')?.toString().trim() || '';

    // Validatie
    if (!naam || !email || !telefoon || !bedrijf || !bericht) {
      return new Response(JSON.stringify({
        success: false, error: 'Vul alle verplichte velden in.'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false, error: 'Voer een geldig emailadres in.'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const urgentie = CONFIG.urgentieLabels[urgentieRaw] || urgentieRaw || 'Niet opgegeven';

    const aanvraagData: AanvraagData = {
      naam, email, telefoon, bedrijf,
      soortWerk, aantal, startdatum, duur,
      urgentie, locatie, bericht,
    };

    // SMTP configuratie
    const smtpHost = import.meta.env.SMTP_HOST;
    const smtpPort = parseInt(import.meta.env.SMTP_PORT || '587');
    const smtpUser = import.meta.env.SMTP_USER;
    const smtpPass = import.meta.env.SMTP_PASS;
    const mailTo = import.meta.env.MAIL_TO || 'Verkoop@zenturabv.com';
    const mailFrom = import.meta.env.MAIL_FROM;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log('=== ZENTURA AANVRAAG (dev mode) ===');
      console.log('Bedrijf:', bedrijf, '|', 'Naam:', naam);
      console.log('Email:', email, '| Telefoon:', telefoon);
      console.log('Soort werk:', soortWerk, '| Aantal:', aantal);
      console.log('Start:', startdatum, '| Duur:', duur);
      console.log('Urgentie:', urgentie, '| Locatie:', locatie);
      console.log('Bericht:', bericht);
      console.log('===================================');

      if (import.meta.env.DEV) {
        recordSubmission(ip);
        return new Response(JSON.stringify({
          success: true, message: 'Aanvraag ontvangen (development mode)'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: false, error: 'Email service tijdelijk niet beschikbaar.'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const urgentieShort = urgentieRaw === 'spoed' ? '⚡ SPOED' : urgentieRaw === 'standaard' ? 'Standaard' : 'Project';
    const subjectLine = `[${urgentieShort}] Aanvraag: ${bedrijf} — ${soortWerk || naam}`;

    // Notificatie naar Zentura
    await transporter.sendMail({
      from: `"Zentura Website" <${mailFrom}>`,
      to: mailTo,
      replyTo: email,
      subject: subjectLine,
      text: [
        `Nieuwe personeelsaanvraag via ${CONFIG.websiteUrl}`,
        '',
        `Bedrijf: ${bedrijf}`,
        `Naam: ${naam}`,
        `Email: ${email}`,
        `Telefoon: ${telefoon}`,
        '',
        `Soort werkzaamheden: ${soortWerk || '—'}`,
        `Aantal personen: ${aantal || '—'}`,
        `Gewenste startdatum: ${startdatum || '—'}`,
        `Verwachte duur: ${duur || '—'}`,
        `Urgentie: ${urgentie}`,
        `Locatie / regio: ${locatie || '—'}`,
        '',
        `Extra informatie:`,
        bericht,
      ].join('\n'),
      html: notificationHtml(aanvraagData),
    });

    // Bevestiging naar aanvrager
    transporter.sendMail({
      from: `"Zentura BV" <${mailFrom}>`,
      to: email,
      subject: `Bedankt voor uw aanvraag — Zentura BV`,
      text: [
        `Beste ${naam},`,
        '',
        `Bedankt voor uw aanvraag bij Zentura BV. We nemen zo snel mogelijk contact met u op.`,
        urgentieRaw === 'spoed' ? 'Bij spoedaanvragen streven we ernaar u binnen 5 minuten terug te bellen.' : 'We nemen dezelfde dag nog contact met u op.',
        '',
        `Uw aanvraag: ${bericht}`,
        '',
        'Met vriendelijke groet,',
        'Zentura BV',
        '',
        'Spoed? Bel direct: +31 6 17 75 26 44 (Bussum) of +31 6 13 77 37 24 (Heerenveen)',
      ].join('\n'),
      html: confirmationHtml({ naam, urgentie, bericht }),
    }).catch(console.error);

    recordSubmission(ip);

    return new Response(JSON.stringify({
      success: true, message: 'Bedankt! We nemen zo snel mogelijk contact met u op.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({
      success: false, error: 'Er is iets misgegaan. Probeer het opnieuw of bel ons direct.'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const prerender = false;
