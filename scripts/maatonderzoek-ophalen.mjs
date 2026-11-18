// Maatonderzoek: haalt alle inzendingen van formulier 7 (NL) en 8 (EN) op en bewaart ze ZONDER IP-adres, browser of
// apparaat in private/maatonderzoek-inzendingen.json (niet in Git). Alleen de antwoorden, het nummer en de datum.
//   node scripts/maatonderzoek-ophalen.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const F = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json/fluentform/v1";
const ROOT = new URL("..", import.meta.url);
const state = JSON.parse(await readFile(new URL("state.json", ROOT), "utf8"));
// dames_pasvorm (sinds 18 nov 2026, alleen gevraagd aan dames): dames / unisex / onbekend; leeg bij oudere inzendingen.
const VELDEN = ["pasvorm", "dames_pasvorm", "lengte", "gewicht", "bovenlichaam", "buik", "pasvoorkeur", "shirt_maat", "shirt_zit", "broek_maat", "broek_zit", "leeftijd", "ander_merk", "opmerking", "borst", "taille", "heup"];
// Proefinzendingen zonder het woord "test" in de opmerking. Ze krijgen hier "test:" voor de opmerking, zodat de
// analysescripts (die op dat woord filteren) ze overslaan. 266: proef van Jeroen voor de vraag naar de damespasvorm (18 nov 2026).
const PROEVEN = new Set([266]);
const GETAL = new Set(["lengte", "gewicht", "leeftijd", "borst", "taille", "heup"]);

const alle = [];
for (const [taal, formId] of Object.entries(state.maatonderzoek.forms)) {
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`${F}/submissions?form_id=${formId}&per_page=100&page=${page}`, { headers: H });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { throw new Error(`formulier ${formId}: geen JSON (${r.status}) ${t.slice(0, 80).replace(/\s+/g, " ")}`); }
    const blok = j.submissions || j;
    const rijen = blok.data || [];
    for (const s of rijen) {
      let d = s.response; if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = {}; } }
      const rij = { nr: Number(s.id), taal, datum: s.created_at, status: s.status };
      for (const v of VELDEN) {
        const ruw = d?.[v];
        if (GETAL.has(v)) { const g = parseFloat(String(ruw ?? "").replace(",", ".")); rij[v] = Number.isFinite(g) ? g : null; }
        else rij[v] = ruw === undefined || ruw === null ? "" : String(ruw).trim();
      }
      if (PROEVEN.has(rij.nr) && !/\btest\b/i.test(rij.opmerking)) rij.opmerking = ("test: " + rij.opmerking).trim();
      alle.push(rij);
    }
    const laatste = blok.last_page ?? 1;
    if (page >= laatste || !rijen.length) break;
  }
}
alle.sort((a, b) => a.nr - b.nr);
await mkdir(new URL("private/", ROOT), { recursive: true });
await writeFile(new URL("private/maatonderzoek-inzendingen.json", ROOT), JSON.stringify(alle, null, 1));
const tel = (f) => alle.reduce((o, r) => { const k = f(r) || "(leeg)"; o[k] = (o[k] || 0) + 1; return o; }, {});
console.log(`${alle.length} inzendingen opgehaald (nr. ${alle[0]?.nr} t/m ${alle.at(-1)?.nr}), ${alle[0]?.datum} tot ${alle.at(-1)?.datum}`);
console.log("proefinzendingen (tellen niet mee in de analyse):", alle.filter((r) => /\btest\b/i.test(r.opmerking)).map((r) => r.nr).join(", ") || "geen");
console.log("taal:", tel((r) => r.taal), "| pasvorm:", tel((r) => r.pasvorm), "| dames, pasvorm:", tel((r) => r.pasvorm === "dames" ? r.dames_pasvorm || "(niet gevraagd)" : "n.v.t."), "| status:", tel((r) => r.status));
console.log("met meetlint (borst/taille/heup):", alle.filter((r) => r.borst).length, alle.filter((r) => r.taille).length, alle.filter((r) => r.heup).length, "| met leeftijd:", alle.filter((r) => r.leeftijd).length, "| met ander merk:", alle.filter((r) => r.ander_merk).length, "| met opmerking:", alle.filter((r) => r.opmerking).length);
