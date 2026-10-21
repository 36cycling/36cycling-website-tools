// Kleine WordPress REST API-client voor de migratie.
// Node 24+ (globale fetch, FormData, Blob). Geen dependencies nodig.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export async function loadConfig(path = new URL("../config.json", import.meta.url)) {
  return JSON.parse(await readFile(path, "utf8"));
}

function authHeader(cfg) {
  const token = Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64");
  return `Basic ${token}`;
}

function api(cfg, path) {
  return `${cfg.wp.baseUrl.replace(/\/$/, "")}/wp-json/wp/v2${path}`;
}

// Huidige status van een bestaand item ophalen (om publicatie niet te clobberen).
async function currentStatus(cfg, type, id) {
  const r = await fetch(api(cfg, `/${type}/${id}?context=edit&_fields=status`), {
    headers: { Authorization: authHeader(cfg) },
  });
  return r.ok ? (await r.json()).status : null;
}

// Bepaal welke status we sturen: bestaande gepubliceerde items NOOIT terug naar concept.
async function resolveStatus(cfg, type, id, requested) {
  if (id) {
    const cur = await currentStatus(cfg, type, id);
    if (cur && cur !== "draft" && cur !== "auto-draft") return null; // behoud publish/private/etc.
  }
  return requested || cfg.wp.defaultStatus || "draft";
}

// Test of de REST API bereikbaar is en de credentials kloppen.
export async function whoAmI(cfg) {
  const res = await fetch(api(cfg, "/users/me?context=edit"), {
    headers: { Authorization: authHeader(cfg) },
  });
  if (!res.ok) throw new Error(`Auth mislukt (${res.status}): ${await res.text()}`);
  return res.json();
}

// Upload een lokaal bestand naar de media library en zet daarna de alt-tekst.
export async function uploadMedia(cfg, { filePath, filename, altText, title, caption }) {
  const bytes = await readFile(filePath);
  const name = filename || basename(filePath);
  const res = await fetch(api(cfg, "/media"), {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Type": guessType(name),
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Media-upload mislukt (${res.status}): ${await res.text()}`);
  const media = await res.json();

  // Alt-tekst / titel / caption apart zetten (behoud SEO-waarde).
  if (altText || title || caption) {
    const patch = await fetch(api(cfg, `/media/${media.id}`), {
      method: "POST",
      headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
      body: JSON.stringify({
        alt_text: altText ?? "",
        title: title ?? media.title?.raw,
        caption: caption ?? "",
      }),
    });
    if (!patch.ok) throw new Error(`Alt-tekst zetten mislukt (${patch.status}): ${await patch.text()}`);
    return patch.json();
  }
  return media;
}

// Maak of update een pagina. Zet standaard op 'draft'.
// parent = WP-ID van de ouderpagina (voor /ouder/kind/-URL's).
// lang   = WPML-taalcode (bv. "nl") → als ?lang=-queryparam meegegeven.
export async function upsertPage(cfg, { id, title, slug, content, status, meta, parent, lang }) {
  let path = id ? `/pages/${id}` : "/pages";
  if (lang) path += `?lang=${encodeURIComponent(lang)}`;

  // Yoast SEO-titel-suffix (bv. " | 36 Cycling") automatisch toevoegen.
  const suffix = cfg.seoTitleSuffix;
  if (suffix && meta?._yoast_wpseo_title && !meta._yoast_wpseo_title.endsWith(suffix)) {
    meta = { ...meta, _yoast_wpseo_title: meta._yoast_wpseo_title + suffix };
  }
  const effStatus = await resolveStatus(cfg, "pages", id, status);
  const res = await fetch(api(cfg, path), {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      slug,
      content,
      ...(effStatus ? { status: effStatus } : {}),
      ...(parent ? { parent } : {}),
      ...(meta ? { meta } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Pagina opslaan mislukt (${res.status}): ${await res.text()}`);
  return res.json();
}

// Zet/wijzig de alt-tekst van een bestaand media-item.
export async function setMediaAlt(cfg, id, altText) {
  const res = await fetch(api(cfg, `/media/${id}`), {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ alt_text: altText }),
  });
  if (!res.ok) throw new Error(`Alt bijwerken mislukt (${res.status})`);
  return res.json();
}

// Maak categorie aan (of geef bestaande terug op slug). Optioneel WPML-taal.
export async function ensureCategory(cfg, { name, slug, lang }) {
  const found = await fetch(api(cfg, `/categories?slug=${encodeURIComponent(slug)}&context=edit`), {
    headers: { Authorization: authHeader(cfg) },
  });
  const arr = await found.json();
  if (Array.isArray(arr) && arr.length) return arr[0].id;
  let path = "/categories";
  if (lang) path += `?lang=${encodeURIComponent(lang)}`;
  const res = await fetch(api(cfg, path), {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  if (!res.ok) throw new Error(`Categorie aanmaken mislukt (${res.status}): ${await res.text()}`);
  return (await res.json()).id;
}

// Maak of update een BERICHT (post). Ondersteunt featured_media + WPML-taal.
export async function upsertPost(cfg, { id, title, slug, content, status, meta, lang, featured_media, categories }) {
  let path = id ? `/posts/${id}` : "/posts";
  if (lang) path += `?lang=${encodeURIComponent(lang)}`;
  const suffix = cfg.seoTitleSuffix;
  if (suffix && meta?._yoast_wpseo_title && !meta._yoast_wpseo_title.endsWith(suffix)) {
    meta = { ...meta, _yoast_wpseo_title: meta._yoast_wpseo_title + suffix };
  }
  const effStatus = await resolveStatus(cfg, "posts", id, status);
  const res = await fetch(api(cfg, path), {
    method: "POST",
    headers: { Authorization: authHeader(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({
      title, slug, content,
      ...(effStatus ? { status: effStatus } : {}),
      ...(meta ? { meta } : {}),
      ...(featured_media ? { featured_media } : {}),
      ...(categories ? { categories } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Bericht opslaan mislukt (${res.status}): ${await res.text()}`);
  return res.json();
}

function guessType(name) {
  const ext = name.toLowerCase().split(".").pop();
  return {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
  }[ext] || "application/octet-stream";
}
