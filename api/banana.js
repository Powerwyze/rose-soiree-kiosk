/**
 * Dan's Rosé Soirée Photo Booth — Watercolor Portrait Restyle
 *
 * Receives multipart/form-data with `image` (jpeg blob) + `email` (string)
 * Calls OpenAI Image Edit (gpt-image-1) with a Rosé Soirée / Hamptons watercolor prompt
 * featuring a Château Roubine pale rosé bottle on the table (NOT in the subject's hand).
 *
 * Env:
 *   OPENAI_API_KEY        (required)
 *   OPENAI_IMAGE_MODEL    (default: "gpt-image-1")
 *   OPENAI_IMAGE_SIZE     (default: "1024x1024")
 *   OPENAI_IMAGE_QUALITY  (default: "high")
 */

const formidableModule = require("formidable");
const formidable = formidableModule.default || formidableModule;
const fs = require("node:fs");

const OPENAI_URL = "https://api.openai.com/v1/images/edits";

const PROMPT = [
  "Reimagine the person in the photo as an elegant Rosé Soirée illustrated portrait in a refined Hamptons garden-party aesthetic — soft painterly watercolor and gouache illustration with delicate ink linework, gentle bleed edges, and luminous summer light. NOT a photograph. Think high-end editorial campaign artwork or a luxury wine-brand summer ad: tasteful, romantic, sun-soaked, brand-safe.",

  "Setting: an outdoor Hamptons rosé soirée at golden hour. A round table is set with a pale linen cloth, pink and white hydrangeas with garden roses spilling across it, fresh oysters arranged on a silver tray, a softly flickering candle, dappled summer light. In the background: a classic white Hamptons mansion with verandas, sailboats or a yacht on a pale-blue bay, hedges and rose bushes, soft warm summer atmosphere.",

  "Wardrobe: blush, ivory, champagne, or pale rosé summer-elegant attire — a tailored linen blazer, a flowing summer dress, or refined resort wear. Brand-safe and never sexualized.",

  "Pose: a natural, relaxed seated or standing portrait. Hands rest naturally — folded on the lap, resting on the table, or relaxed at the subject's side. Do NOT place a wine glass, stemware, cocktail, cup, or any drinking vessel in the subject's hand. Do NOT add extra arms or extra hands. The subject must have exactly two arms and two hands, each with five fingers. The pose should look candid, refined, and editorial — like a portrait from a luxury summer magazine.",

  "Place a single Château Roubine pale rosé bottle on the table next to the subject (NOT in the subject's hand). The bottle must clearly read as Château Roubine: tall and slender, clear glass showing a pale peach-pink rosé wine inside, a long elegant white neck wrap / capsule, a brushed silver-grey cap with subtle rose-gold accents and an embossed crest, an embossed motif on the upper shoulder of the bottle, and a clean white front label reading 'CHÂTEAU ROUBINE' with smaller lines for 'Cru Classé', a small chateau illustration, 'PREMIUM', and 'CÔTES DE PROVENCE'. Do not substitute a different wine. Do not turn it into a generic bottle. Do not change the color of the wine (must stay pale rosé). Do not change the cap color. The bottle should look unmistakably like a Château Roubine Côtes de Provence rosé.",

  "Optional poster text: any decorative text or branding in the artwork should be minimal and tasteful. Do NOT force a dense block of top-left poster copy. Small elegant lettering is fine but not required; legibility of the bottle label matters more than any surrounding text. No dense paragraphs, no aggressive wordmarks, no large captions.",

  "Color palette: blush pink, rosé peach, soft coral, ivory linen, champagne gold, sage green from hydrangea leaves, watercolor-paper warm white, with rose-gold and silver accents from the bottle and tableware.",

  "Mood: elegant, romantic, sun-dappled Hamptons summer soirée — like a Bartenura × Château Roubine campaign moment.",

  "IMPORTANT: keep the person's face shape, hair style and color, skin tone, ethnicity, and overall identity clearly recognizable — but rendered in the watercolor illustration style described above (painterly, not photographic).",

  "CRITICAL STYLE LOCK: the face/head must match the same painterly watercolor treatment as the body and background (same brushwork, same soft pigment bleeds, same gouache linework). No realistic skin texture, no photographic pores, no photo-like lighting on the face, and no mixed-media look. The portrait must read as a single cohesive watercolor illustration from top to bottom — never a real photo head composited onto an illustrated body. Preserve likeness while simplifying details into watercolor forms: soft pigment gradients, gentle ink contour lines, and luminous illustrated shadows across the face.",

  "Final anatomy check: exactly one head, two arms, two hands (each with five fingers), and no glass, cup, or bottle held in either hand. The Château Roubine bottle stays on the table.",
].join(" ");

function setCors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res){
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST")    { res.statusCode = 405; return res.end("Method not allowed"); }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.statusCode = 500; return res.end("OPENAI_API_KEY not configured"); }

  const model    = process.env.OPENAI_IMAGE_MODEL   || "gpt-image-1";
  const size     = process.env.OPENAI_IMAGE_SIZE    || "1024x1024";
  const quality  = process.env.OPENAI_IMAGE_QUALITY || "high";

  let imagePath = null, email = "";
  try {
    const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    email = String(fields.email?.[0] || "").trim();
    const f = files.image?.[0];
    if (!f) { res.statusCode = 400; return res.end("Missing image"); }
    imagePath = f.filepath;
  } catch (e) {
    console.error("parse error", e);
    res.statusCode = 400; return res.end("Invalid form data: " + e.message);
  }

  let upstream;
  try {
    const fileBuf = fs.readFileSync(imagePath);
    const fd = new FormData();
    fd.append("model",   model);
    fd.append("prompt",  PROMPT);
    fd.append("size",    size);
    fd.append("quality", quality);
    fd.append("n",       "1");
    fd.append("image",   new Blob([fileBuf], { type: "image/jpeg" }), "input.jpg");

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 280000);
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(t);
  } catch (e) {
    console.error("openai fetch error", e);
    res.statusCode = 502; return res.end("Upstream error: " + e.message);
  } finally {
    try { fs.unlinkSync(imagePath); } catch (_) {}
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    console.error("openai error", upstream.status, errText);
    res.statusCode = upstream.status;
    return res.end(errText || `Upstream HTTP ${upstream.status}`);
  }

  const data = await upstream.json();
  const item = data?.data?.[0];
  let buffer;
  if (item?.b64_json) {
    buffer = Buffer.from(item.b64_json, "base64");
  } else if (item?.url) {
    const r = await fetch(item.url);
    buffer = Buffer.from(await r.arrayBuffer());
  } else {
    res.statusCode = 502; return res.end("No image in OpenAI response");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Rose-Email", encodeURIComponent(email).slice(0, 256));
  return res.end(buffer);
};

module.exports.config = {
  api: { bodyParser: false },
};
