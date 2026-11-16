// Toets van de regel "lang en tussen twee broekmaten = de grootste" op de inzendingen, met het nieuwe model (v0.4).
// Ook: helpt een meting als je hem mengt met de schatting?
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
globalThis.window = globalThis;
globalThis.document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {}, documentElement: { lang: "nl" } };
await import(pathToFileURL("C:/Claude/maattabellen/maatwijzer/maatwijzer.js").href);
const { advies, intern } = globalThis.c36Maatwijzer;
const { MATEN, SHIRT, BROEK, MODEL } = intern;
const alle = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8"));
const heren = alle.filter((r) => r.pasvorm === "heren");
const inv = (r) => ({ lengte: r.lengte, gewicht: r.gewicht, bouw: r.bovenlichaam, buik: r.buik, pas: r.pasvoorkeur });
const index = (tabel, cm) => { const g = tabel.grenzen; let i = 0; while (i < MATEN.length - 1 && cm >= g[i + 1]) i++; return i; };
const pct = (n, t) => (t ? Math.round((n / t) * 100) + "%" : "-");

const broek = heren.filter((r) => MATEN.includes(r.broek_maat));
const rij = (naam, lijst, f) => { const d = lijst.map((r) => f(r) - MATEN.indexOf(r.broek_maat)); console.log(`${naam.padEnd(46)} n=${String(lijst.length).padStart(2)} | zelfde maat ${pct(d.filter((x) => x === 0).length, d.length).padStart(4)} | advies groter ${d.filter((x) => x > 0).length}, kleiner ${d.filter((x) => x < 0).length}`); };
const zonder = (r) => index(BROEK, advies(inv(r)).broek.plek);
const met = (r) => advies(inv(r)).broek.index;
console.log("BROEK, nieuw model");
rij("alle heren, zonder de lang-regel", broek, zonder);
rij("alle heren, met de lang-regel", broek, met);
const lang = broek.filter((r) => r.lengte >= MODEL.lang.vanaf);
rij("lang (≥ 188 cm), zonder de regel", lang, zonder);
rij("lang (≥ 188 cm), met de regel", lang, met);
const geraakt = lang.filter((r) => zonder(r) !== met(r));
console.log(`De regel verandert het advies bij ${geraakt.length} lange mensen:`);
for (const r of geraakt) console.log(`  ${r.lengte} cm, ${r.gewicht} kg | draagt ${r.broek_maat} (${r.broek_zit}) | zonder regel ${MATEN[zonder(r)]} → met regel ${MATEN[met(r)]}`);
// Dragen lange mensen op een grens vaker de grote of de kleine van de twee?
const opGrens = lang.filter((r) => advies(inv(r)).broek.langKeuze);
console.log(`Lang én op een maatgrens: ${opGrens.length} | draagt de grootste van de twee: ${opGrens.filter((r) => r.broek_maat === advies(inv(r)).broek.maat).length} | de kleinste: ${opGrens.filter((r) => r.broek_maat === advies(inv(r)).broek.buur).length} | iets anders: ${opGrens.filter((r) => ![advies(inv(r)).broek.maat, advies(inv(r)).broek.buur].includes(r.broek_maat)).length}`);
// En bij niet-lange mensen op een grens (ter vergelijking): dragen die vaker de grote of de kleine?
const kort = broek.filter((r) => r.lengte < MODEL.lang.vanaf).filter((r) => advies(inv(r)).broek.buur);
const groot = (r) => { const a = advies(inv(r)).broek; return a.buurGroter ? a.buur : a.maat; }, klein = (r) => { const a = advies(inv(r)).broek; return a.buurGroter ? a.maat : a.buur; };
console.log(`Niet lang en op een maatgrens: ${kort.length} | draagt de grootste van de twee: ${kort.filter((r) => r.broek_maat === groot(r)).length} | de kleinste: ${kort.filter((r) => r.broek_maat === klein(r)).length}`);

// Meting: alleen schatting, alleen meting (officiële tabel), of het gemiddelde van beide?
console.log("\nMETING MENGEN (heren die hebben gemeten; pasvoorkeur telt in alle drie mee)");
for (const [stuk, tabel, veld, maat] of [["shirt", SHIRT, "borst", "shirt_maat"], ["broek", BROEK, "heup", "broek_maat"]]) {
  const lijst = heren.filter((r) => MATEN.includes(r[maat]) && r[veld]);
  const pas = (r) => MODEL.pas[r.pasvoorkeur];
  for (const [naam, f] of [["alleen schatting", (r) => advies(inv(r))[stuk].plek], ["alleen meting (zoals nu)", (r) => r[veld] + pas(r)], ["gemiddelde van schatting en meting", (r) => (advies(inv(r))[stuk].plek + r[veld] + pas(r)) / 2], ["2/3 schatting + 1/3 meting", (r) => (2 * advies(inv(r))[stuk].plek + r[veld] + pas(r)) / 3]]) {
    const d = lijst.map((r) => index(tabel, f(r)) - MATEN.indexOf(r[maat]));
    console.log(`${(stuk + ": " + naam).padEnd(46)} n=${lijst.length} | zelfde maat ${pct(d.filter((x) => x === 0).length, d.length).padStart(4)} | max. 1 ernaast ${pct(d.filter((x) => Math.abs(x) <= 1).length, d.length).padStart(4)} | advies groter ${d.filter((x) => x > 0).length}, kleiner ${d.filter((x) => x < 0).length}`);
  }
}
