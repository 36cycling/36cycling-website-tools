// Taalfouten in de NL-categorieteksten (term description) verbeteren. Alleen echte fouten, geen herschrijving.
// Werkt de huidige tekst in WordPress bij (via c36/v1/term-description, met opmaak) én de bronbestanden
// (audit/old-categories.json en het vertaalgeheugen translations/en/_cat-body-*.todo.txt), zodat
// category-descriptions.mjs later niet de oude fouten terugzet. Backup in backups/.
//   node scripts/fix-category-language.mjs [--dry]
import { readFile, writeFile, readdir } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const DRY = process.argv.includes("--dry");
// [van, naar] — volgorde telt (langere/specifiekere eerst).
const FIXES = [
  ["Onze collectie omvat hoge kwaliteit eigen ontworpen fietskleding voor heren", "Onze collectie omvat hoogwaardige, zelf ontworpen fietskleding voor heren"],
  ["het hoogste comfort en prestaties kunt ervaren", "het hoogste comfort en de beste prestaties kunt ervaren"],
  ["zodat iedereen de perfecte wielrenbroek kan vinden die aan jouw behoeften voldoet", "zodat je altijd de perfecte wielrenbroek vindt die aan jouw behoeften voldoet"],
  ["streven we, net als jullie fanatieke fietsers, altijd", "streven we, net als jij als fanatieke fietser, altijd"],
  ["voor iedere biker", "voor iedere fietser"],
  ["Onze fietsshirts mannen", "Onze fietsshirts voor mannen"],
  ["Naast comfort en prestaties, bieden", "Naast comfort en prestaties bieden"],
  ["Op zoek naar een hoge kwaliteit fietsshirt", "Op zoek naar een hoogwaardig fietsshirt"],
  ["Korte mouwen bieden een volledig scala aan beweging, wat resulteert in", "Korte mouwen bieden volledige bewegingsvrijheid, wat resulteert in"],
  ["draait alles om jouw fietservaring verbeteren", "draait alles om het verbeteren van jouw fietservaring"],
  ["fiets garderobe", "fietsgarderobe"],
  ["waar prestatie en stijl samenkomt", "waar prestatie en stijl samenkomen"],
  ["goed uit wil zien", "goed uit wilt zien"],
  ["stijlen, maten en kleuren, hebben we", "stijlen, maten en kleuren hebben we"],
  ["kwaliteit van de uitrusting essentieel is", "kwaliteit van de uitrusting essentieel zijn"],
  ["voor avontuurlijke bikers", "voor avontuurlijke fietsters"],
  ["een stijlvolle uitstraling, kun je", "een stijlvolle uitstraling kun je"],
  ["Of je nu deelnemer bent aan wedstrijden", "Of je nu meedoet aan wedstrijden"],
  ["doorgewinterde wielrenner bent of net begint met fietsen, 36 Cycling heeft het ideale dames", "doorgewinterde wielrenster bent of net begint met fietsen, 36 Cycling heeft het ideale dames"],
  ["fietsshirt&nbsp; voor", "fietsshirt voor"],
  ["Bestel jouw wielershirt dames fietsshirt korte mouw bij 36 Cycling", "Bestel jouw dames fietsshirt met korte mouw bij 36 Cycling"],
  ["Of je nu een doorgewinterde wielrenner bent of net begint, 36 Cycling heeft het perfecte fietsshirt", "Of je nu een doorgewinterde wielrenster bent of net begint, 36 Cycling heeft het perfecte fietsshirt"],
  ["met onze vrouwen fietsshirts met korte mouw", "met onze fietsshirts met korte mouw voor vrouwen"],
  ["word een trotse deel van de 36 Cycling gemeenschap van fietsliefhebbers", "word onderdeel van de 36 Cycling-gemeenschap van fietsliefhebbers"],
  ["Duurzaamheid en kwaliteit bij onze wielershirt dames lange mouw", "Duurzaamheid en kwaliteit van onze wielershirts dames lange mouw"],
  ["Fietsbrillen voor elke fietser: Bescherm", "Fietsbrillen voor elke fietser: bescherm"],
  ["Waarom Fietsbrillen Essentieel Zijn", "Waarom fietsbrillen essentieel zijn"],
  ["maar ze helpen ook schadelijke", "maar helpt ook schadelijke"],
  ["En wat nog het allerbelangrijst is dat je altijd goed zicht blijft houden en de fietsbril op z", "En het allerbelangrijkste: je houdt altijd goed zicht en de fietsbril blijft op z"],
  ["n plek blijft zitten.", "n plek zitten."],
  ["Revo Lenzen voor Optimale Zichtbaarheid en Prestaties", "Revo-lenzen voor optimale zichtbaarheid en prestaties"],
  ["voor Bescherming en Stijl", "voor bescherming en stijl"],
  ["Ontdek het Comfort van Onze Fietssokken", "Ontdek het comfort van onze fietssokken"],
  ["Fietssokken zijn vaak een over het hoofd gezien, maar toch een essentieel onderdeel", "Fietssokken zijn een vaak over het hoofd gezien, maar essentieel onderdeel"],
  ["Waarom Zijn Fietssokken Belangrijk?", "Waarom zijn fietssokken belangrijk?"],
  ["Pasvorm en Ondersteuning:", "Pasvorm en ondersteuning:"],
  ["Prestatiegerichte Details van onze Fietssokken", "Prestatiegerichte details van onze fietssokken"],
  ["De optimale compressie:", "Optimale compressie:"],
  ["We houden van een fietssok die allround te matchen is bij al je outfits. We houden het graag eenvoudig dus.", "We houden van een fietssok die bij al je outfits past. Dus houden we het graag eenvoudig."],
  ["of gewoon een rondje fiets voor de ontspanning", "of gewoon een rondje fietst voor de ontspanning"],
  // Samenstellingen en kleine fouten (komen meerdere keren voor)
  ["Racefiets kleding", "Racefietskleding"], ["racefiets kleding", "racefietskleding"],
  ["Mountainbike kleding", "Mountainbikekleding"], ["mountainbike kleding", "mountainbikekleding"],
  ["Mountainbike broek", "Mountainbikebroek"], ["mountainbike broek", "mountainbikebroek"],
  ["mountainbike shorts", "mountainbikeshorts"], ["mountainbike avontuur", "mountainbikeavontuur"],
  ["off-road avonturen", "offroadavonturen"], ["off-road avontuur", "offroadavontuur"], ["offroad avonturen", "offroadavonturen"],
  ["MTB broek", "MTB-broek"], ["MTB kleding", "MTB-kleding"],
  ["fietskleding collectie", "fietskledingcollectie"], ["wielerkleding collectie", "wielerkledingcollectie"],
  ["zones, kun je", "zones kun je"],
  ["fietssters", "fietsters"], ["fietsster", "fietster"],
  ["Onze assortiment", "Ons assortiment"],
  ["Top kwaliteit fietsshirt", "Topkwaliteit fietsshirt"],
];
const apply = (s, used) => { for (const [f, t] of FIXES) { const n = s.split(f).length - 1; if (n) { used[f] = (used[f] || 0) + n; s = s.split(f).join(t); } } return s; };

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const P = (p) => new URL("../" + p, import.meta.url);
const old = JSON.parse(await readFile(P("audit/old-categories.json"), "utf8"));
const used = {}, backup = {};
let changed = 0;
for (const [id, c] of Object.entries(old)) {
  if (!c.html) continue;
  const cur = (await (await fetch(`${W}/wp/v2/product_cat/${id}?lang=nl&context=edit&_fields=description`, { headers: H })).json()).description;
  const next = apply(cur, used);
  c.html = apply(c.html, {});
  if (next === cur) continue;
  backup[id] = cur; changed++;
  if (!DRY) {
    const r = await fetch(`${W}/c36/v1/term-description?lang=nl`, { method: "POST", headers: H, body: JSON.stringify({ taxonomy: "product_cat", term_id: +id, description: next }) });
    if (!r.ok) console.log(`✗ ${c.name}: ${r.status}`);
  }
}
const unused = FIXES.map(([f]) => f).filter((f) => !used[f]);
console.log(`${changed} categorieën gewijzigd, ${Object.values(used).reduce((a, b) => a + b, 0)} verbeteringen${unused.length ? `\nNiet gevonden: ${unused.join(" | ")}` : ""}`);
if (DRY) process.exit(0);
await writeFile(P(`backups/category-desc-nl-${Date.now()}.json`), JSON.stringify(backup, null, 2));
await writeFile(P("audit/old-categories.json"), JSON.stringify(old, null, 2));
for (const f of await readdir(P("translations/en"))) {
  if (!/^_cat-body-.*\.todo\.txt$/.test(f)) continue;
  const t = await readFile(P("translations/en/" + f), "utf8");
  const n = apply(t, {});
  if (n !== t) await writeFile(P("translations/en/" + f), n);
}
console.log("Bronbestanden en vertaalgeheugen bijgewerkt.");
