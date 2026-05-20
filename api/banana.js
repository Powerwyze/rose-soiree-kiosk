/**
 * Bartenura Rosé Soirée Photo Booth — Watercolor Portrait Restyle
 *
 * Receives multipart/form-data with `image` (jpeg blob) + `email` (string, optional)
 * Calls OpenAI Image Edit (gpt-image-1) with a Bartenura-first Hamptons watercolor
 * prompt. The Château Roubine pale rosé bottle is the hero rosé on the table; a
 * Bartenura Sparkling Rosé bottle may sit beside it (NEITHER in the subject's hand).
 * The client (browser) stamps the Bartenura logo + hashtag onto the final image.
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

// The output MUST look like the reference Bartenura Rosé poster: same Hamptons
// waterfront terrace, same two bottles in the same positions (Bartenura Rosé
// dark bottle on the LEFT, Château Roubine pale bottle CENTER), same table
// elements, same poster/watercolor aesthetic. ONLY the person changes — we
// transplant the identity from the guest selfie into the existing scene.
const PROMPT = [
  "Recreate this EXACT Bartenura Rosé poster scene as a soft painterly watercolor & gouache illustration (NOT a photograph), keeping every scene element identical to the reference and ONLY replacing the central woman's identity (face, hair, skin tone, ethnicity) with the person from the supplied selfie. Everything else — composition, bottles, table, mansion, water, typography placement, palette — must stay the same.",

  "REFERENCE SCENE LOCK — do not invent different scenery. The composition is a vertical 9:16 poster of an elegant Hamptons waterfront terrace at golden hour. Across the very top, soft watercolor lettering reads 'BARTENURA ROSÉ' in pale rose serif type at the upper-left, with a short tagline under it: 'THE HAMPTONS' SIGNATURE CULINARY EXPERIENCE' followed by 4 small italic lines ('Five unforgettable events.', 'World-class chefs.', 'Exceptional wines.', 'Only in the Hamptons.'). To the upper right, a classic white Hamptons mansion with verandas and gabled roofs sits beyond a soft hedge.",

  "Background details (keep exactly): on the LEFT, a calm pale-blue bay with a white luxury yacht and small sailboats, framed by lush pink garden roses and hydrangeas in the foreground. On the RIGHT, a cream patio umbrella over the terrace and the Hamptons mansion. Soft summer light, watercolor paper texture, gentle ink linework, luminous golden-hour glow.",

  "SUBJECT (the only thing that changes): one woman, seated center, facing the viewer, smiling warmly. She wears a soft pale-pink / blush linen blazer over an ivory camisole — refined, brand-safe, never sexualized. She is holding a clear stemmed wine glass of pale rosé in her right hand near her shoulder; the glass has a small 'BARTENURA ROSÉ' label etched on it. Replace her face, hair style, hair color, skin tone, and ethnicity with the person from the input selfie — preserve their identity clearly while rendering everything in the same watercolor style as the rest of the artwork. Exactly one head, two arms, two hands with five fingers each. No extra limbs. Keep wardrobe blush/ivory and tasteful.",

  "FOREGROUND TABLE — must match the reference exactly. A round white-linen table in front of the subject holds, from LEFT to RIGHT: (1) a tall dark almost-black BARTENURA ROSÉ bottle with a glossy pink/rose-gold metallic foil capsule and ornate cream-white label reading 'BARTENURA' with 'ROSÉ' beneath it, partially nested in pink roses and silver oyster platter; (2) front-and-center, a tall slender clear-glass CHÂTEAU ROUBINE Provence rosé bottle showing pale peach-pink wine inside, with a long white neck capsule, brushed silver-grey cap, and a clean white front label reading 'CHÂTEAU ROUBINE · Cru Classé · CÔTES DE PROVENCE' with a small chateau crest; (3) to the right, a silver tray of fresh oysters on ice, a small dish of dark caviar, a softly flickering rose candle in a clear glass holder, a sprig of rosemary, and a small plated dish; (4) a small cream menu card behind the table reading 'DAN'S Taste · THE HAMPTONS' SIGNATURE CULINARY EXPERIENCE'. Pink and white hydrangeas with garden roses spill across the table edges.",

  "TWO-BOTTLE RULE — exactly TWO bottles on the table, in this order LEFT to RIGHT: dark Bartenura Rosé bottle (left), pale Château Roubine bottle (center-front). Do NOT add a third bottle. Do NOT remove either bottle. Do NOT swap their positions. Do NOT swap their labels or colors. The Bartenura bottle is the DARK one on the LEFT with pink/rose-gold foil; the Château Roubine bottle is the PALE clear-glass one in the CENTER with a white capsule and grey cap. Both bottles stay on the table — NEVER in the subject's hand (her hand holds only the small stemmed wine glass).",

  "BOTTOM BRANDING — across the bottom of the poster, render two small wordmarks side-by-side separated by a thin vertical rose-gold rule: on the LEFT 'CHÂTEAU ROUBINE · CRU CLASSÉ · CÔTES DE PROVENCE'; on the RIGHT 'BARTENURA ROSÉ · MOSCATO | ITALY'. Keep them tasteful, small, and elegant. Text rendering may be approximate (watercolor lettering, slight imperfection is fine) but the placement and brand pairing must match the reference.",

  "STYLE LOCK: a single cohesive watercolor-and-gouache illustration with delicate ink linework, soft pigment bleeds, luminous golden-hour light, and warm watercolor-paper background. The face must be painted in the SAME watercolor style as the body and background — no photographic skin texture, no realistic pores, no photo-head-on-illustrated-body look. Preserve identity through proportions, hair shape/color, skin tone, and ethnicity, but render it all as watercolor.",

  "Color palette: blush pink, rosé peach, ivory linen, champagne cream, soft coral, sage green from hydrangea leaves, watercolor-paper warm white, with rose-gold and silver accents from the bottles, plus deep aubergine/charcoal glass on the Bartenura bottle.",

  "GUARDRAILS: do NOT invent different scenery, do NOT change the bottle count or arrangement, do NOT swap bottle labels, do NOT place a bottle in the subject's hand, do NOT add extra people, do NOT add modern logos other than the reference branding above, do NOT make the image photorealistic, and do NOT sexualize the subject. The result must be a near-identical recreation of the Bartenura Rosé Hamptons poster with the central woman's identity updated to match the supplied selfie.",
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
