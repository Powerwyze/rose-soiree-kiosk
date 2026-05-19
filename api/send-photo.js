/**
 * Bartenura Rosé Soirée Photo Booth — Email Delivery
 *
 * POST JSON: { email, filename, mimeType, imageBase64 }
 * Sends the generated watercolor Bartenura Rosé portrait to the guest via Gmail SMTP.
 *
 * Email branding: Bartenura Sparkling Rosé. Painted by PowerWyze.
 * Instagram tags: @bartenurarose, @powerwyze. Event hashtag: #BartenuraRose (placeholder).
 *
 * Env (preferred — wyzer):
 *   WYZER_APP_PASSWORD    Gmail app password for wyzer@powerwyze.com
 *   WYZER_GMAIL_USER      defaults to "wyzer@powerwyze.com"
 *
 * Env (fallback — legacy):
 *   GOOGLE_APP_PASSWORD   Gmail app password
 *   GMAIL_USER            defaults to "spc.bstewart@gmail.com"
 *
 *   FROM_NAME             default: "Bartenura Rosé Soirée"
 *   EVENT_HASHTAG         default: "#BartenuraRose"  (placeholder — update once confirmed)
 */

const nodemailer = require("nodemailer");

function setCors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJson(req){
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", c => { raw += c; if (raw.length > 12 * 1024 * 1024) reject(new Error("Payload too large")); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");

module.exports = async function handler(req, res){
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST")    { res.statusCode = 405; return res.end("Method not allowed"); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end("Invalid JSON: " + e.message); }

  const { email, filename, mimeType, imageBase64 } = body || {};
  if (!isEmail(email))   { res.statusCode = 400; return res.end("Invalid email"); }
  if (!imageBase64)      { res.statusCode = 400; return res.end("Missing imageBase64"); }

  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  if (!pass) { res.statusCode = 500; return res.end("App password not configured (WYZER_APP_PASSWORD)"); }

  const user = process.env.WYZER_GMAIL_USER
            || process.env.GMAIL_USER
            || "wyzer@powerwyze.com";
  const fromName = process.env.FROM_NAME || "Bartenura Rosé Soirée";
  // EVENT_HASHTAG placeholder — update once Kelly-Ann confirms the final tag.
  const eventHashtag = process.env.EVENT_HASHTAG || "#BartenuraRose";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const safeFilename = String(filename || "bartenura-rose-portrait.png")
    .replace(/[^a-z0-9@._-]/gi, "_")
    .slice(0, 200);

  const html = `<!doctype html><html><body style="font-family:Georgia,'Playfair Display',serif;background:#0a0608;color:#f6e9dc;padding:24px;margin:0">
    <div style="max-width:560px;margin:0 auto;background:#14090f;border:1px solid rgba(240,166,192,0.22);border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.45)">
      <div style="padding:26px 28px 18px 28px;border-bottom:1px solid rgba(240,166,192,0.22);text-align:center;background:linear-gradient(180deg,#1f131a 0%,#14090f 100%)">
        <div style="font-family:'Pinyon Script',Georgia,cursive;font-size:38px;color:#f0a6c0;line-height:1;margin-bottom:4px;font-style:italic">Bartenura</div>
        <div style="font-family:Georgia,'Playfair Display',serif;font-size:22px;letter-spacing:6px;color:#f6e9dc;font-weight:700">ROSÉ SOIRÉE</div>
        <div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#d9b486;margin-top:6px;text-transform:uppercase">Southampton · Watercolor Portraits</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#d6c0ad;margin-top:10px">Presented around <strong style="color:#f0a6c0;font-style:normal">Bartenura Sparkling Rosé</strong></div>
      </div>
      <div style="padding:24px 28px;font-family:Georgia,serif;color:#f6e9dc">
        <h1 style="margin:0 0 8px 0;font-size:24px;color:#f6e9dc;font-weight:600">✦ Your Bartenura Rosé portrait is ready</h1>
        <p style="margin:0 0 18px 0;color:#d6c0ad;line-height:1.6;font-size:15px;font-family:Arial,sans-serif">Thanks for stopping by the <strong style="color:#f0a6c0">Bartenura Rosé portrait booth</strong>. Your watercolor souvenir is attached — painted just for you, Hamptons-summer mood.</p>

        <div style="margin:18px 0;padding:18px 20px;background:rgba(240,166,192,0.10);border:1px solid rgba(240,166,192,0.28);border-radius:14px">
          <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d9b486;margin-bottom:8px;font-weight:700">✦ Share the moment</div>
          <p style="margin:0 0 12px 0;color:#f6e9dc;font-size:14px;line-height:1.55;font-family:Arial,sans-serif">Post your portrait on Instagram, follow <strong style="color:#f0a6c0">@bartenurarose</strong>, and tag <strong style="color:#ff9ec1">${eventHashtag}</strong> — repost &amp; we'll feature our favorites all weekend.</p>
          <a href="https://instagram.com/bartenurarose" style="display:inline-block;background:linear-gradient(135deg,#f0a6c0 0%,#d97aa0 100%);color:#1a0c12;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:2px;padding:11px 20px;border-radius:999px;font-family:Arial,sans-serif">Follow @bartenurarose →</a>
        </div>

        <p style="margin:18px 0 4px 0;color:#8a7a6b;font-size:12px;font-family:Arial,sans-serif;font-style:italic">— ${fromName}</p>
      </div>
      <div style="padding:14px 24px 18px;border-top:1px solid rgba(240,166,192,0.22);text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#8a7a6b;letter-spacing:1px;background:#0a0608">
        Sponsored by <strong style="color:#f0a6c0">Bartenura Rosé</strong> · Painted by <strong style="color:#f0a6c0">PowerWyze</strong>
      </div>
    </div>
  </body></html>`;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: email,
      subject: "Your Bartenura Rosé Soirée portrait ✦",
      text: [
        "Your watercolor portrait from the Bartenura Rosé portrait booth is attached.",
        "",
        `Share the moment: post your portrait on Instagram, follow @bartenurarose, and tag ${eventHashtag} — we'll be reposting our favorites all weekend.`,
        "",
        "https://instagram.com/bartenurarose",
        "",
        "Sponsored by Bartenura Rosé · Painted by PowerWyze",
      ].join("\n"),
      html,
      attachments: [{
        filename: safeFilename,
        content: Buffer.from(imageBase64, "base64"),
        contentType: mimeType || "image/png",
      }],
    });
  } catch (e) {
    console.error("smtp error", e);
    res.statusCode = 502; return res.end("SMTP error: " + e.message);
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok: true }));
};
