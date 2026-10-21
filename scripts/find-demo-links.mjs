// Zoekt links naar de Blocksy-demosite (startersites.io) in pagina's/blokken en toont waar ze staan.
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const W = cfg.wp.baseUrl + "/wp-json/wp/v2/";
const items = process.argv.slice(2).map((s) => s.split("/"));
for (const [type, id] of items) {
  const raw = (await (await fetch(`${W}${type}/${id}?context=edit`, H)).json()).content.raw;
  let i = -1;
  while ((i = raw.indexOf("startersites.io", i + 1)) >= 0) {
    const before = raw.slice(Math.max(0, i - 150), i);
    const key = (before.match(/"(\w+)":"[^"]*$/) || before.match(/(\w+)="[^"]*$/) || [])[1];
    const url = raw.slice(i).match(/^[^"\\ ]*/)[0];
    const near = raw.slice(i, i + 3000).replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(url.length, url.length + 90);
    console.log(`${type}/${id} | ${key} | ${url} | tekst erna: ${near}`);
  }
}
