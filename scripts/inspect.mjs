// Inspecteer de WP-installatie: REST-namespaces, actieve talen-plugin,
// permalink-structuur (via een pagina-link) en de template-pagina (969).
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const auth = "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64");
const base = cfg.wp.baseUrl.replace(/\/$/, "");
const get = async (p) => {
  const r = await fetch(base + p, { headers: { Authorization: auth } });
  return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() };
};

// 1. REST-namespaces → welke plugins draaien (wpml / pll).
const root = await get("/wp-json");
const ns = root.body?.namespaces || [];
console.log("Namespaces:", ns.join(", "));
console.log("WPML-hint:", ns.some((n) => /wpml/i.test(n)) ? "ja" : "niet in namespaces");

// 2. Actieve plugins (admin).
const plugins = await get("/wp-json/wp/v2/plugins");
if (plugins.ok) {
  const active = plugins.body.filter((p) => p.status === "active").map((p) => p.plugin.split("/")[0]);
  console.log("Actieve plugins:", active.join(", "));
  console.log("Meertalig:", active.find((p) => /wpml|sitepress|polylang/i.test(p)) || "GEEN gevonden");
} else {
  console.log("Plugins-endpoint:", plugins.status);
}

// 3. Template-pagina 969.
const tpl = await get(`/wp-json/wp/v2/pages/${cfg.templatePostId}?context=edit`);
if (tpl.ok) {
  console.log("\n--- Template 969 ---");
  console.log("Titel:", tpl.body.title?.raw);
  console.log("Link:", tpl.body.link, "→ permalinks", /\?(p|page_id)=/.test(tpl.body.link) ? "PLAIN (aanpassen!)" : "pretty OK");
  console.log("Template-bestand:", tpl.body.template || "(standaard)");
  console.log("Content (eerste 600 tekens raw):\n", (tpl.body.content?.raw || "").slice(0, 600));
} else {
  console.log("Pagina 969:", tpl.status, tpl.body);
}
