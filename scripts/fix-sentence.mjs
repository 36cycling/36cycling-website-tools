// Eén zin vervangen in een NL-pagina én de EN-vertaling, zonder de rest van de (door de gebruiker bewerkte)
// pagina aan te raken. Vervangt zowel de HTML als de JSON-attributen van Greenshift (é kan daar als unicode-escape staan).
// Backup van beide pagina's in backups/. Werkt ook het vertaalgeheugen bij (translations/en/page-<id>.nl/.en.txt).
//   node scripts/fix-sentence.mjs
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const NL_ID = 6430;
const CHANGES = {
  nl: ["Eén huisstijl, op de fiets en op de weg", "Eén huisstijl voor fietsen, lopen en meer"],
  en: ["One identity, on the bike and on the road", "One identity for cycling, running and more"],
};

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const bs = String.fromCharCode(92);
// Varianten zoals ze in de opgeslagen content kunnen staan: letterlijk, of met é als unicode-escape (JSON-attribuut).
const variants = (s) => [...new Set([s, s.replace(/é/g, bs + "u00e9").replace(/É/g, bs + "u00c9")])];

const tr = await (await fetch(`${W}/c36/v1/translations?element_type=post_page&id=${NL_ID}`, { headers: H })).json();
const ids = { nl: NL_ID, en: tr.translations?.en?.element_id };
for (const [lang, [from, to]] of Object.entries(CHANGES)) {
  const id = ids[lang];
  const cur = await (await fetch(`${W}/wp/v2/pages/${id}?context=edit&_fields=content&lang=${lang}`, { headers: H })).json();
  let c = cur.content.raw;
  await writeFile(new URL(`../backups/page-${id}-${Date.now()}.json`, import.meta.url), JSON.stringify(cur, null, 2));
  let n = 0;
  const fv = variants(from), tv = variants(to);
  fv.forEach((f, i) => { const k = c.split(f).length - 1; n += k; c = c.split(f).join(tv[i] ?? tv[0]); });
  if (!n) { console.log(`${lang} #${id}: zin niet gevonden — niets gewijzigd`); continue; }
  const r = await fetch(`${W}/wp/v2/pages/${id}?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify({ content: c }) });
  console.log(`${lang} #${id}: ${n}× vervangen → ${r.ok ? "opgeslagen" : "FOUT " + r.status}`);
}
// Vertaalgeheugen bijwerken, zodat een latere "apply" de nieuwe zin gebruikt.
for (const [lang, file] of [["nl", `page-${NL_ID}.nl.txt`], ["en", `page-${NL_ID}.en.txt`]]) {
  const p = new URL(`../translations/en/${file}`, import.meta.url);
  const t = await readFile(p, "utf8").catch(() => null);
  if (t && t.includes(CHANGES[lang][0])) { await writeFile(p, t.split(CHANGES[lang][0]).join(CHANGES[lang][1])); console.log(`vertaalgeheugen ${file} bijgewerkt`); }
}
