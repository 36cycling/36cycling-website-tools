// Maatonderzoek: op welke "liniaal" moet de maatwijzer de maten leggen?
//   A. pdf        : de grenzen uit de officiële maattabel (lichaamsmaten; volgens Jeroen deels geïnterpreteerd/overgenomen)
//   B. Excel      : de grenzen halverwege de echt gemeten kledingmaten (shirt: 2 × borstbreedte; broek: 2 × heupbreedte)
//   C. alleen data: elke maat even breed; de schaal is dan gewoon het volgnummer van de maat
// Voor elke liniaal wordt het model opnieuw afgesteld (kleinste kwadraten op de plek in het vak van de gedragen maat) en
// eerlijk getoetst: elke man wordt voorspeld met een afstelling waar hij zelf niet in zat.
//   node scripts/maatonderzoek-schaal.mjs
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
globalThis.window = globalThis;
globalThis.document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {}, documentElement: { lang: "nl" } };
await import(pathToFileURL("C:/Claude/maattabellen/maatwijzer/maatwijzer.js").href);
const { intern } = globalThis.c36Maatwijzer;
const { MATEN, SHIRT, BROEK } = intern;
const heren = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8")).filter((r) => r.pasvorm === "heren" && !/\btest\b/i.test(r.opmerking));

// Grenzen uit kledingmaten: halverwege twee opeenvolgende maten; zijn twee maten even breed, dan een minimale stap van 1 cm.
// Buitenste grenzen: een halve stap voorbij de kleinste en de grootste maat.
function uitKleding(breedtes) {
  const om = breedtes.map((b) => b * 2);
  for (let i = 1; i < om.length; i++) if (om[i] < om[i - 1] + 1) om[i] = om[i - 1] + 1;
  const g = [om[0] - (om[1] - om[0]) / 2];
  for (let i = 1; i < om.length; i++) g.push((om[i - 1] + om[i]) / 2);
  g.push(om.at(-1) + (om.at(-1) - om.at(-2)) / 2);
  return g;
}
const plat = (tabel, naam) => tabel.plat.find((p) => p[0] === naam)[1];
const PDF = { shirt: [79.5, 85.5, 90.5, 96.5, 102.5, 105.5, 110.5, 114.5, 117.5, 122.5], broek: [82, 88, 94, 100, 106, 112, 119, 126, 133, 140] };
const SCHALEN = {
  "A. pdf": PDF,
  "B. Excel (kledingmaten)": { shirt: uitKleding(plat(SHIRT, "borstbreedte")), broek: uitKleding(plat(BROEK, "heupbreedte")) },
  "C. alleen data (gelijke vakken)": { shirt: MATEN.map((_, i) => i).concat(9), broek: MATEN.map((_, i) => i).concat(9) },
};
const STUK = { shirt: ["shirt_maat", "shirt_zit"], broek: ["broek_maat", "broek_zit"] };
const PLEK = { goed: 0.5, strak: 0.85, ruim: 0.15 };
const pct = (n, t) => (Math.round((n / t) * 100) + "%").padStart(4);

function los(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let k = 0; k < n; k++) { let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i; [M[k], M[p]] = [M[p], M[k]]; for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; } } const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x; }
const X = (r) => [1, r.gewicht, r.lengte];
const fit = (lijst, y) => los([0, 1, 2].map((i) => [0, 1, 2].map((j) => lijst.reduce((s, r) => s + X(r)[i] * X(r)[j], 0))), [0, 1, 2].map((i) => lijst.reduce((s, r, n) => s + X(r)[i] * y[n], 0)));
const index = (g, v) => { let i = 0; while (i < MATEN.length - 1 && v >= g[i + 1]) i++; return i; };

for (const stuk of ["shirt", "broek"]) {
  const [maat, zit] = STUK[stuk];
  const lijst = heren.filter((r) => MATEN.includes(r[maat]));
  console.log(`\n${stuk.toUpperCase()} (n=${lijst.length}), alleen lengte + gewicht`);
  for (const [naam, schaal] of Object.entries(SCHALEN)) {
    const g = schaal[stuk];
    const doel = (r) => { const i = MATEN.indexOf(r[maat]); return g[i] + (g[i + 1] - g[i]) * (PLEK[r[zit]] ?? 0.5); };
    let raak = 0, past = 0, een = 0, groter = 0, kleiner = 0;
    for (const r of lijst) {
      const rest = lijst.filter((x) => x !== r), w = fit(rest, rest.map(doel));
      const d = index(g, w[0] + w[1] * r.gewicht + w[2] * r.lengte) - MATEN.indexOf(r[maat]);
      if (d === 0) raak++; if (d === 0 || (r[zit] === "strak" && d === 1) || (r[zit] === "ruim" && d === -1)) past++; if (Math.abs(d) <= 1) een++; if (d > 0) groter++; if (d < 0) kleiner++;
    }
    const w = fit(lijst, lijst.map(doel));
    const rest = lijst.map((r) => doel(r) - (w[0] + w[1] * r.gewicht + w[2] * r.lengte));
    const sd = Math.sqrt(rest.reduce((s, v) => s + v * v, 0) / (lijst.length - 3));
    const breed = (i) => (g[i + 1] - g[i]).toFixed(1);
    console.log(`  ${naam.padEnd(32)} zelfde maat ${pct(raak, lijst.length)} | past bij drager ${pct(past, lijst.length)} | ≤1 ernaast ${pct(een, lijst.length)} | groter ${groter}, kleiner ${kleiner}`);
    console.log(`      vakbreedte M ${breed(2)} · L ${breed(3)} · XL ${breed(4)} · 2XL ${breed(5)} · 3XL ${breed(6)} | restspreiding ${sd.toFixed(2)} (= ${(sd / ((g[5] - g[2]) / 3)).toFixed(2)} maat) | basis ${w[0].toFixed(2)}, per kg ${w[1].toFixed(4)}, per cm ${w[2].toFixed(4)}`);
    // Vanaf welk gewicht begint elke maat (bij 184 cm)?
    console.log(`      gewicht per maat bij 184 cm: ` + MATEN.map((m, i) => { const lo = Math.ceil((g[i] - w[0] - w[2] * 184) / w[1]), hi = Math.ceil((g[i + 1] - w[0] - w[2] * 184) / w[1]) - 1; return `${m} ${i === 0 ? "tot" : lo + "–"}${i === MATEN.length - 1 ? "" : hi}`; }).slice(1, 8).join(" | "));
  }
  console.log(`  echt gedragen: ` + MATEN.map((m) => `${m} ${lijst.filter((r) => r[maat] === m).length}`).join(" · "));
}
console.log("\nGrenzen B (Excel): shirt " + SCHALEN["B. Excel (kledingmaten)"].shirt.join(" | ") + "\n                   broek " + SCHALEN["B. Excel (kledingmaten)"].broek.join(" | "));

/* ---------- Afstelling voor de maatwijzer op schaal C (maat-eenheden: XS = 0 tot 1, S = 1 tot 2, ...) ----------
   De bouwvragen tellen mee met vaste waarden (de helft van de oorspronkelijke aannames, omgerekend van cm naar maten: 6 cm = 1 maat).
   Basis, per kg en per cm komen uit de inzendingen. Eerlijk getoetst, plus de spreiding waarbij de percentages het best passen. */
const BOUW = { smal: -0.21, gemiddeld: 0, breed: 0.21 };
const BUIK = { shirt: { vlak: -0.04, gemiddeld: 0, rond: 0.125 }, broek: { vlak: -0.17, gemiddeld: 0, rond: 0.25 } };
const PAS = { race: -1, strak: -0.17, normaal: 0, ruim: 0.17 }; // "race" bestaat sinds 16 nov 2026 als keuze in het onderzoek
const extra = (stuk, r) => (stuk === "shirt" ? BOUW[r.bovenlichaam] : 0) + BUIK[stuk][r.buik] + PAS[r.pasvoorkeur];
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2); const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return z >= 0 ? 1 - p : p; };
const kansC = (plek, sd, i) => (i === 8 ? 1 : phi((i + 1 - plek) / sd)) - (i === 0 ? 0 : phi((i - plek) / sd));
console.log("\nAFSTELLING OP SCHAAL C (maat-eenheden), bouwvragen met vaste waarden");
for (const stuk of ["shirt", "broek"]) {
  const [maat, zit] = STUK[stuk];
  const lijst = heren.filter((r) => MATEN.includes(r[maat]));
  const doel = (r) => MATEN.indexOf(r[maat]) + (PLEK[r[zit]] ?? 0.5) - extra(stuk, r);
  const plek = (w, r) => w[0] + w[1] * r.gewicht + w[2] * r.lengte + extra(stuk, r);
  let raak = 0, past = 0, een = 0, groter = 0, kleiner = 0;
  for (const r of lijst) {
    const rest = lijst.filter((x) => x !== r), w = fit(rest, rest.map(doel));
    const d = Math.max(0, Math.min(8, Math.floor(plek(w, r)))) - MATEN.indexOf(r[maat]);
    if (d === 0) raak++; if (d === 0 || (r[zit] === "strak" && d === 1) || (r[zit] === "ruim" && d === -1)) past++; if (Math.abs(d) <= 1) een++; if (d > 0) groter++; if (d < 0) kleiner++;
  }
  const w = fit(lijst, lijst.map(doel));
  console.log(`  ${stuk} (n=${lijst.length}): zelfde maat ${pct(raak, lijst.length)} | past bij drager ${pct(past, lijst.length)} | ≤1 ernaast ${pct(een, lijst.length)} | groter ${groter}, kleiner ${kleiner}`);
  console.log(`      c ${w[0].toFixed(4)} | perKg ${w[1].toFixed(5)} | perCm ${w[2].toFixed(5)}`);
  let beste = null;
  for (let sd = 0.4; sd <= 1.2001; sd += 0.02) { const l = lijst.reduce((s, r) => s + Math.log(Math.max(1e-9, kansC(plek(w, r), sd, MATEN.indexOf(r[maat])))), 0); if (!beste || l > beste.l) beste = { sd, l }; }
  const sd = Math.round(beste.sd * 100) / 100;
  const gemToon = lijst.reduce((s, r) => s + kansC(plek(w, r), sd, Math.max(0, Math.min(8, Math.floor(plek(w, r))))), 0) / lijst.length;
  const inRaak = lijst.filter((r) => Math.max(0, Math.min(8, Math.floor(plek(w, r)))) === MATEN.indexOf(r[maat])).length;
  console.log(`      spreiding ${sd} maat | getoond percentage bij het advies gem. ${pct(gemToon * lijst.length, lijst.length)} | raak op alle inzendingen ${pct(inRaak, lijst.length)}`);
  console.log(`      per maat verwacht/gedragen: ` + MATEN.map((m, i) => `${m} ${lijst.reduce((s, r) => s + kansC(plek(w, r), sd, i), 0).toFixed(0)}/${lijst.filter((r) => r[maat] === m).length}`).join("  "));
  console.log(`      gewicht per maat bij 184 cm, gemiddeld/normaal: ` + MATEN.map((m, i) => { const lo = Math.ceil((i - w[0] - w[2] * 184) / w[1]), hi = Math.ceil((i + 1 - w[0] - w[2] * 184) / w[1]) - 1; return `${m} ${i === 0 ? "tot " : lo + "–"}${i === 8 ? "" : hi}`; }).join(" | "));
}

/* ---------- Afstelling v0.9: de pasvoorkeur "strak" komt nu uit de inzendingen in plaats van een vaste aanname ----------
   Aanleiding (Jeroen, 16 nov 2026): niemand kiest "ruim"; iedereen die fietst wil strak, en racers nemen nog een maat kleiner.
   In de inzendingen draagt wie "strak" kiest bij gelijk gewicht en lengte ongeveer een halve maat kleiner. De twee mannen
   die "ruim" kozen tellen mee als "normaal". Bovenlichaam en buik houden hun vaste waarden. */
console.log("\nAFSTELLING v0.9: schaal C, 'strak' uit de inzendingen");
// "race" telt hier met de vaste regel van Jeroen (één maat kleiner dan normaal). Zijn er genoeg inzendingen met "race"
// (zeg 15 of meer), bepaal die waarde dan net als "strak" uit de data: voeg een kolom toe aan X9.
const extra9 = (stuk, r) => (stuk === "shirt" ? BOUW[r.bovenlichaam] : 0) + BUIK[stuk][r.buik] + (r.pasvoorkeur === "race" ? -1 : 0);
console.log(`  inzendingen met "race": ${heren.filter((r) => r.pasvoorkeur === "race").length}`);
const X9 = (r) => [1, r.gewicht, r.lengte, +(r.pasvoorkeur === "strak")];
const fit9 = (lijst, y) => los([0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => lijst.reduce((s, r) => s + X9(r)[i] * X9(r)[j], 0))), [0, 1, 2, 3].map((i) => lijst.reduce((s, r, n) => s + X9(r)[i] * y[n], 0)));
const vast = {};
for (const ronde of ["vrij", "gedeeld"]) {
  for (const stuk of ["shirt", "broek"]) {
    const [maat, zit] = STUK[stuk];
    const lijst = heren.filter((r) => MATEN.includes(r[maat]));
    // In ronde 2 staat "strak" voor beide kledingstukken op dezelfde waarde (het gemiddelde uit ronde 1) en worden alleen
    // basis, per kg en per cm opnieuw bepaald.
    const strakVast = ronde === "gedeeld" ? vast.strak : null;
    const doel = (r) => MATEN.indexOf(r[maat]) + (PLEK[r[zit]] ?? 0.5) - extra9(stuk, r) - (strakVast !== null && r.pasvoorkeur === "strak" ? strakVast : 0);
    const pas = (w, r) => (strakVast !== null ? (r.pasvoorkeur === "strak" ? strakVast : 0) : w[3] * X9(r)[3]);
    const fitten = (l) => (strakVast !== null ? [...fit(l, l.map(doel)), 0] : fit9(l, l.map(doel)));
    const plek = (w, r) => w[0] + w[1] * r.gewicht + w[2] * r.lengte + extra9(stuk, r) + pas(w, r);
    const idx = (v) => Math.max(0, Math.min(8, Math.floor(v)));
    let raak = 0, past = 0, een = 0;
    for (const r of lijst) { const w = fitten(lijst.filter((x) => x !== r)); const d = idx(plek(w, r)) - MATEN.indexOf(r[maat]); if (d === 0) raak++; if (d === 0 || (r[zit] === "strak" && d === 1) || (r[zit] === "ruim" && d === -1)) past++; if (Math.abs(d) <= 1) een++; }
    const w = fitten(lijst);
    if (ronde === "vrij") { vast[stuk] = w[3]; console.log(`  ${stuk} (n=${lijst.length}), strak vrij: zelfde maat ${pct(raak, lijst.length)} | past bij drager ${pct(past, lijst.length)} | ≤1 ernaast ${pct(een, lijst.length)} | strak = ${w[3].toFixed(3)} maat`); continue; }
    let beste = null;
    for (let sd = 0.4; sd <= 1.2001; sd += 0.02) { const l = lijst.reduce((s, r) => s + Math.log(Math.max(1e-9, kansC(plek(w, r), sd, MATEN.indexOf(r[maat])))), 0); if (!beste || l > beste.l) beste = { sd, l }; }
    const sd = Math.round(beste.sd * 100) / 100;
    console.log(`  ${stuk} (n=${lijst.length}), strak = ${strakVast.toFixed(2)} voor beide: zelfde maat ${pct(raak, lijst.length)} | past bij drager ${pct(past, lijst.length)} | ≤1 ernaast ${pct(een, lijst.length)}`);
    console.log(`      c ${w[0].toFixed(4)} | perKg ${w[1].toFixed(5)} | perCm ${w[2].toFixed(5)} | spreiding ${sd} maat | raak op alle inzendingen ${pct(lijst.filter((r) => idx(plek(w, r)) === MATEN.indexOf(r[maat])).length, lijst.length)}`);
    console.log(`      per maat verwacht/gedragen: ` + MATEN.map((m, i) => `${m} ${lijst.reduce((s, r) => s + kansC(plek(w, r), sd, i), 0).toFixed(0)}/${lijst.filter((r) => r[maat] === m).length}`).join("  "));
    for (const [naam, schuif] of [["normaal", 0], ["strak", strakVast], ["race (-1 maat, regel Jeroen)", -1]]) console.log(`      ${naam.padEnd(30)} bij 184 cm: ` + MATEN.slice(1, 7).map((m, k) => { const i = k + 1; const lo = Math.ceil((i - schuif - w[0] - w[2] * 184) / w[1]), hi = Math.ceil((i + 1 - schuif - w[0] - w[2] * 184) / w[1]) - 1; return `${m} ${lo}–${hi}`; }).join(" | "));
    const prof = w[0] + w[1] * 65 + w[2] * 180;
    console.log(`      voorbeeld Jeroen, 180 cm en 65 kg: normaal ${MATEN[idx(prof)]} (plek ${prof.toFixed(2)}) | strak ${MATEN[idx(prof + strakVast)]} | race ${MATEN[idx(prof - 1)]} (plek ${(prof - 1).toFixed(2)})`);
  }
  if (ronde === "vrij") vast.strak = Math.round(((vast.shirt + vast.broek) / 2) * 100) / 100;
}
