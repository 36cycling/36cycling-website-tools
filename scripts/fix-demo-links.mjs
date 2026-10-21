// Vervangt/verwijdert links naar de Blocksy-demosite (startersites.io). Backup per item in backups/.
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json/wp/v2/";
const DEMO = "https://startersites.io/blocksy/e-bike/";
const REPLACE = { [`${DEMO}shop/`]: "/nl/shop/", [`${DEMO}product/74/`]: "/nl/contact/", [`${DEMO}contact/`]: "/nl/contact/" };
for (const key of process.argv.slice(2)) {
  const item = await (await fetch(`${W}${key}?context=edit`, { headers: H })).json();
  let c = item.content.raw;
  for (const [a, b] of Object.entries(REPLACE)) c = c.split(a).join(b);
  // Kaart-links (Greenshift containerLink) naar demo-categorieën: link weghalen.
  c = c.replace(new RegExp(`,"containerLink":"${DEMO.replace(/[./]/g, "\$&")}[^"]*"`, "g"), "");
  c = c.replace(new RegExp(`<a class="gspb-containerlink" href="${DEMO.replace(/[./]/g, "\$&")}[^"]*"[^>]*></a>`, "g"), "");
  const left = (c.match(/startersites\.io/g) || []).length;
  if (c === item.content.raw) { console.log(`— ${key}: niets`); continue; }
  await writeFile(new URL(`../backups/${key.replace("/", "-")}-${Date.now()}.json`, import.meta.url), JSON.stringify({ content: item.content.raw }));
  const r = await fetch(`${W}${key}`, { method: "POST", headers: H, body: JSON.stringify({ content: c }) });
  console.log(`${r.ok ? "✓" : "✗"} ${key}: nog ${left} demo-links`);
}
