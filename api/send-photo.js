/**
 * Dan's Rosé Soirée Photo Booth — Email Delivery
 *
 * POST JSON: { email, filename, mimeType, imageBase64 }
 * Sends the generated watercolor Rosé Soirée portrait to the guest via Gmail SMTP.
 *
 * Email branding: Bartenura × Dan's Rosé Soirée. Painted by PowerWyze.
 * Instagram tags: @danspapers, @bartenurarose, @powerwyze.
 *
 * Env (preferred — wyzer):
 *   WYZER_APP_PASSWORD    Gmail app password for wyzer@powerwyze.com
 *   WYZER_GMAIL_USER      defaults to "wyzer@powerwyze.com"
 *
 * Env (fallback — legacy):
 *   GOOGLE_APP_PASSWORD   Gmail app password
 *   GMAIL_USER            defaults to "spc.bstewart@gmail.com"
 *
 *   FROM_NAME             default: "Dan's Rosé Soirée"
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
  const fromName = process.env.FROM_NAME || "Dan's Rosé Soirée";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const safeFilename = String(filename || "rose-soiree-portrait.png")
    .replace(/[^a-z0-9@._-]/gi, "_")
    .slice(0, 200);

  const html = `<!doctype html><html><body style="font-family:Georgia,'Playfair Display',serif;background:#fff5f8;color:#3a1a26;padding:24px;margin:0">
    <div style="max-width:560px;margin:0 auto;background:#fffaf5;border:1px solid #f3d4dc;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(74,29,44,0.08)">
      <div style="padding:26px 28px 18px 28px;border-bottom:1px solid #f3d4dc;text-align:center;background:linear-gradient(180deg,#fff5f8 0%,#ffe9ef 100%)">
        <div style="font-family:'Pinyon Script',Georgia,cursive;font-size:38px;color:#AD1457;line-height:1;margin-bottom:4px;font-style:italic">Dan's</div>
        <div style="font-family:Georgia,'Playfair Display',serif;font-size:22px;letter-spacing:6px;color:#4a1d2c;font-weight:700">ROSÉ SOIRÉE</div>
        <div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#8a4a5e;margin-top:6px;text-transform:uppercase">Southampton · Watercolor Portraits</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6b3a4d;margin-top:10px">Presented around <strong style="color:#AD1457;font-style:normal">Bartenura Rosé</strong></div>
      </div>
      <div style="padding:24px 28px;font-family:Georgia,serif;color:#3a1a26">
        <h1 style="margin:0 0 8px 0;font-size:24px;color:#3a1a26;font-weight:600">✦ Your Rosé Soirée portrait is ready</h1>
        <p style="margin:0 0 18px 0;color:#6b3a4d;line-height:1.6;font-size:15px;font-family:Arial,sans-serif">Thanks for stopping by the <strong>Bartenura Rosé portrait booth</strong> at Dan's Rosé Soirée in Southampton. Your watercolor souvenir is attached — painted just for you, Hamptons-summer mood.</p>

        <div style="margin:18px 0;padding:18px 20px;background:linear-gradient(135deg,#ffe4ec 0%,#fce4ec 100%);border:1px solid #f3d4dc;border-radius:14px">
          <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#AD1457;margin-bottom:8px;font-weight:700">✦ Share the moment</div>
          <p style="margin:0 0 12px 0;color:#3a1a26;font-size:14px;line-height:1.55;font-family:Arial,sans-serif">Post your portrait on Instagram and tag <strong style="color:#AD1457">@danspapers</strong>, <strong style="color:#AD1457">@bartenurarose</strong>, and <strong style="color:#AD1457">@powerwyze</strong> — we'll be reposting our favorites all weekend.</p>
          <a href="https://instagram.com/powerwyze" style="display:inline-block;background:linear-gradient(135deg,#E91E63 0%,#AD1457 100%);color:#fff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:2px;padding:11px 20px;border-radius:999px;font-family:Arial,sans-serif">Tag @powerwyze on Instagram →</a>
        </div>

        <p style="margin:18px 0 4px 0;color:#8a4a5e;font-size:12px;font-family:Arial,sans-serif;font-style:italic">— ${fromName}</p>
      </div>
      <div style="padding:14px 24px 18px;border-top:1px solid #f3d4dc;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#a07a8a;letter-spacing:1px;background:#fff5f8">
        Sponsored by <strong style="color:#6b3a4d">Bartenura Rosé</strong> · Painted by <strong style="color:#6b3a4d">PowerWyze</strong>
      </div>
    </div>
  </body></html>`;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: email,
      subject: "Your Rosé Soirée portrait ✦ Bartenura × Dan's",
      text: [
        "Your watercolor portrait from the Bartenura Rosé portrait booth at Dan's Rosé Soirée is attached.",
        "",
        "Share the moment: post your portrait on Instagram and tag @danspapers, @bartenurarose, and @powerwyze — we'll be reposting our favorites all weekend.",
        "",
        "https://instagram.com/powerwyze",
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
