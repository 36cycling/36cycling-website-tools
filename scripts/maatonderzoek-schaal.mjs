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
const heren = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8")).filter((r) => r.pasvorm === "heren" && !/\btest\b/i.test(r.opmerking))
  .filter(((gezien) => (r) => { const k = [r.lengte, r.gewicht, r.bovenlichaam, r.buik, r.pasvoorkeur, r.shirt_maat, r.broek_maat].join("|"); if (gezien.has(k)) return false; gezien.add(k); return true; })(new Set())); // zonder tests en dubbele inzendingen

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

/* ---------- Afstelling v0.10: pasvoorkeur per kledingstuk, "strak" én "race" uit de inzendingen ----------
   Aanleiding (Jeroen, 16 nov 2026): niemand kiest "ruim"; iedereen die fietst wil strak, en racers nemen nog een maat kleiner.
   Stand 17 nov 2026 (205 inzendingen, 17 met "race"): bij het shirt klopt dat (strak ≈ −0,4 maat, race ≈ −0,85), bij de broek
   niet (strak ≈ −0,25, race niet aantoonbaar kleiner). Daarom heeft elk kledingstuk zijn eigen waarden (PAS10).
   Eerst worden beide vrij geschat (met 95%-marge); daarna worden basis, per kg en per cm afgesteld bij de vaste waarden uit PAS10.
   De mannen die "ruim" kozen tellen mee als "normaal". Bovenlichaam en buik houden hun vaste waarden. */
const PAS10 = { shirt: { strak: -0.4, race: -0.85 }, broek: { strak: -0.25, race: -0.25 } }; // broek: race = strak (racers dragen geen kleinere broek dan strak-dragers; −0,25/−0,25 gaf 59% exact, −0,2/−0,4 57%)
console.log("\nAFSTELLING v0.10: schaal C, pasvoorkeur per kledingstuk");
console.log(`  inzendingen met "race": ${heren.filter((r) => r.pasvoorkeur === "race").length}`);
const bouw10 = (stuk, r) => (stuk === "shirt" ? BOUW[r.bovenlichaam] : 0) + BUIK[stuk][r.buik];
function kk(X, y) { // kleinste kwadraten met standaardfouten
  const p = X[0].length, M = Array.from({ length: p }, (_, i) => [...Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)), ...Array.from({ length: p }, (_, j) => +(i === j))]);
  for (let k = 0; k < p; k++) { let q = k; for (let i = k + 1; i < p; i++) if (Math.abs(M[i][k]) > Math.abs(M[q][k])) q = i; [M[k], M[q]] = [M[q], M[k]]; const d = M[k][k]; for (let j = 0; j < 2 * p; j++) M[k][j] /= d; for (let i = 0; i < p; i++) if (i !== k) { const f = M[i][k]; for (let j = 0; j < 2 * p; j++) M[i][j] -= f * M[k][j]; } }
  const inv = M.map((r) => r.slice(p)), b = Array.from({ length: p }, (_, i) => X.reduce((s, r, k) => s + r[i] * y[k], 0)), w = inv.map((r) => r.reduce((s, v, j) => s + v * b[j], 0));
  const s2 = y.reduce((s, v, k) => s + (v - X[k].reduce((t, x, j) => t + x * w[j], 0)) ** 2, 0) / (y.length - p);
  return { w, se: inv.map((r, i) => Math.sqrt(s2 * r[i])) };
}
const teken = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
for (const stuk of ["shirt", "broek"]) {
  const [maat, zit] = STUK[stuk];
  const lijst = heren.filter((r) => MATEN.includes(r[maat]));
  const idx = (v) => Math.max(0, Math.min(8, Math.floor(v)));
  // 1. vrij geschat
  const vrij = kk(lijst.map((r) => [1, r.gewicht, r.lengte, +(r.pasvoorkeur === "strak"), +(r.pasvoorkeur === "race")]), lijst.map((r) => MATEN.indexOf(r[maat]) + (PLEK[r[zit]] ?? 0.5) - bouw10(stuk, r)));
  const marge = (i) => `${teken(vrij.w[i])} maat (95%: ${teken(vrij.w[i] - 1.96 * vrij.se[i])} tot ${teken(vrij.w[i] + 1.96 * vrij.se[i])})`;
  console.log(`  ${stuk} (n=${lijst.length}; strak ${lijst.filter((r) => r.pasvoorkeur === "strak").length}, race ${lijst.filter((r) => r.pasvoorkeur === "race").length}), vrij geschat: strak ${marge(3)} | race ${marge(4)}`);
  // 2. vaste waarden uit PAS10
  const P = PAS10[stuk], extra10 = (r) => bouw10(stuk, r) + (P[r.pasvoorkeur] ?? 0);
  const doel = (r) => MATEN.indexOf(r[maat]) + (PLEK[r[zit]] ?? 0.5) - extra10(r);
  const plek = (w, r) => w[0] + w[1] * r.gewicht + w[2] * r.lengte + extra10(r);
  let raak = 0, past = 0, een = 0, groter = 0, kleiner = 0;
  for (const r of lijst) { const rest = lijst.filter((x) => x !== r), w = fit(rest, rest.map(doel)); const d = idx(plek(w, r)) - MATEN.indexOf(r[maat]); if (d === 0) raak++; if (d === 0 || (r[zit] === "strak" && d === 1) || (r[zit] === "ruim" && d === -1)) past++; if (Math.abs(d) <= 1) een++; if (d > 0) groter++; if (d < 0) kleiner++; }
  const w = fit(lijst, lijst.map(doel));
  let beste = null;
  for (let sd = 0.4; sd <= 1.2001; sd += 0.02) { const l = lijst.reduce((s, r) => s + Math.log(Math.max(1e-9, kansC(plek(w, r), sd, MATEN.indexOf(r[maat])))), 0); if (!beste || l > beste.l) beste = { sd, l }; }
  const sd = Math.round(beste.sd * 100) / 100;
  const gemToon = lijst.reduce((s, r) => s + kansC(plek(w, r), sd, idx(plek(w, r))), 0) / lijst.length;
  console.log(`  ${stuk}, strak = ${P.strak} en race = ${P.race}: zelfde maat ${pct(raak, lijst.length)} | past bij drager ${pct(past, lijst.length)} | ≤1 ernaast ${pct(een, lijst.length)} | groter ${groter}, kleiner ${kleiner}`);
  console.log(`      c ${w[0].toFixed(4)} | perKg ${w[1].toFixed(5)} | perCm ${w[2].toFixed(5)} | spreiding ${sd} maat | getoond percentage gem. ${pct(gemToon * lijst.length, lijst.length)} | raak op alle inzendingen ${pct(lijst.filter((r) => idx(plek(w, r)) === MATEN.indexOf(r[maat])).length, lijst.length)}`);
  console.log(`      per maat verwacht/gedragen: ` + MATEN.map((m, i) => `${m} ${lijst.reduce((s, r) => s + kansC(plek(w, r), sd, i), 0).toFixed(0)}/${lijst.filter((r) => r[maat] === m).length}`).join("  "));
  for (const groep of ["normaal", "strak", "race"]) { const g = lijst.filter((r) => r.pasvoorkeur === groep), d = g.map((r) => idx(plek(w, r)) - MATEN.indexOf(r[maat])); console.log(`      ${groep.padEnd(8)} n=${String(g.length).padStart(3)}: zelfde maat ${pct(d.filter((v) => v === 0).length, g.length)} | advies groter ${d.filter((v) => v > 0).length}, kleiner ${d.filter((v) => v < 0).length}`); }
  for (const [naam, schuif] of [["comfortabel", 0], ["strak", P.strak], ["race", P.race]]) console.log(`      ${naam.padEnd(12)} bij 184 cm: ` + MATEN.slice(1, 7).map((m, k) => { const i = k + 1; const lo = Math.ceil((i - schuif - w[0] - w[2] * 184) / w[1]), hi = Math.ceil((i + 1 - schuif - w[0] - w[2] * 184) / w[1]) - 1; return `${m} ${lo}–${hi}`; }).join(" | "));
  const prof = w[0] + w[1] * 65 + w[2] * 180;
  console.log(`      voorbeeld Jeroen, 180 cm en 65 kg: comfortabel ${MATEN[idx(prof)]} (plek ${prof.toFixed(2)}) | strak ${MATEN[idx(prof + P.strak)]} | race ${MATEN[idx(prof + P.race)]} (plek ${(prof + P.race).toFixed(2)})`);
}

/* ---------- Dames (maatwijzer v0.11): hoeveel wijken dames af van het herenmodel? ----------
   Er zijn te weinig inzendingen van dames voor een eigen model. De maatwijzer rekent daarom met het herenmodel plus een vaste
   verschuiving per kledingstuk (MODEL.dames). Hier staat waar die verschuiving vandaan komt; draai dit opnieuw als er meer
   inzendingen van dames zijn en pas MODEL.dames in maatwijzer.js aan. */
{
  const { MODEL } = intern;
  const ruw = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8"));
  const gezienD = new Set(), dames = ruw.filter((r) => { const k = [r.lengte, r.gewicht, r.bovenlichaam, r.buik, r.pasvoorkeur, r.shirt_maat, r.broek_maat].join("|"); if (r.pasvorm !== "dames" || /\btest\b/i.test(r.opmerking || "") || gezienD.has(k)) return false; gezienD.add(k); return true; });
  // Sinds 18 nov 2026 vraagt het formulier dames naar de pasvorm: damespasvorm / unisex (= het herenmodel) / weet ik niet.
  // Besluit Jeroen (18 nov 2026): inzendingen van dames van vóór die vraag tellen als damespasvorm ("het meest waarschijnlijk").
  // MODEL.dames is dus de verschuiving voor de damespasvorm. Unisex en "weet ik niet" staan er apart onder; zet pas een eigen
  // waarde voor unisex in de maatwijzer als die groep groot genoeg is (richtlijn: 15 of meer).
  const pasvormD = (r) => r.dames_pasvorm || "dames";
  const aangenomen = dames.filter((r) => !r.dames_pasvorm).length;
  console.log(`\nDAMES t.o.v. het herenmodel (n=${dames.length}: damespasvorm ${dames.filter((r) => pasvormD(r) === "dames").length}, waarvan ${aangenomen} aangenomen (van vóór de vraag) | unisex ${dames.filter((r) => pasvormD(r) === "unisex").length} | weet ik niet ${dames.filter((r) => pasvormD(r) === "onbekend").length})`);
  console.log(`  in de maatwijzer staat nu voor dames: shirt ${MODEL.dames.borst}, broek ${MODEL.dames.onder}, spreiding ${MODEL.dames.spreiding}`);
  const gemD = (a) => a.reduce((s, v) => s + v, 0) / a.length, sdD = (a) => Math.sqrt(a.reduce((s, v) => s + (v - gemD(a)) ** 2, 0) / (a.length - 1));
  for (const [groep, naam] of [["dames", "DAMESPASVORM"], ["unisex", "UNISEX (herenmodel)"], ["onbekend", "WEET IK NIET"]]) {
    for (const [stuk, sl] of [["shirt", "borst"], ["broek", "onder"]]) {
      const [maat, zit] = STUK[stuk];
      const lijst = dames.filter((r) => pasvormD(r) === groep && MATEN.includes(r[maat]));
      if (!lijst.length) continue;
      const heer = (r) => MODEL[sl].c + MODEL[sl].perKg * r.gewicht + MODEL[sl].perCm * r.lengte + (stuk === "shirt" ? MODEL.bouw[r.bovenlichaam] : 0) + MODEL.buik[r.buik][sl] + (MODEL.pas[r.pasvoorkeur] || MODEL.pas.normaal)[sl];
      const rest = lijst.map((r) => MATEN.indexOf(r[maat]) + (PLEK[r[zit]] ?? 0.5) - heer(r)), g = gemD(rest);
      if (lijst.length < 3) { console.log(`  ${naam}, ${stuk} (n=${lijst.length}): ${g >= 0 ? "+" : ""}${g.toFixed(2)} maat t.o.v. het herenmodel (te weinig voor meer)`); continue; }
      // 95%-marge met een benadering van de t-waarde (n=16: 2,13; n=30: 2,05).
      const m = (1.96 + 2.5 / (rest.length - 1)) * sdD(rest) / Math.sqrt(rest.length);
      let raak = 0, een = 0; lijst.forEach((r, k) => { const d = Math.max(0, Math.min(8, Math.floor(heer(r) + gemD(rest.filter((_, i) => i !== k))))) - MATEN.indexOf(r[maat]); if (d === 0) raak++; if (Math.abs(d) <= 1) een++; });
      let nu = 0; for (const r of lijst) if (Math.max(0, Math.min(8, Math.floor(heer(r) + MODEL.dames[sl]))) === MATEN.indexOf(r[maat])) nu++;
      console.log(`  ${naam}, ${stuk} (n=${lijst.length}): ${g >= 0 ? "+" : ""}${g.toFixed(2)} maat t.o.v. het herenmodel (95%: ${(g - m).toFixed(2)} tot ${(g + m).toFixed(2)}) | spreiding ${sdD(rest).toFixed(2)} | eerlijk getoetst: zelfde maat ${raak} van ${lijst.length}, hooguit één ernaast ${een} | met de dameswaarde uit de maatwijzer: zelfde maat ${nu} van ${lijst.length}`);
    }
  }
}
