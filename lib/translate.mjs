// Vertaalhulp voor Gutenberg/Greenshift-content: teksten eruit halen (segmenten) en vertaald terugzetten,
// zonder opmaak, blok-id's of instellingen te raken. Tekst staat bij Greenshift dubbel: in de blok-attributen
// (headingContent/textContent/buttonContent, JSON-geëscaped) én in de HTML — beide worden vervangen.

// Blok-niveau tags: tekst wordt per "run" tussen deze grenzen vertaald (inline tags zoals <strong>, <a>, <br> blijven in de run).
const BOUNDARY = /<\/?(?:(?:p|div|h[1-6]|li|ul|ol|figure|figcaption|section|table|thead|tbody|tfoot|tr|td|th|dl|dt|dd|blockquote|details|summary|button|form|fieldset|label|select|option|textarea|nav|header|footer|main|article|aside|img|picture|source|video|iframe|hr|svg|path|g)\b[^>]*|span\s+class="gspb-buttonbox-[^"]*"[^>]*)>|\u0000\d+\u0000/gi;
const MASK = /<(script|style|svg)\b[\s\S]*?<\/\1>/gi;
const LETTERS = /[A-Za-zÀ-ÿ]{2,}/;
const ATTR_TEXT = /\b(alt|title|placeholder|aria-label)="([^"]*)"/g;
// Attribuut-sleutels die nooit tekst zijn.
const SKIP_KEYS = /^(id|anchor|className|class|url|href|link|buttonLink|src|image|images|icon|iconBox_icon|svg|font|css|customcss|customCss|styles|style|color|background|overlay|spacing|typography|border|responsive|flexbox|ref|formId|slug|tagName|headingTag|type|lang|mediaType|sizeSlug|linkDestination|rel|target)$/i;

export const visible = (s) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

/** Splits HTML in runs: [{text, isRun}] — isRun = stuk tekst tussen blokgrenzen met zichtbare letters. */
function splitRuns(html) {
  const masked = []; let h = html.replace(MASK, (m) => `\u0000${masked.push(m) - 1}\u0000`);
  const parts = []; let last = 0;
  for (const m of h.matchAll(BOUNDARY)) { parts.push(h.slice(last, m.index), m[0]); last = m.index + m[0].length; }
  parts.push(h.slice(last));
  const unmask = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => masked[+i]);
  return parts.map((p, i) => {
    const raw = unmask(p);
    if (i % 2 === 1 || !LETTERS.test(visible(raw))) return { text: raw, isRun: false };
    let lead = raw.match(/^(\s|&nbsp;|<br\s*\/?>)*/)[0], trail = raw.slice(lead.length).match(/(\s|&nbsp;|<br\s*\/?>)*$/)[0];
    let core = raw.slice(lead.length, raw.length - trail.length);
    // Losse sluit-/opentags aan de randen (horen bij een tag buiten de run) naar lead/trail verplaatsen.
    const opens = (tag) => (core.match(new RegExp(`<${tag}[\\s>]`, "gi")) || []).length;
    const closes = (tag) => (core.match(new RegExp(`</${tag}>`, "gi")) || []).length;
    for (let m; (m = core.match(/<\/([a-z0-9]+)>\s*$/i)) && opens(m[1]) < closes(m[1]);) { trail = core.slice(m.index) + trail; core = core.slice(0, m.index); }
    for (let m; (m = core.match(/^\s*<([a-z0-9]+)\b[^>]*>/i)) && opens(m[1]) > closes(m[1]);) { lead += m[0]; core = core.slice(m[0].length); }
    if (!LETTERS.test(visible(core))) return { text: raw, isRun: false };
    return { text: raw, isRun: true, lead, core, trail };
  });
}

/** Alle te vertalen segmenten uit één HTML-stuk. */
function htmlSegments(html, out) {
  for (const r of splitRuns(html)) if (r.isRun) out.add(r.core);
  for (const m of html.replace(MASK, "").matchAll(ATTR_TEXT)) if (LETTERS.test(m[2])) out.add(m[2]);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { walkJson(JSON.parse(m[1]), (k, v) => { if (/^(name|text|description|headline|caption)$/.test(k) && LETTERS.test(v)) out.add(v); }); } catch {}
  }
}
function walkJson(o, fn, key = "") {
  if (typeof o === "string") return fn(key, o);
  if (Array.isArray(o)) return o.forEach((x) => walkJson(x, fn, key));
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walkJson(v, fn, k);
}
const NOISE = /^(?:[\d.+\-*/() ]|px|em|rem|vw|vh|%)+$|^(?:center|left|right|top|bottom|currentColor|inherit|auto|none|cover|contain|solid|dashed|normal|bold|uppercase|lowercase|flex-start|flex-end|space-between)(?: (?:center|left|right|top|bottom))?$|\b\d+(?:\.\d+)?(?:rem|px|vw|em)\b/i;
const looksLikeText = (k, v) => !SKIP_KEYS.test(k) && !/^fluid|^line_height|Position$|^fill/i.test(k) && !NOISE.test(v.trim()) && LETTERS.test(visible(v)) && !/^(https?:|\/|#|var\(|rgba?\(|\.|\{|[\w-]+:\s*[^ ]+;)/.test(v.trim()) && !/^[a-z0-9_-]+$/.test(v);

// Blok-commentaar: <!-- wp:name {json} /--> of <!-- wp:name {json} -->
const BLOCK = /<!-- (\/?)wp:([a-z0-9-]+\/)?([a-z0-9-]+)( (\{[\s\S]*?\}))? (\/)?-->/g;

/** Tokeniseer content in blokcommentaren en HTML-stukken. */
export function tokens(content) {
  const out = []; let last = 0;
  for (const m of content.matchAll(BLOCK)) {
    out.push({ html: content.slice(last, m.index) });
    out.push({ comment: m[0], name: (m[2] || "core/") + m[3], json: m[5] });
    last = m.index + m[0].length;
  }
  out.push({ html: content.slice(last) });
  return out;
}

/** Segmenten (unieke NL-teksten) uit een stuk content. */
export function extractSegments(content) {
  const set = new Set();
  for (const t of tokens(content)) {
    if (t.html) htmlSegments(t.html, set);
    else if (t.json) {
      let a; try { a = JSON.parse(t.json); } catch { continue; }
      walkJson(a, (k, v) => { if (looksLikeText(k, v)) { if (/<[a-z]/i.test(v)) htmlSegments(v, set); else set.add(v.trim()); } });
    }
  }
  return [...set];
}

// WordPress serialize_block_attributes()-equivalent.
export const encodeAttrs = (o) => JSON.stringify(o).replace(/--/g, "\\u002d\\u002d").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\\"/g, "\\u0022");

/**
 * Vertaal content.  map: NL-segment → EN.  rewriteUrl(url) → nieuwe url of null.
 * Geeft { content, missing } terug: missing = segmenten zonder vertaling.
 */
export function applyTranslation(content, map, rewriteUrl = () => null) {
  const missing = new Set();
  const translated = new Set(Object.values(map).flatMap((v) => [...String(v).matchAll(ATTR_TEXT)].map((m) => m[2])));
  const tr = (s) => { const k = s.trim(); if (!k) return s; if (k in map) return s.replace(k, map[k]); missing.add(k); return s; };
  const trHtml = (html) => {
    let out = splitRuns(html).map((r) => (r.isRun ? r.lead + (r.core in map ? map[r.core] : (missing.add(r.core), r.core)) + r.trail : r.text)).join("");
    // Attributen (alt/title/…); waarden die al uit een vertaalde run komen (= een EN-vertaling) niet opnieuw vertalen.
    out = out.replace(ATTR_TEXT, (m, k, v) => (LETTERS.test(v) && !/<script/.test(m) ? `${k}="${v in map ? map[v] : translated.has(v) ? v : (missing.add(v), v)}"` : m));
    out = out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, js) => {
      try {
        const o = JSON.parse(js);
        const fix = (x, key = "") => typeof x === "string" ? (/^(name|text|description|headline|caption)$/.test(key) && LETTERS.test(x) ? (x in map ? map[x] : (missing.add(x), x)) : x)
          : Array.isArray(x) ? x.map((y) => fix(y, key)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fix(v, k)])) : x;
        return `<script type="application/ld+json">${JSON.stringify(fix(o))}</script>`;
      } catch { return m; }
    });
    return rewriteLinks(out, rewriteUrl);
  };
  const out = tokens(content).map((t) => {
    if (t.html !== undefined) return trHtml(t.html);
    if (!t.json) return t.comment;
    let a; try { a = JSON.parse(t.json); } catch { return t.comment; }
    let changed = false;
    const fix = (x, key = "") => {
      if (typeof x === "string") {
        let y = x;
        if (looksLikeText(key, x)) y = /<[a-z]/i.test(x) ? trHtml(x) : tr(x);
        else if (/^(url|href|link|buttonLink)$/i.test(key)) y = rewriteUrl(x) ?? x;
        if (y !== x) changed = true;
        return y;
      }
      if (Array.isArray(x)) return x.map((v) => fix(v, key));
      if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fix(v, k)]));
      return x;
    };
    const b = fix(a);
    return changed ? t.comment.replace(t.json, encodeAttrs(b)) : t.comment;
  }).join("");
  return { content: out, missing: [...missing] };
}

function rewriteLinks(html, rewriteUrl) {
  return html.replace(/\b(href)="([^"]+)"/g, (m, k, u) => { const n = rewriteUrl(u); return n ? `${k}="${n}"` : m; });
}

/** Maak een url-herschrijver op basis van een NL-pad → EN-pad tabel. */
export function makeUrlRewriter(urlMap) {
  return (u) => {
    const m = u.match(/^(?:https?:\/\/(?:www\.)?(?:36cycling\.com|rondevanrotterdam\.nl))?(\/nl\/[^"'#?\s]*)([#?][^"'\s]*)?$/);
    if (!m) return null;
    const path = m[1].endsWith("/") ? m[1] : m[1] + "/";
    return urlMap[path] ? urlMap[path] + (m[2] || "") : null;
  };
}
