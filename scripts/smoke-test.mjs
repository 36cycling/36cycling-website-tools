// Snelle controle van de site na updates of wijzigingen. Alleen lezen.
// Controleert belangrijke pagina's (NL+EN), winkel, cookiebalk, padnavigatie, categorietekst, footer,
// eigen REST-routes, redirects en versies van WordPress/thema. Geeft een kort rapport (ook als JSON).
//   node scripts/smoke-test.mjs [--json]
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl;
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const UA = { "User-Agent": "Mozilla/5.0 (36cycling smoke-test)" };
const results = [];
const ok = (name, pass, note = "") => results.push({ name, pass, note });
const bust = () => `nocache=${Date.now()}${Math.floor(Math.random() * 1000)}`;
const page = async (path) => {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}${bust()}`;
  const r = await fetch(url, { headers: UA, redirect: "manual" });
  return { status: r.status, location: r.headers.get("location") || "", html: r.status === 200 ? await r.text() : "" };
};
const hasError = (html) => ["Fatal error", "Parse error", "Warning: ", "Notice: ", "Deprecated: ", "There has been a critical error"].find((s) => html.includes(s));

const PAGES = [
  ["Home NL", "/nl/", ["cmplz-cookiebanner", 'href="tel:+31182232008"', "googletagmanager"]],
  ["Home EN", "/en/", ["cmplz-cookiebanner", 'href="tel:+31182232008"']],
  ["Shop NL", "/nl/categorie/fietskleding/", ["type-product"]],
  ["Categorie NL", "/nl/categorie/fietskleding/dames/fietsshirts-dames/dames-fietsshirts-korte-mouw/", ['class="ct-breadcrumbs"', "c36-category-seo", "<h2>"]],
  ["Categorie EN", "/en/category/cycling-clothing/", ['class="ct-breadcrumbs"']],
  ["Product NL", "/nl/shop/chroma-wielershirt-blauw/", ['class="ct-breadcrumbs"', "add_to_cart_button", "application/ld+json"]],
  ["Contact NL", "/nl/contact/", ["fluentform"]],
  ["Bedankt NL", "/nl/contact/bedankt/", []],
  ["Winkelwagen NL", "/nl/winkelwagen/", []],
  ["Privacy NL", "/nl/privacy/", []],
  ["Cookiebeleid NL", "/nl/cookiebeleid/", ["cmplz-document"]],
  ["Circle NL", "/nl/36-cycling-circle/", ["fluentform"]],
];
for (const [name, path, must] of PAGES) {
  const p = await page(path);
  if (p.status !== 200) { ok(name, false, `status ${p.status} ${p.location}`); continue; }
  const err = hasError(p.html);
  // googletagmanager hoort alleen op 36cycling.com; op de testsite juist afwezig
  const missing = must.filter((m) => (m === "googletagmanager" ? false : !p.html.includes(m)));
  const gtmExpected = BASE.includes("36cycling.com");
  const gtmNote = must.includes("googletagmanager") && gtmExpected && !p.html.includes("googletagmanager.com/gtm.js") ? " GTM ontbreekt" : "";
  ok(name, !err && !missing.length && !gtmNote, [err && `fout: ${err}`, missing.length && `mist: ${missing.join(", ")}`, gtmNote].filter(Boolean).join(" | "));
}

// Afrekenen met lege winkelwagen → hoort door te sturen naar de winkelwagen
{ const p = await page("/nl/afrekenen/"); ok("Afrekenen (leeg → winkelwagen)", p.status === 302 && p.location.includes("winkelwagen"), `status ${p.status}`); }

// Redirects (steekproef)
for (const [from, to] of [["/privacy/", "/nl/privacy/"], ["/nl/fietskleding/heren/fietsshirts-heren/", "/nl/categorie/fietskleding/heren/fietsshirts-heren/"], ["/sitemap.xml", "/sitemap_index.xml"]]) {
  const r = await fetch(`${BASE}${from}`, { headers: UA, redirect: "manual" });
  ok(`Redirect ${from}`, r.status === 301 && (r.headers.get("location") || "").endsWith(to), `${r.status} → ${r.headers.get("location")}`);
}

// Eigen routes en API's
const api = async (path, auth = true) => (await fetch(`${BASE}/wp-json${path}`, { headers: auth ? H : UA })).status;
ok("Route c36/v1/translations", (await api("/c36/v1/translations?element_type=post_page&id=2")) === 200);
ok("WooCommerce Store API", (await api("/wc/store/v1/cart", false)) === 200);
ok("Redirection API", (await api("/redirection/v1/redirect?per_page=5")) === 200);

// Versies
const themes = await (await fetch(`${BASE}/wp-json/wp/v2/themes?status=active`, { headers: H })).json();
const plugins = await (await fetch(`${BASE}/wp-json/wp/v2/plugins?_fields=name,version,status`, { headers: H })).json();
const versions = { thema: themes.map((t) => `${t.name?.raw || t.name} ${t.version}`).join(", "), plugins: plugins.filter((p) => p.status === "active").length + " actief" };

const failed = results.filter((r) => !r.pass);
if (process.argv.includes("--json")) { console.log(JSON.stringify({ base: BASE, results, versions }, null, 2)); process.exit(failed.length ? 1 : 0); }
for (const r of results) console.log(`${r.pass ? "✓" : "✗"} ${r.name}${r.note ? " — " + r.note : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} in orde | ${versions.thema} | plugins: ${versions.plugins}`);
process.exit(failed.length ? 1 : 0);
