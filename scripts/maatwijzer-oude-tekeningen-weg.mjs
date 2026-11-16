// Eenmalig (16 nov 2026, akkoord Jeroen): de negen zelf getekende poppetjes uit de mediabibliotheek verwijderen.
// Ze zijn vervangen door de gegenereerde illustraties (media 9952–9963). De PNG's blijven lokaal staan in media/maatwijzer/.
//   node scripts/maatwijzer-oude-tekeningen-weg.mjs          → controle: wat zou er weggaan, wordt er nog iets gebruikt?
//   node scripts/maatwijzer-oude-tekeningen-weg.mjs --apply  → verwijdert (definitief; media kent geen prullenbak)
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const B = cfg.wp.baseUrl.replace(/\/$/, "");
const ROOT = new URL("..", import.meta.url);
const state = JSON.parse(await readFile(new URL("state.json", ROOT), "utf8"));
const oud = state.maatonderzoek.media || {};
const nieuw = new Set(Object.values(state.maatonderzoek.beeld || {}).map((m) => m.id));
const get = async (pad) => { const r = await fetch(B + "/wp-json" + pad, { headers: H }); return [r.status, await r.json().catch(() => null)]; };

// Alles waar de oude bestanden in zouden kunnen staan: beide formulieren en de vier pagina's.
let hooiberg = "";
for (const id of Object.values(state.maatonderzoek.forms)) { const [, f] = await get(`/fluentform/v1/forms/${id}`); hooiberg += f.form_fields; }
for (const key of ["maatonderzoek-nl", "maatonderzoek-en", "maatwijzer-nl", "maatwijzer-en"]) {
  const lang = key.endsWith("-en") ? "en" : "nl";
  const [, p] = await get(`/wp/v2/pages/${state[key].id}?context=edit&lang=${lang}`);
  hooiberg += p.content.raw;
  const live = await (await fetch(state[key].link + "?nocache=" + Date.now(), { headers: { "User-Agent": "Mozilla/5.0 websitecontrole" } })).text();
  hooiberg += live;
}
hooiberg += await readFile(new URL("wp-root/maatwijzer.js", ROOT), "utf8");

const lijst = [];
let stop = false;
for (const [naam, m] of Object.entries(oud)) {
  const [status, item] = await get(`/wp/v2/media/${m.id}?context=edit`);
  if (status === 404) { console.log(`${naam}: #${m.id} bestaat niet (meer)`); continue; }
  const bestand = item.source_url.split("/").pop();
  const lokaal = existsSync(new URL(`media/maatwijzer/${bestand}`, ROOT));
  const gebruikt = hooiberg.includes(bestand) || hooiberg.includes(bestand.replace(/\./g, "\\."));
  const klopt = /^maatwijzer-(bovenlichaam|buik|meten)-[a-z]+\.png$/.test(bestand) && !nieuw.has(m.id);
  console.log(`${naam}: #${m.id} ${bestand} | nog in gebruik: ${gebruikt} | lokale kopie: ${lokaal} | verwacht bestand: ${klopt}`);
  if (gebruikt || !lokaal || !klopt) stop = true;
  lijst.push(item);
}
console.log(`${lijst.length} bestanden gevonden.${stop ? " NIET veilig om te verwijderen; er wordt niets gedaan." : " Niets gebruikt ze nog."}`);
if (!APPLY || stop) process.exitCode = stop ? 1 : 0;
else {
  await writeFile(new URL(`backups/media-oude-tekeningen-${Date.now()}.json`, ROOT), JSON.stringify(lijst, null, 2));
  for (const item of lijst) {
    const r = await fetch(`${B}/wp-json/wp/v2/media/${item.id}?force=true`, { method: "DELETE", headers: H });
    const j = await r.json().catch(() => ({}));
    console.log(`#${item.id} verwijderd: ${r.status} ${j.deleted === true}`);
    await new Promise((k) => setTimeout(k, 200));
  }
  delete state.maatonderzoek.media;
  await writeFile(new URL("state.json", ROOT), JSON.stringify(state, null, 2));
}
