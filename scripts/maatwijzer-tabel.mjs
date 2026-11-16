// Maatwijzer als tabel: bij welk gewicht hoort welke maat, volgens het model in maatwijzer.js.
// Rekent de grenzen uit voor wie op de bouwvragen "gemiddeld" en "normaal" kiest, bij drie lengtes,
// en hoeveel de andere antwoorden de grens verschuiven (in kg).
//   node scripts/maatwijzer-tabel.mjs
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

globalThis.window = globalThis;
globalThis.document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {}, documentElement: { lang: "nl" } };
await import(pathToFileURL("C:/Claude/maattabellen/maatwijzer/maatwijzer.js").href);
const { advies, intern, versie } = globalThis.c36Maatwijzer;
const { MATEN, SHIRT, BROEK, MODEL } = intern;
const STUK = { shirt: [SHIRT, MODEL.borst, "borst"], broek: [BROEK, MODEL.onder, "onder"] };
const LENGTES = [170, 184, 198];

// Vanaf welk gewicht begint elke maat? (plek = c + perKg·kg + perCm·cm → kg = (grens − c − perCm·cm) / perKg)
const vanaf = (stuk, cm) => { const [tabel, m] = STUK[stuk]; return MATEN.map((_, i) => (tabel.grenzen[i] - m.c - m.perCm * cm) / m.perKg); };
const band = (lijst, i) => { const lo = Math.ceil(lijst[i]), hi = i + 1 < lijst.length ? Math.ceil(lijst[i + 1]) - 1 : null; return hi === null ? `vanaf ${lo}` : `${lo}–${hi}`; };

// Hoeveel inzendingen dragen deze maat (om te zien waar de tabel op weinig gegevens rust)?
let aantal = { shirt: {}, broek: {} };
const data = new URL("../private/maatonderzoek-inzendingen.json", import.meta.url);
if (existsSync(data)) for (const r of JSON.parse(await readFile(data, "utf8"))) if (r.pasvorm === "heren") { aantal.shirt[r.shirt_maat] = (aantal.shirt[r.shirt_maat] || 0) + 1; aantal.broek[r.broek_maat] = (aantal.broek[r.broek_maat] || 0) + 1; }

console.log(`MAATWIJZER v${versie}: gewicht (kg) per maat, bij "gemiddeld / gemiddeld / normaal"\n`);
for (const stuk of ["shirt", "broek"]) {
  const per = LENGTES.map((cm) => vanaf(stuk, cm));
  console.log(`${stuk.toUpperCase().padEnd(6)} ${LENGTES.map((cm) => `${cm} cm`.padStart(12)).join("")}   gedragen door`);
  MATEN.forEach((m, i) => console.log(`${m.padEnd(6)} ${per.map((lijst) => band(lijst, i).padStart(12)).join("")}   ${aantal[stuk][m] || 0} heren`));
  const [, m, sleutel] = STUK[stuk];
  const kg = (cm) => (cm / m.perKg).toFixed(1);
  const delen = [`10 cm langer: ${kg(-m.perCm * 10)} kg`, `strak: ${kg(-MODEL.pas.strak)} kg`, `ruim: ${kg(-MODEL.pas.ruim)} kg`,
    `buik vlak: ${kg(-MODEL.buik.vlak[sleutel])} kg`, `buik rond: ${kg(-MODEL.buik.rond[sleutel])} kg`];
  if (stuk === "shirt") delen.push(`bovenlichaam smal: ${kg(-MODEL.bouw.smal)} kg`, `breed: ${kg(-MODEL.bouw.breed)} kg`);
  console.log(`  Zo schuiven de grenzen (plus = je moet zoveel zwaarder zijn voor dezelfde maat): ${delen.join(" | ")}\n`);
}
// Controle: de tabel moet hetzelfde geven als de maatwijzer zelf.
let fout = 0;
for (const cm of LENGTES) for (let kg = 45; kg <= 140; kg++) for (const stuk of ["shirt", "broek"]) {
  const lijst = vanaf(stuk, cm); let i = 0; while (i < MATEN.length - 1 && kg >= lijst[i + 1]) i++;
  if (advies({ lengte: cm, gewicht: kg, bouw: "gemiddeld", buik: "gemiddeld", pas: "normaal" })[stuk].maat !== MATEN[i]) fout++;
}
console.log(`Controle tegen de maatwijzer zelf (45–140 kg, drie lengtes): ${fout === 0 ? "tabel en maatwijzer geven overal dezelfde maat" : fout + " verschillen!"}`);
