// Maatonderzoek: toetst het model van de maatwijzer aan de inzendingen en rekent een nieuwe afstelling uit.
// Leest private/maatonderzoek-inzendingen.json (eerst: node scripts/maatonderzoek-ophalen.mjs) en het model uit
// C:\Claude\maattabellen\maatwijzer\maatwijzer.js. Wijzigt niets; drukt alleen een rapport af.
//   node scripts/maatonderzoek-analyse.mjs            → rapport
//   node scripts/maatonderzoek-analyse.mjs --rijen    → ook de afwijkende inzendingen (zonder opmerkingen)
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const RIJEN = process.argv.includes("--rijen");
globalThis.window = globalThis;
globalThis.document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {}, documentElement: { lang: "nl" } };
await import(pathToFileURL("C:/Claude/maattabellen/maatwijzer/maatwijzer.js").href);
const { advies, intern } = globalThis.c36Maatwijzer;
const { MATEN, SHIRT, BROEK, MODEL } = intern;
const alle = JSON.parse(await readFile(new URL("../private/maatonderzoek-inzendingen.json", import.meta.url), "utf8"));

// De waarden van de bouwvragen in model v0.3 (vóór de ijking): secties 7 en 8 rekenen met een factor hiervan.
// Sinds maatwijzer v0.8 is de schaal in maat-eenheden (1 = één maat); de oude cm-waarden zijn gedeeld door 6.
const PRIOR = { bouw: { smal: -0.42, gemiddeld: 0, breed: 0.42 }, buik: { vlak: { borst: -0.08, onder: -0.34 }, gemiddeld: { borst: 0, onder: 0 }, rond: { borst: 0.25, onder: 0.5 } }, pas: { race: { borst: -1.7, onder: -0.5 }, strak: { borst: -0.8, onder: -0.5 }, normaal: { borst: 0, onder: 0 }, ruim: { borst: 0, onder: 0 } } }; // ×0,5 = de waarden in maatwijzer v0.10 (shirt: race −0,85, strak −0,4; broek: beide −0,25)
// De grenzen van de officiële pdf-maattabel (cm borst en heup). De maatwijzer gebruikt ze niet meer; hier alleen nog om te
// toetsen hoe goed die tabel de gedragen maat voorspelt bij wie zichzelf heeft opgemeten.
const PDF = { shirt: [79.5, 85.5, 90.5, 96.5, 102.5, 105.5, 110.5, 114.5, 117.5, 122.5], broek: [82, 88, 94, 100, 106, 112, 119, 126, 133, 140] };
const pct = (n, t) => (t ? Math.round((n / t) * 100) + "%" : "-");
const gem = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = gem(a); return Math.sqrt(gem(a.map((v) => (v - m) ** 2))); };
const r1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-");
const r2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "-");

/* ---------- 1. Opschonen ---------- */
const isTest = (r) => /\btest\b/i.test(r.opmerking);
const sleutel = (r) => [r.pasvorm, r.lengte, r.gewicht, r.bovenlichaam, r.buik, r.pasvoorkeur, r.shirt_maat, r.broek_maat].join("|");
const gezien = new Map();
const rijen = [];
const weg = { test: [], dubbel: [], onmogelijk: [] };
for (const r of alle) {
  if (isTest(r)) { weg.test.push(r.nr); continue; }
  const bmi = r.gewicht / (r.lengte / 100) ** 2;
  if (!(r.lengte >= 140 && r.lengte <= 215 && r.gewicht >= 40 && r.gewicht <= 160 && bmi >= 15 && bmi <= 50)) { weg.onmogelijk.push(r.nr); continue; }
  // Dubbel = zelfde persoon nog eens (alle hoofdantwoorden gelijk): de eerste telt.
  if (gezien.has(sleutel(r))) { weg.dubbel.push(r.nr); continue; }
  gezien.set(sleutel(r), r.nr);
  rijen.push(r);
}
const heren = rijen.filter((r) => r.pasvorm === "heren");
console.log(`INZENDINGEN: ${alle.length} opgehaald | test: ${weg.test.length} (nr. ${weg.test.join(", ") || "-"}) | dubbel: ${weg.dubbel.length} (nr. ${weg.dubbel.join(", ") || "-"}) | onmogelijke waarden: ${weg.onmogelijk.length} (nr. ${weg.onmogelijk.join(", ") || "-"})`);
console.log(`Bruikbaar: ${rijen.length}, waarvan heren ${heren.length} en dames ${rijen.length - heren.length} (het model is alleen voor heren).`);
const verdeling = (lijst, f) => { const o = {}; for (const r of lijst) { const k = f(r); o[k] = (o[k] || 0) + 1; } return o; };
console.log("Heren: lengte", r1(gem(heren.map((r) => r.lengte))), "cm (", Math.min(...heren.map((r) => r.lengte)), "-", Math.max(...heren.map((r) => r.lengte)), ") | gewicht", r1(gem(heren.map((r) => r.gewicht))), "kg (", Math.min(...heren.map((r) => r.gewicht)), "-", Math.max(...heren.map((r) => r.gewicht)), ")");
console.log("Heren: bovenlichaam", JSON.stringify(verdeling(heren, (r) => r.bovenlichaam)), "| buik", JSON.stringify(verdeling(heren, (r) => r.buik)), "| pasvoorkeur", JSON.stringify(verdeling(heren, (r) => r.pasvoorkeur)));
const volg = (o) => MATEN.concat(["2XS", "geen"]).filter((m) => o[m]).map((m) => `${m}:${o[m]}`).join(" ");
console.log("Heren: shirt", volg(verdeling(heren, (r) => r.shirt_maat)), "| hoe zit het:", JSON.stringify(verdeling(heren.filter((r) => r.shirt_maat !== "geen"), (r) => r.shirt_zit)));
console.log("Heren: broek", volg(verdeling(heren, (r) => r.broek_maat)), "| hoe zit het:", JSON.stringify(verdeling(heren.filter((r) => r.broek_maat !== "geen"), (r) => r.broek_zit)));

/* ---------- 2. Toets: advies van het model tegenover de gedragen maat ---------- */
const inv = (r) => ({ lengte: r.lengte, gewicht: r.gewicht, bouw: r.bovenlichaam, buik: r.buik, pas: r.pasvoorkeur });
const STUK = { shirt: { maat: "shirt_maat", zit: "shirt_zit", tabel: SHIRT, model: "borst", buikKey: "borst", meting: "borst" }, broek: { maat: "broek_maat", zit: "broek_zit", tabel: BROEK, model: "onder", buikKey: "onder", meting: "heup" } };
const doelgroep = (stuk) => heren.filter((r) => MATEN.includes(r[STUK[stuk].maat]));

function toets(stuk, lijst, voorspel) {
  const s = STUK[stuk];
  let exact = 0, past = 0, binnen1 = 0; const verschil = [], mis = [];
  for (const r of lijst) {
    const gedragen = MATEN.indexOf(r[s.maat]);
    const v = voorspel(r);
    const d = v - gedragen;
    verschil.push(d);
    if (d === 0) exact++;
    if (Math.abs(d) <= 1) binnen1++;
    // "Past bij wat de drager zegt": zit de maat goed, dan dezelfde maat; iets te strak, dan mag ook één groter; iets te ruim, één kleiner.
    const ok = d === 0 || (r[s.zit] === "strak" && d === 1) || (r[s.zit] === "ruim" && d === -1);
    if (ok) past++; else mis.push({ nr: r.nr, lengte: r.lengte, gewicht: r.gewicht, bouw: r.bovenlichaam, buik: r.buik, pas: r.pasvoorkeur, draagt: r[s.maat], zit: r[s.zit], advies: MATEN[v] });
  }
  return { n: lijst.length, exact, past, binnen1, bias: gem(verschil), groter: verschil.filter((d) => d > 0).length, kleiner: verschil.filter((d) => d < 0).length, mis };
}
const regel = (naam, t) => `${naam.padEnd(34)} n=${String(t.n).padStart(2)} | zelfde maat ${pct(t.exact, t.n).padStart(4)} | past bij drager ${pct(t.past, t.n).padStart(4)} | max. 1 maat ernaast ${pct(t.binnen1, t.n).padStart(4)} | advies groter ${t.groter}, kleiner ${t.kleiner} (gem. ${t.bias >= 0 ? "+" : ""}${r2(t.bias)} maat)`;

console.log("\nHUIDIG MODEL (zonder meetlint)");
const nu = {};
for (const stuk of ["shirt", "broek"]) { nu[stuk] = toets(stuk, doelgroep(stuk), (r) => advies(inv(r))[stuk].index); console.log(regel(stuk, nu[stuk])); }

/* ---------- 3. Meetlint: klopt het lichaamsmodel, en klopt de maattabel? ---------- */
// Sinds v0.5 gebruikt de maatwijzer de meting niet meer; dit blijft als controle of dat nog terecht is.
console.log("\nMEETLINT (heren die hebben gemeten): voorspelt de officiële tabel bij de gemeten omvang beter dan de maatwijzer?");
for (const stuk of ["shirt", "broek"]) {
  const s = STUK[stuk];
  const gemeten = doelgroep(stuk).filter((r) => r[s.meting]);
  if (!gemeten.length) continue;
  console.log(`${s.meting}: n=${gemeten.length}`);
  console.log(regel(`  maatwijzer (zonder meting)`, toets(stuk, gemeten, (r) => advies(inv(r))[stuk].index)));
  // Maat volgens de officiële tabel bij de gemeten omvang (zonder pasvoorkeur) tegenover de gedragen maat.
  const tab = toets(stuk, gemeten, (r) => { const g = PDF[stuk]; let i = 0; while (i < MATEN.length - 1 && r[s.meting] >= g[i + 1]) i++; return i; });
  console.log(regel(`  maattabel bij gemeten ${s.meting}`, tab));
}

/* ---------- 4. Nieuwe afstelling: kleinste kwadraten op de plek in de maattabel die bij de gedragen maat hoort ---------- */
function los(A, b) { // Gauss met spilkeuze
  const n = b.length, M = A.map((rij, i) => [...rij, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
const KOLOMMEN = ["c", "perKg", "perCm", "smal", "breed", "vlak", "rond", "strak", "ruim"];
const kenmerken = (r) => [1, r.gewicht, r.lengte, +(r.bovenlichaam === "smal"), +(r.bovenlichaam === "breed"), +(r.buik === "vlak"), +(r.buik === "rond"), +(r.pasvoorkeur === "strak"), +(r.pasvoorkeur === "ruim")];
// Doel: het midden van de gedragen maat; zit hij iets te strak dan hoort de drager bovenin die maat, iets te ruim onderin.
const PLEK = { goed: 0.5, strak: 0.85, ruim: 0.15 };
function doel(stuk, r) { const s = STUK[stuk], g = s.tabel.grenzen, i = MATEN.indexOf(r[s.maat]); return g[i] + (g[i + 1] - g[i]) * (PLEK[r[s.zit]] ?? 0.5); }
function pasAan(stuk, lijst, kolommen = KOLOMMEN) {
  const idx = kolommen.map((k) => KOLOMMEN.indexOf(k));
  const X = lijst.map((r) => idx.map((i) => kenmerken(r)[i])), y = lijst.map((r) => doel(stuk, r));
  const k = idx.length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j && i > 0 ? 1e-6 : 0)));
  const b = Array.from({ length: k }, (_, i) => X.reduce((s, x, n) => s + x[i] * y[n], 0));
  const w = los(A, b);
  const coef = Object.fromEntries(KOLOMMEN.map((naam) => [naam, kolommen.includes(naam) ? w[kolommen.indexOf(naam)] : 0]));
  const rest = lijst.map((r, n) => y[n] - kenmerken(r).reduce((s, v, i) => s + v * coef[KOLOMMEN[i]], 0));
  return { coef, restSd: Math.sqrt(rest.reduce((s, v) => s + v * v, 0) / Math.max(1, lijst.length - k)) };
}
const maatBij = (stuk, coef, r) => { const cm = kenmerken(r).reduce((s, v, i) => s + v * coef[KOLOMMEN[i]], 0); const g = STUK[stuk].tabel.grenzen; let i = 0; while (i < MATEN.length - 1 && cm >= g[i + 1]) i++; return i; };
// Eerlijke toets: elke inzending wordt voorspeld met een afstelling waar hij zelf niet in zat (leave-one-out).
function kruistoets(stuk, lijst, kolommen) { return toets(stuk, lijst, (r) => maatBij(stuk, pasAan(stuk, lijst.filter((x) => x !== r), kolommen).coef, r)); }

console.log("\nNIEUWE AFSTELLING (eerlijk getoetst: elke inzending voorspeld zonder dat hij zelf meetelde)");
const VARIANTEN = { "alleen lengte + gewicht": ["c", "perKg", "perCm"], "+ bovenlichaam en buik": ["c", "perKg", "perCm", "smal", "breed", "vlak", "rond"], "+ pasvoorkeur (alles)": KOLOMMEN };
const uit = {};
for (const stuk of ["shirt", "broek"]) {
  const lijst = doelgroep(stuk);
  console.log(regel(`${stuk}: huidig model`, nu[stuk]));
  for (const [naam, kol] of Object.entries(VARIANTEN)) console.log(regel(`${stuk}: nieuw, ${naam}`, kruistoets(stuk, lijst, kol)));
  uit[stuk] = pasAan(stuk, lijst);
  const c = uit[stuk].coef, h = MODEL[STUK[stuk].model];
  console.log(`  ${stuk}, afstelling op alle ${lijst.length} (huidig → nieuw): basis ${h.c} → ${r1(c.c)} | per kg ${h.perKg} → ${r2(c.perKg)} | per cm ${h.perCm} → ${r2(c.perCm)}`
    + (stuk === "shirt" ? ` | smal ${MODEL.bouw.smal} → ${r1(c.smal)} | breed ${MODEL.bouw.breed} → ${r1(c.breed)}` : ` | (broek) smal → ${r1(c.smal)} | breed → ${r1(c.breed)}`)
    + ` | buik vlak ${MODEL.buik.vlak[STUK[stuk].buikKey]} → ${r1(c.vlak)} | buik rond ${MODEL.buik.rond[STUK[stuk].buikKey]} → ${r1(c.rond)} | strak ${MODEL.pas.strak[STUK[stuk].buikKey]} → ${r1(c.strak)} | ruim ${MODEL.pas.ruim[STUK[stuk].buikKey]} → ${r1(c.ruim)} | restspreiding ${r1(uit[stuk].restSd)} cm`);
}

/* ---------- 5. Lange mensen: de regel "lang + maatgrens = grootste broek" is in v0.5 vervallen (zie Besluiten, 16 nov 2026).
   Of lengte toch meespeelt, zie je met --groepen (de rijen "lengte ..."). ---------- */

if (RIJEN) for (const stuk of ["shirt", "broek"]) { console.log(`\nAFWIJKEND bij huidig model, ${stuk}:`); for (const m of nu[stuk].mis) console.log(`  nr ${m.nr}: ${m.lengte} cm, ${m.gewicht} kg, ${m.bouw}/${m.buik}/${m.pas} | draagt ${m.draagt} (${m.zit}) | advies ${m.advies}`); }
console.log("\nJSON " + JSON.stringify({ shirt: uit.shirt, broek: uit.broek }));

/* ---------- 6. Verkenning (alleen met --verken): welke gegevens voorspellen de gedragen maat het best? ---------- */
if (process.argv.includes("--verken")) {
  const ZOEK = [["5XL", /\b(5XL|XXXXXL)\b/i], ["4XL", /\b(4XL|XXXXL)\b/i], ["3XL", /\b(3XL|XXXL)\b/i], ["2XL", /\b(2XL|XXL)\b/i], ["XL", /\bXL\b/i], ["XS", /\bXS\b/i], ["L", /\bL\b/i], ["M", /\bM\b/i], ["S", /\bS\b/i]];
  const anderMaat = (r) => { for (const [m, re] of ZOEK) if (re.test(r.ander_merk)) return MATEN.indexOf(m); return null; };
  const F = {
    een: () => 1, kg: (r) => r.gewicht, cm: (r) => r.lengte, bmi: (r) => r.gewicht / (r.lengte / 100) ** 2,
    smal: (r) => +(r.bovenlichaam === "smal"), breed: (r) => +(r.bovenlichaam === "breed"), vlak: (r) => +(r.buik === "vlak"), rond: (r) => +(r.buik === "rond"),
    strak: (r) => +(r.pasvoorkeur === "strak"), ruim: (r) => +(r.pasvoorkeur === "ruim"), leeftijd: (r) => r.leeftijd, ander: (r) => anderMaat(r), borst: (r) => r.borst, heup: (r) => r.heup,
  };
  function fit(lijst, y, namen, ridge = 0) {
    const X = lijst.map((r) => namen.map((n) => F[n](r))), k = namen.length;
    const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j && namen[i] !== "een" ? ridge + 1e-6 : 0)));
    const b = Array.from({ length: k }, (_, i) => X.reduce((s, x, n) => s + x[i] * y[n], 0));
    return los(A, b);
  }
  function cv(stuk, lijst, namen, ridge = 0) {
    return toets(stuk, lijst, (r) => {
      const rest = lijst.filter((x) => x !== r), w = fit(rest, rest.map((x) => doel(stuk, x)), namen, ridge);
      const cm = namen.reduce((s, n, i) => s + F[n](r) * w[i], 0), g = STUK[stuk].tabel.grenzen;
      let i = 0; while (i < MATEN.length - 1 && cm >= g[i + 1]) i++; return i;
    });
  }
  const alleK = ["een", "kg", "cm", "smal", "breed", "vlak", "rond", "strak", "ruim"];
  for (const stuk of ["shirt", "broek"]) {
    const lijst = doelgroep(stuk), s = STUK[stuk];
    console.log(`\nVERKENNING ${stuk.toUpperCase()}`);
    console.log(regel("lengte + gewicht", cv(stuk, lijst, ["een", "kg", "cm"])));
    console.log(regel("alleen gewicht", cv(stuk, lijst, ["een", "kg"])));
    console.log(regel("lengte + gewicht + bmi", cv(stuk, lijst, ["een", "kg", "cm", "bmi"])));
    console.log(regel("+ buik", cv(stuk, lijst, ["een", "kg", "cm", "vlak", "rond"])));
    console.log(regel("+ bovenlichaam", cv(stuk, lijst, ["een", "kg", "cm", "smal", "breed"])));
    console.log(regel("+ strak", cv(stuk, lijst, ["een", "kg", "cm", "strak"])));
    for (const ridge of [1, 4, 10, 30]) console.log(regel(`alles, gedempt (ridge ${ridge})`, cv(stuk, lijst, alleK, ridge)));
    const metLeeftijd = lijst.filter((r) => r.leeftijd);
    console.log(regel(`[n met leeftijd] lengte + gewicht`, cv(stuk, metLeeftijd, ["een", "kg", "cm"])));
    console.log(regel(`[n met leeftijd] + leeftijd`, cv(stuk, metLeeftijd, ["een", "kg", "cm", "leeftijd"])));
    const metAnder = lijst.filter((r) => anderMaat(r) !== null);
    console.log(regel(`[n met ander merk] lengte + gewicht`, cv(stuk, metAnder, ["een", "kg", "cm"])));
    console.log(regel(`[n met ander merk] zelfde maat als ander merk`, toets(stuk, metAnder, (r) => anderMaat(r))));
    console.log(regel(`[n met ander merk] alleen ander merk (geijkt)`, cv(stuk, metAnder, ["een", "ander"])));
    console.log(regel(`[n met ander merk] lengte + gewicht + ander merk`, cv(stuk, metAnder, ["een", "kg", "cm", "ander"])));
    const metMeting = lijst.filter((r) => r[s.meting]);
    console.log(regel(`[n gemeten] lengte + gewicht`, cv(stuk, metMeting, ["een", "kg", "cm"])));
    console.log(regel(`[n gemeten] alleen ${s.meting} (geijkt)`, cv(stuk, metMeting, ["een", s.meting])));
    console.log(regel(`[n gemeten] lengte + gewicht + ${s.meting}`, cv(stuk, metMeting, ["een", "kg", "cm", s.meting])));
    const w = fit(metMeting, metMeting.map((x) => doel(stuk, x)), ["een", s.meting]);
    console.log(`  plek in de tabel = ${r1(w[0])} + ${r2(w[1])} × gemeten ${s.meting}  (1,00 en 0 zou betekenen: tabel klopt precies)`);
    // Hoe zeker is het teken van "per cm lengte"? 2000 keer opnieuw trekken uit de inzendingen.
    let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const trek = []; for (let b = 0; b < 2000; b++) { const st = lijst.map(() => lijst[Math.floor(rnd() * lijst.length)]); const ww = fit(st, st.map((x) => doel(stuk, x)), ["een", "kg", "cm"]); trek.push([ww[1], ww[2]]); }
    const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * a.length)];
    const basis = fit(lijst, lijst.map((x) => doel(stuk, x)), ["een", "kg", "cm"]);
    console.log(`  lengte + gewicht op alle ${lijst.length}: basis ${r1(basis[0])} | per kg ${r2(basis[1])} (95%: ${r2(q(trek.map((t) => t[0]), 0.025))} tot ${r2(q(trek.map((t) => t[0]), 0.975))}) | per cm ${r2(basis[2])} (95%: ${r2(q(trek.map((t) => t[1]), 0.025))} tot ${r2(q(trek.map((t) => t[1]), 0.975))})`);
  }
  console.log(`\nAnder merk herkend bij ${heren.filter((r) => anderMaat(r) !== null).length} van ${heren.filter((r) => r.ander_merk).length} heren die iets invulden.`);
}

/* ---------- 7. Keuze voor de maatwijzer (alleen met --keuze): basis opnieuw afstellen, antwoorden op de bouwvragen
   laten meewegen met de huidige waarden (×factor). Eerlijk getoetst, en de afstelling op alle inzendingen. ---------- */
if (process.argv.includes("--keuze")) {
  const bijdrage = (stuk, r) => stuk === "shirt"
    ? PRIOR.bouw[r.bovenlichaam] + PRIOR.buik[r.buik].borst + PRIOR.pas[r.pasvoorkeur].borst
    : PRIOR.buik[r.buik].onder + PRIOR.pas[r.pasvoorkeur].onder;
  const basisFit = (stuk, lijst, factor) => {
    const X = lijst.map((r) => [1, r.gewicht, r.lengte]), y = lijst.map((r) => doel(stuk, r) - factor * bijdrage(stuk, r));
    const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + x[i] * x[j], 0)));
    return los(A, [0, 1, 2].map((i) => X.reduce((s, x, n) => s + x[i] * y[n], 0)));
  };
  const plek = (stuk, w, factor, r) => w[0] + w[1] * r.gewicht + w[2] * r.lengte + factor * bijdrage(stuk, r);
  const index = (stuk, cm) => { const g = STUK[stuk].tabel.grenzen; let i = 0; while (i < MATEN.length - 1 && cm >= g[i + 1]) i++; return i; };
  for (const stuk of ["shirt", "broek"]) {
    const lijst = doelgroep(stuk);
    console.log(`\nKEUZE ${stuk.toUpperCase()}`);
    console.log(regel("huidig model", nu[stuk]));
    for (const factor of [0, 0.5, 1]) {
      const t = toets(stuk, lijst, (r) => index(stuk, plek(stuk, basisFit(stuk, lijst.filter((x) => x !== r), factor), factor, r)));
      const w = basisFit(stuk, lijst, factor);
      const rest = lijst.map((r) => doel(stuk, r) - plek(stuk, w, factor, r));
      console.log(regel(`nieuw, bouwvragen × ${factor}`, t) + `\n      → basis ${r1(w[0])} | per kg ${r2(w[1])} | per cm ${r2(w[2])} | restspreiding ${r1(sd(rest))} cm`);
    }
  }
  // De vier personen uit het begin, met de nieuwe basis en bouwvragen × 1.
  const VIER = [[179, 80, "L", "L"], [180, 75, "M", "M"], [195, 80, "M", "M"], [185, 109, "4XL", "4XL"]];
  for (const factor of [0, 1]) {
    const ws = basisFit("shirt", doelgroep("shirt"), factor), wb = basisFit("broek", doelgroep("broek"), factor);
    console.log(`\nDe vier testpersonen (bouwvragen × ${factor}, alles gemiddeld/normaal): ` + VIER.map(([l, g, s, b]) => { const r = { lengte: l, gewicht: g, bovenlichaam: "gemiddeld", buik: "gemiddeld", pasvoorkeur: "normaal" }; return `${l}/${g}: ${MATEN[index("shirt", plek("shirt", ws, factor, r))]}/${MATEN[index("broek", plek("broek", wb, factor, r))]} (draagt ${s}/${b})`; }).join(" | "));
  }
}

/* ---------- 8. Controle per groep (alleen met --groepen): klopt de gekozen afstelling (bouwvragen × 0,5) ook voor
   lichte, zware, korte en lange mensen? Eerlijk getoetst. Drukt ook de afstelling met drie decimalen af. ---------- */
if (process.argv.includes("--groepen")) {
  const FACTOR = 0.5;
  const bijdrage = (stuk, r) => stuk === "shirt" ? PRIOR.bouw[r.bovenlichaam] + PRIOR.buik[r.buik].borst + PRIOR.pas[r.pasvoorkeur].borst : PRIOR.buik[r.buik].onder + PRIOR.pas[r.pasvoorkeur].onder;
  const basisFit = (stuk, lijst) => { const X = lijst.map((r) => [1, r.gewicht, r.lengte]), y = lijst.map((r) => doel(stuk, r) - FACTOR * bijdrage(stuk, r)); return los([0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, x) => s + x[i] * x[j], 0))), [0, 1, 2].map((i) => X.reduce((s, x, n) => s + x[i] * y[n], 0))); };
  const index = (stuk, cm) => { const g = STUK[stuk].tabel.grenzen; let i = 0; while (i < MATEN.length - 1 && cm >= g[i + 1]) i++; return i; };
  const GROEPEN = [["gewicht < 75 kg", (r) => r.gewicht < 75], ["gewicht 75–84 kg", (r) => r.gewicht >= 75 && r.gewicht < 85], ["gewicht 85–94 kg", (r) => r.gewicht >= 85 && r.gewicht < 95], ["gewicht ≥ 95 kg", (r) => r.gewicht >= 95],
    ["lengte < 178 cm", (r) => r.lengte < 178], ["lengte 178–187 cm", (r) => r.lengte >= 178 && r.lengte < 188], ["lengte ≥ 188 cm", (r) => r.lengte >= 188],
    ["draagt M of kleiner", null, (i) => i <= 2], ["draagt L", null, (i) => i === 3], ["draagt XL", null, (i) => i === 4], ["draagt 2XL of groter", null, (i) => i >= 5]];
  for (const stuk of ["shirt", "broek"]) {
    const lijst = doelgroep(stuk), s = STUK[stuk];
    const voorspeld = new Map(lijst.map((r) => { const w = basisFit(stuk, lijst.filter((x) => x !== r)); return [r, index(stuk, w[0] + w[1] * r.gewicht + w[2] * r.lengte + FACTOR * bijdrage(stuk, r))]; }));
    console.log(`\nGROEPEN ${stuk.toUpperCase()} (nieuwe afstelling, bouwvragen × ${FACTOR})`);
    for (const [naam, f, opMaat] of GROEPEN) {
      const g = lijst.filter((r) => (f ? f(r) : opMaat(MATEN.indexOf(r[s.maat]))));
      if (g.length) console.log("  " + regel(naam, toets(stuk, g, (r) => voorspeld.get(r))));
    }
    const w = basisFit(stuk, lijst);
    console.log(`  AFSTELLING ${stuk}: c ${w[0].toFixed(3)} | perKg ${w[1].toFixed(4)} | perCm ${w[2].toFixed(4)}`);
  }
}
