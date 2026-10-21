// Footer (Blocksy contentblok 216): links naar Privacyverklaring en Cookiebeleid onder "Algemene voorwaarden".
// De tekst staat dubbel in het Greenshift-blok: in het JSON-attribuut (< > " als unicode-escapes) en in de HTML.
// Vertrekt altijd van de backup van vóór de wijziging (BASE), zodat opnieuw draaien niets verdubbelt.
// Daarna EN via: node scripts/translate-en.mjs apply 216
import { readFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const url = `${cfg.wp.baseUrl}/wp-json/wp/v2/ct_content_block/216`;
const BASE = new URL("../backups/ct_content_block-216-1792528765415.json", import.meta.url);
let c = JSON.parse(await readFile(BASE, "utf8")).content.raw;
// Escape-tekens opgebouwd met String.fromCharCode(92) (backslash): geen backslashes in de bron (shell/editors slikken die in).
const u = (hex) => String.fromCharCode(92) + "u" + hex;
const esc = (s) => s.replace(/</g, u("003c")).replace(/>/g, u("003e")).replace(/"/g, u("0022"));
const html = '<a href="/nl/algemene-voorwaarden/">Algemene voorwaarden</a><br>';
const add = '<a href="/nl/privacy/">Privacyverklaring</a><br><a href="/nl/cookiebeleid/">Cookiebeleid</a><br>';
const count = (s) => c.split(s).length - 1;
const counts = { attr: count(esc(html)), html: count(html) };
if (counts.attr !== 1 || counts.html !== 1) { console.error("Onverwachte structuur", counts); process.exit(1); }
c = c.split(esc(html)).join(esc(html + add)).split(html).join(html + add);
const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ content: c }) });
const now = (await (await fetch(`${url}?context=edit&_fields=content`, { headers: H })).json()).content.raw;
console.log(r.ok ? "Footer NL bijgewerkt" : `Fout ${r.status}`,
  "| HTML:", now.split('href="/nl/privacy/"').length - 1, "| attribuut:", now.split(esc('href="/nl/privacy/"')).length - 1, "(verwacht 1 en 1)");
