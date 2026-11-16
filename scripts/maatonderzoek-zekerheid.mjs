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
