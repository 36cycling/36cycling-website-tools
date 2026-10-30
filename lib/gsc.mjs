// Google Search Console (zoekprestaties) via een service-account, zonder extra pakketten.
// Sleutel: private/gsc-service-account.json (JSON-sleutel van het service-account; nooit tonen of delen).
// Het service-account moet in Search Console als gebruiker (beperkt) aan de property zijn toegevoegd.
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const KEY_FILE = new URL("../private/gsc-service-account.json", import.meta.url);
const API = "https://www.googleapis.com/webmasters/v3";

export async function gscAvailable() {
  try { await readFile(KEY_FILE); return true; } catch { return false; }
}

const b64url = (x) => Buffer.from(x).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function token() {
  const key = JSON.parse(await readFile(KEY_FILE, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(sig)}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Google-login mislukt: ${j.error_description || j.error || r.status}`);
  return { token: j.access_token, email: key.client_email };
}

/** Verbinding met Search Console: kiest de property van 36cycling.com (domein-property gaat voor). */
export async function gscClient() {
  const { token: t, email } = await token();
  const H = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const sites = (await (await fetch(`${API}/sites`, { headers: H })).json()).siteEntry || [];
  const mine = sites.filter((s) => /36cycling\.com/.test(s.siteUrl) && s.permissionLevel !== "siteUnverifiedUser");
  const site = mine.find((s) => s.siteUrl.startsWith("sc-domain:")) || mine.find((s) => s.siteUrl.includes("www.")) || mine[0];
  if (!site) throw new Error(`Service-account ${email} heeft geen toegang tot 36cycling.com in Search Console.`);
  return {
    site: site.siteUrl,
    /** Zoekprestaties: body volgens searchAnalytics.query (startDate, endDate, dimensions, rowLimit, ...). */
    async query(body) {
      const r = await fetch(`${API}/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`, { method: "POST", headers: H, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(`Search Console: ${j.error?.message || r.status}`);
      return j.rows || [];
    },
    /** Ingediende sitemaps met status (fouten, waarschuwingen, aantal ingediende URL's). */
    async sitemaps() {
      const r = await fetch(`${API}/sites/${encodeURIComponent(site.siteUrl)}/sitemaps`, { headers: H });
      const j = await r.json();
      if (!r.ok) throw new Error(`Search Console: ${j.error?.message || r.status}`);
      return j.sitemap || [];
    },
    /** URL-inspectie: hoe Google één pagina kent (geïndexeerd, canonieke URL, laatste bezoek). */
    async inspect(url) {
      const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: H, body: JSON.stringify({ inspectionUrl: url, siteUrl: site.siteUrl, languageCode: "nl" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(`Search Console: ${j.error?.message || r.status}`);
      return j.inspectionResult?.indexStatusResult || {};
    },
  };
}
