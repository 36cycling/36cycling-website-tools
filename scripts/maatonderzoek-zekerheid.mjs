// Maatonderzoek: hoe zeker is het advies van de maatwijzer? Kiest de spreiding (in cm) waarbij het percentage dat de
// maatwijzer toont overeenkomt met hoe vaak het advies in het onderzoek klopte, en laat zien of dat ook per groep opgaat.
// Kans dat iemand maat i draagt = deel van een normale verdeling rond zijn plek dat binnen de grenzen van maat i valt.
//   node scripts/maatonderzoek-zekerheid.mjs
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
globalThis.window = globalThis;
globalThis.document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {}, documentElement: { lang: "nl" } };
await import(pathToFileURL("C:/Claude/maattabellen/maatwijzer/maatwijzer.js").href);
const { advies, intern } = globalThis.c36Maatwijzer;
const { MATEN, SHIRT, BROEK, MODEL } = intern;
const heren = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8")).filter((r) => r.pasvorm === "heren" && !/\btest\b/i.test(r.opmerking));
const inv = (r) => ({ lengte: r.lengte, gewicht: r.gewicht, bouw: r.bovenlichaam, buik: r.buik, pas: r.pasvoorkeur });
// Normale verdeling (benadering van Abramowitz en Stegun, fout < 1e-7).
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2); const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return z >= 0 ? 1 - p : p; };
const kans = (tabel, plek, sd, i) => { const g = tabel.grenzen; const lo = i === 0 ? -Infinity : g[i], hi = i === MATEN.length - 1 ? Infinity : g[i + 1]; return phi((hi - plek) / sd) - phi((lo - plek) / sd); };
const pct = (v) => Math.round(v * 100) + "%";

for (const [stuk, tabel, veld] of [["shirt", SHIRT, "shirt_maat"], ["broek", BROEK, "broek_maat"]]) {
  const lijst = heren.filter((r) => MATEN.includes(r[veld])).map((r) => { const a = advies(inv(r))[stuk]; return { plek: a.plek, i: a.index, raak: a.maat === r[veld], d: Math.abs(a.index - MATEN.indexOf(r[veld])), draagt: MATEN.indexOf(r[veld]) }; });
  const raak = lijst.filter((x) => x.raak).length / lijst.length;
  console.log(`\n${stuk.toUpperCase()} (n=${lijst.length}): advies = gedragen maat bij ${pct(raak)}; hooguit één maat ernaast bij ${pct(lijst.filter((x) => x.d <= 1).length / lijst.length)}`);
  let beste = null;
  for (let sd = 2.5; sd <= 7.01; sd += 0.25) {
    const gemKans = lijst.reduce((s, x) => s + kans(tabel, x.plek, sd, x.i), 0) / lijst.length;
    // Hoe goed past de hele verdeling? (hoe hoger hoe beter: gemiddelde log-kans van de maat die iemand echt draagt)
    const logk = lijst.reduce((s, x) => s + Math.log(Math.max(1e-6, kans(tabel, x.plek, sd, x.draagt))), 0) / lijst.length;
    if (!beste || logk > beste.logk) beste = { sd, gemKans, logk };
    if (Math.abs(sd % 0.5) < 1e-9) console.log(`  spreiding ${sd.toFixed(2)} cm → maatwijzer zou gemiddeld ${pct(gemKans)} tonen | past bij de data: ${logk.toFixed(3)}`);
  }
  console.log(`  best passende spreiding: ${beste.sd.toFixed(2)} cm (toont gemiddeld ${pct(beste.gemKans)}, echt raak ${pct(raak)})`);
  // Klopt het ook als je splitst? Adviezen met een hoog en een laag getoond percentage.
  const sd = beste.sd, gesorteerd = lijst.map((x) => ({ ...x, k: kans(tabel, x.plek, sd, x.i) })).sort((a, b) => a.k - b.k);
  const helft = Math.floor(gesorteerd.length / 2);
  for (const [naam, deel] of [["laagste helft", gesorteerd.slice(0, helft)], ["hoogste helft", gesorteerd.slice(helft)]]) console.log(`  ${naam}: getoond gem. ${pct(deel.reduce((s, x) => s + x.k, 0) / deel.length)} (${pct(deel[0].k)}–${pct(deel.at(-1).k)}) | echt raak ${pct(deel.filter((x) => x.raak).length / deel.length)} (n=${deel.length})`);
  console.log(`  huidige waarde in het model: ${MODEL.spreiding[stuk === "shirt" ? "borst" : "onder"]} cm`);
}

// Maakt het uit of het advies "de maat waar je plek in valt" is, of "de maat met de hoogste kans"? (verschilt alleen bij smalle
// maten zoals shirt XL, waar de buurmaat waarschijnlijker kan zijn.)
console.log("\nADVIES = MAAT MET DE HOOGSTE KANS?");
for (const [stuk, tabel, veld, sd] of [["shirt", SHIRT, "shirt_maat", 3.5], ["broek", BROEK, "broek_maat", 3.75]]) {
  const lijst = heren.filter((r) => MATEN.includes(r[veld]));
  let nu = 0, top = 0, anders = 0, nu1 = 0, top1 = 0;
  for (const r of lijst) {
    const a = advies(inv(r))[stuk], draagt = MATEN.indexOf(r[veld]);
    let beste = 0; for (let i = 1; i < MATEN.length; i++) if (kans(tabel, a.plek, sd, i) > kans(tabel, a.plek, sd, beste)) beste = i;
    if (a.index === draagt) nu++; if (beste === draagt) top++; if (beste !== a.index) anders++;
    if (Math.abs(a.index - draagt) <= 1) nu1++; if (Math.abs(beste - draagt) <= 1) top1++;
  }
  console.log(`  ${stuk} (n=${lijst.length}): plek-regel raak ${pct(nu / lijst.length)} (≤1: ${pct(nu1 / lijst.length)}) | hoogste kans raak ${pct(top / lijst.length)} (≤1: ${pct(top1 / lijst.length)}) | advies verschilt bij ${anders} mensen`);
}

// Kloppen de percentages PER MAAT? Tel voor alle mannen de getoonde kansen per maat op en leg dat naast het aantal dat de maat
// echt draagt. Daarna: de grenzen tussen de maten zo leggen dat de kansen het best bij de inzendingen passen (alleen grenzen
// waar genoeg mensen omheen zitten), en opnieuw tellen.
const somPerMaat = (tabel, lijst, sd, grenzen) => MATEN.map((_, i) => lijst.reduce((s, x) => s + kans({ grenzen }, x.plek, sd, i), 0));
const logk = (lijst, sd, grenzen) => lijst.reduce((s, x) => s + Math.log(Math.max(1e-9, kans({ grenzen }, x.plek, sd, x.draagt))), 0);
console.log("\nPERCENTAGES PER MAAT");
for (const [stuk, tabel, veld, sd0] of [["shirt", SHIRT, "shirt_maat", MODEL.spreiding.borst], ["broek", BROEK, "broek_maat", MODEL.spreiding.onder]]) {
  const lijst = heren.filter((r) => MATEN.includes(r[veld])).map((r) => ({ plek: advies(inv(r))[stuk].plek, draagt: MATEN.indexOf(r[veld]) }));
  const echt = MATEN.map((_, i) => lijst.filter((x) => x.draagt === i).length);
  const toon = (naam, sd, g) => {
    const som = somPerMaat(tabel, lijst, sd, g);
    const top = lijst.filter((x) => { let b = 0; for (let i = 1; i < MATEN.length; i++) if (kans({ grenzen: g }, x.plek, sd, i) > kans({ grenzen: g }, x.plek, sd, b)) b = i; return b === x.draagt; }).length;
    console.log(`  ${naam}: ` + MATEN.map((m, i) => `${m} ${som[i].toFixed(0)}/${echt[i]}`).join("  ") + `  | maat met hoogste kans raak: ${pct(top / lijst.length)} | past bij data: ${(logk(lijst, sd, g) / lijst.length).toFixed(3)}`);
  };
  console.log(`${stuk.toUpperCase()} (n=${lijst.length}); per maat: verwacht volgens de kansen / echt gedragen`);
  toon("grenzen uit de maattabel", sd0, tabel.grenzen);
  // Grenzen M|L, L|XL, XL|2XL (index 3, 4, 5) en de spreiding vrij; om beurten de beste waarde zoeken tot het niet meer verbetert.
  let g = [...tabel.grenzen], sd = sd0, beste = logk(lijst, sd, g);
  for (let ronde = 0; ronde < 40; ronde++) {
    let verbeterd = false;
    for (const i of [3, 4, 5]) for (const stap of [0.25, -0.25]) { const p = [...g]; p[i] += stap; if (p[i] > p[i - 1] + 1 && p[i] < p[i + 1] - 1) { const l = logk(lijst, sd, p); if (l > beste + 1e-9) { g = p; beste = l; verbeterd = true; } } }
    for (const stap of [0.25, -0.25]) { const l = logk(lijst, sd + stap, g); if (sd + stap >= 2 && l > beste + 1e-9) { sd += stap; beste = l; verbeterd = true; } }
    if (!verbeterd) break;
  }
  toon(`grenzen uit de inzendingen (spreiding ${sd} cm)`, sd, g);
  console.log(`    grens M|L ${tabel.grenzen[3]} → ${g[3]} | L|XL ${tabel.grenzen[4]} → ${g[4]} | XL|2XL ${tabel.grenzen[5]} → ${g[5]}`);
  // Eerlijke toets van die aangepaste grenzen: elke man voorspeld met grenzen die zonder hem zijn bepaald.
  let raak = 0, raakOud = 0;
  for (const x of lijst) {
    const rest = lijst.filter((y) => y !== x); let gg = [...tabel.grenzen], s = sd0, b = logk(rest, s, gg);
    for (let ronde = 0; ronde < 40; ronde++) { let v = false; for (const i of [3, 4, 5]) for (const stap of [0.25, -0.25]) { const p = [...gg]; p[i] += stap; if (p[i] > p[i - 1] + 1 && p[i] < p[i + 1] - 1) { const l = logk(rest, s, p); if (l > b + 1e-9) { gg = p; b = l; v = true; } } } for (const stap of [0.25, -0.25]) { const l = logk(rest, s + stap, gg); if (s + stap >= 2 && l > b + 1e-9) { s += stap; b = l; v = true; } } if (!v) break; }
    let top = 0; for (let i = 1; i < MATEN.length; i++) if (kans({ grenzen: gg }, x.plek, s, i) > kans({ grenzen: gg }, x.plek, s, top)) top = i;
    if (top === x.draagt) raak++;
    let i0 = 0; while (i0 < MATEN.length - 1 && x.plek >= tabel.grenzen[i0 + 1]) i0++; if (i0 === x.draagt) raakOud++;
  }
  console.log(`    eerlijk getoetst: hoogste kans met aangepaste grenzen raak ${pct(raak / lijst.length)} | huidige regel (maattabel) raak ${pct(raakOud / lijst.length)}`);
}
