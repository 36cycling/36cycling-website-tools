/* =====================================================================
   MAATWIJZER 36 Cycling, v0.9 (heren, FLOW shirt en SPEED broek)

   Eén los onderdeel: zoekt elk element met class "c36-maatwijzer" en bouwt
   daarin de maatwijzer op. Taal via data-lang="nl" of "en" (anders de taal
   van de pagina). De opmaak zit in een afgeschermd blok (shadow DOM), zodat
   het thema van de website en de maatwijzer elkaar niet in de weg zitten.

   Waar het advies op rust (sinds v0.8, 16 nov 2026):
   - de inzendingen van het maatonderzoek (Fluent Forms 7 en 8 op de website):
     welke maat dragen mannen met dit gewicht, deze lengte en deze antwoorden?
   - de officiële pdf-maattabel doet NIET meer mee. Volgens Jeroen is die deels
     geïnterpreteerd en overgenomen van concurrenten; in het onderzoek voorspelde
     een schaal zonder de pdf even goed, en de percentages per maat klopten beter.
   - 2026-Maattabel afmetingen FLOW shirt en SPEED broek.xlsx: de echt gemeten
     platte maten. Die staan in "Vergelijk met je eigen shirt/broek" en in de
     opmerking over de ruglengte; ze bepalen het advies niet.
   Het model opnieuw afstellen: scripts/maatonderzoek-schaal.mjs in de websitemap.
   ===================================================================== */
(function () {
  'use strict';
  if (window.c36Maatwijzer) return;

  /* ============================== Model ============================== */

  const MATEN = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  const SHIRT = {
    sleutel: 'shirt',
    // De schaal is het volgnummer van de maat: XS loopt van 0 tot 1, S van 1 tot 2, enzovoort. Elke maat is even breed.
    grenzen: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    // Echt gemeten platte maten (Excel), in cm per maat XS t/m 5XL.
    plat: [
      ['borstbreedte', [42, 45, 46, 49, 51.5, 53, 53.5, 56.5, 59]],
      ['lengteAchter', [60, 64.5, 66.5, 69, 70, 71, 72, 74, 74.5]],
      ['lengteVoor', [48.5, 52.5, 54, 56.5, 58, 59, 61.5, 61.5, 62]],
      ['taille', [35, 37, 38, 40, 42, 44, 45, 47, 49.5]],
    ],
  };

  const BROEK = {
    sleutel: 'broek',
    grenzen: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    plat: [
      ['heupbreedte', [32.5, 34, 35, 37, 38.5, 40, 42, 42, 43]],
      ['binnenbeen', [22, 24, 25, 25, 27, 27, 28, 29, 31]],
      ['lengteBretels', [40.5, 42, 42.5, 45, 46, 47.5, 50, 51, 54]],
      ['bretels', [42.5, 42.5, 47, 49, 50, 50, 50, 50, 50]],
    ],
  };

  // AFSTELLING v0.8/v0.9 (16 nov 2026): geijkt op 90 shirts en 87 broeken van heren uit het maatonderzoek (99 inzendingen),
  // met scripts/maatonderzoek-schaal.mjs in de websitemap. Alles is in maat-eenheden: 1 = één maat.
  // Eerlijk getoetst (elke man voorspeld met een afstelling waar hij zelf niet in zat):
  //   shirt: zelfde maat 49%, past bij de drager 58%, hooguit één maat ernaast 92%
  //   broek: zelfde maat 59%, past bij de drager 62%, hooguit één maat ernaast 94%
  // Op dezelfde 99 inzendingen deed de schaal van de pdf-maattabel het niet beter (shirt 49% / 58% / 92%, broek 56% / 59% / 95%).
  // Wat de inzendingen laten zien: gewicht bepaalt bijna alles (ruim 10 kg per shirtmaat, 15 kg per broekmaat); lengte doet er
  // weinig toe; de vragen over bovenlichaam, buik en pasvoorkeur verbeteren de voorspelling niet aantoonbaar en tellen daarom
  // licht mee, met vaste waarden (de helft van de oorspronkelijke aannames).
  // Eerdere afstellingen staan in de Git-geschiedenis van de websitemap (wp-root/maatwijzer.js).
  const MODEL = {
    // plek op de schaal = c + perKg * gewicht + perCm * lengte + bouw + buik + pasvoorkeur
    borst: { c: -0.0702, perKg: 0.08772, perCm: -0.01801 },    // shirt
    onder: { c: -5.7771, perKg: 0.06116, perCm: 0.02412 },     // broek
    bouw: { smal: -0.21, gemiddeld: 0, breed: 0.21 },          // alleen op het shirt
    buik: {
      vlak: { borst: -0.04, onder: -0.17 },
      gemiddeld: { borst: 0, onder: 0 },
      rond: { borst: 0.125, onder: 0.25 },
    },
    // Pasvoorkeur (v0.9). "strak" komt uit de inzendingen: wie strak kiest, draagt bij gelijk gewicht en lengte 0,5 (shirt) en
    // 0,3 (broek) maat kleiner; hier 0,4 voor beide. "race" is de regel van Jeroen (16 nov 2026): racers nemen een maat kleiner
    // dan normaal; daar zijn nog geen inzendingen van. "ruim" koos bijna niemand (2 van 91) en bestaat niet meer als keuze.
    pas: { race: -1, strak: -0.4, normaal: 0, ruim: 0 },
    // Spreiding rond iemands plek; bepaalt de percentages per maat. Gekozen als de waarde die het best bij de inzendingen past.
    // Opgeteld per maat komen de percentages dan overeen met wat er gedragen wordt
    // (shirt M 20 verwacht/21 gedragen, L 29/33, XL 19/18, 2XL 10/9; broek M 24/23, L 30/34, XL 17/18, 2XL 8/6).
    spreiding: { borst: 0.72, onder: 0.62 },
    grensMarge: 0.25,                                          // zo dicht bij een grens = "tussen twee maten"
    // Maten waar het onderzoek nog maar een paar dragers van heeft (XS, S, 3XL en groter): daar is het advies minder zeker.
    weinigData: i => i <= 1 || i >= 6,
  };
  // Uit v0.5 gehaald op 16 nov 2026 (besluit Jeroen, na de toets op de inzendingen):
  // - de regel "lang (≥ 188 cm) en tussen twee broekmaten = de grootste": was een aanname; van de 8 lange mannen op een
  //   maatgrens droegen er 5 de kleinste en 3 de grootste, en de regel verlaagde de score van 64% naar 60%.
  // - de eigen meting (borst- en heupomtrek): via de officiële tabel voorspelde die slechter dan de schatting
  //   (shirt 47% tegen 56%, broek 43% tegen 57%), en zonder is de maatwijzer eenvoudiger.

  const LIMIET = { lengte: [140, 215], gewicht: [40, 160] };

  function kiesMaat(tabel, cm) {
    const g = tabel.grenzen;
    let i = 0;
    while (i < MATEN.length - 1 && cm >= g[i + 1]) i++;
    const marge = MODEL.grensMarge;
    const totOnder = cm - g[i], totBoven = g[i + 1] - cm;
    let buur = null;
    if (totOnder < marge && i > 0) buur = i - 1;
    if (totBoven < marge && totBoven <= totOnder && i < MATEN.length - 1) buur = i + 1;
    return {
      index: i,
      maat: MATEN[i],
      buur: buur === null ? null : MATEN[buur],
      buurGroter: buur !== null && buur > i,
      teKlein: cm < g[0],
      teGroot: cm >= g[g.length - 1],
      weinigData: MODEL.weinigData(i),
    };
  }

  /* Rekent het advies uit. Wordt ook los gebruikt om het model te controleren. */
  function maatAdvies(inv) {
    const pas = MODEL.pas[inv.pas || 'normaal'];
    const bouw = MODEL.bouw[inv.bouw || 'gemiddeld'];
    const buik = MODEL.buik[inv.buik || 'gemiddeld'];
    const uit = {};

    // "plek" is de plaats op de schaal van maten (0 = onderkant XS, 9 = bovenkant 5XL): het getal dat het best past bij
    // de maat die mannen met dezelfde antwoorden dragen. Het is geen lichaamsmaat.
    const boven = MODEL.borst.c + MODEL.borst.perKg * inv.gewicht + MODEL.borst.perCm * inv.lengte + bouw + buik.borst + pas;
    uit.shirt = Object.assign(kiesMaat(SHIRT, boven), { plek: boven });
    uit.shirt.verdeling = zekerheid(SHIRT, boven, MODEL.spreiding.borst, uit.shirt.index);

    const onder = MODEL.onder.c + MODEL.onder.perKg * inv.gewicht + MODEL.onder.perCm * inv.lengte + buik.onder + pas;
    uit.broek = Object.assign(kiesMaat(BROEK, onder), { plek: onder });
    uit.broek.verdeling = zekerheid(BROEK, onder, MODEL.spreiding.onder, uit.broek.index);
    return uit;
  }

  // Hoe zeker is het advies? Het percentage mannen met dezelfde antwoorden dat precies deze maat draagt: het deel van een
  // normale verdeling rond de plek dat binnen de grenzen van de maat valt (benadering van Abramowitz en Stegun).
  function phi(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }
  // Geeft per maat (de geadviseerde en zijn buren) het percentage mannen met dezelfde antwoorden dat die maat draagt:
  // [{ index, maat, pct }]. Elk vakje telt alleen die ene maat; de drie samen zijn dus meestal net geen 100%
  // (de rest draagt een maat die nog verder weg ligt). Alleen als het advies zelf XS of 5XL is, telt dat vakje ook alles
  // eronder of erboven mee.
  // Omdat elke maat even breed is, heeft de maat waar je plek in valt altijd het hoogste percentage.
  function zekerheid(tabel, plek, sd, i) {
    const g = tabel.grenzen, laatste = MATEN.length - 1;
    const kans = k => (k === laatste && k === i ? 1 : phi((g[k + 1] - plek) / sd)) - (k === 0 && k === i ? 0 : phi((g[k] - plek) / sd));
    const uit = [];
    for (let k = Math.max(0, i - 1); k <= Math.min(laatste, i + 1); k++) uit.push({ index: k, maat: MATEN[k], pct: Math.round(kans(k) * 100) });
    return uit;
  }

  /* ============================== Teksten ============================== */

  const TEKST = {
    nl: {
      locale: 'nl-NL',
      naam: 'Maatwijzer', heren: 'Herenmaten',
      stap: (n, t) => `Stap ${n} van ${t}`, klaar: 'Jouw advies',
      terug: 'Vorige stap', volgende: 'Volgende',
      basisTitel: 'Wat is je lengte en gewicht?',
      basisLead: 'Meer hebben we niet nodig om te beginnen. Opmeten hoeft niet.',
      lengte: 'Lengte', gewicht: 'Gewicht',
      privacy: 'Je gegevens blijven op je eigen apparaat. We slaan niets op.',
      foutLengte: (a, b) => `Vul je lengte in centimeters in, tussen ${a} en ${b}.`,
      foutGewicht: (a, b) => `Vul je gewicht in kilo's in, tussen ${a} en ${b}.`,
      bouwTitel: 'Welk bovenlichaam lijkt het meest op het jouwe?', bouwLead: 'Kijk naar je schouders en borst.',
      smal: 'Smal', gemiddeld: 'Gemiddeld', breed: 'Breed',
      buikTitel: 'En je buik?', buikLead: 'Van opzij gezien.', vlak: 'Vlak', rond: 'Rond',
      pasTitel: 'Hoe strak draag je je wielerkleding?', pasLead: 'Dit telt flink mee in je maat.',
      race: 'Race', raceSub: 'Zo strak mogelijk', strak: 'Strak', strakSub: 'Als een tweede huid',
      normaal: 'Comfortabel', normaalSub: 'Aansluitend, met iets meer ruimte',
      resTitel: 'Jouw maat', wijzig: 'Wijzig',
      kleding: { shirt: 'Shirt', broek: 'Broek' }, kledingKlein: { shirt: 'shirt', broek: 'broek' },
      past: m => `Maat ${m} past het best`, grens: (a, b) => `Op de grens van ${a} en ${b}`,
      ruimer: (m, b) => `We adviseren ${m}. Wil je het ruimer, dan past ${b} ook.`,
      strakker: (m, b) => `We adviseren ${m}. Wil je het strakker, dan past ${b} ook.`,
      teKlein: 'Mogelijk kleiner dan onze kleinste maat', teGroot: 'Mogelijk groter dan onze grootste maat',
      contactHulp: 'Neem contact met ons op, dan kijken we mee.',
      langShirt: (m, rug) => `Je bent lang voor maat ${m}. De ruglengte is ${rug}, dus het shirt kan wat korter vallen.`,
      weinigData: m => `Voor maat ${m} hebben we nog weinig gegevens. Het advies is hier minder zeker.`,
      schaalSchatting: 'De percentages laten zien welke maat mannen met jouw antwoorden dragen. Het pijltje is jouw plek tussen de maten.',
      vergelijk: k => `Vergelijk met je eigen ${k}`,
      vergelijkUitleg: (k, m) => `Leg je best passende ${k} plat op tafel en meet na. Zo valt maat ${m}:`,
      plat: {
        borstbreedte: 'Borstbreedte', lengteAchter: 'Lengte achter', lengteVoor: 'Lengte voor', taille: 'Taille',
        heupbreedte: 'Heupbreedte', binnenbeen: 'Binnenbeenlengte', lengteBretels: 'Lengte vanaf bretels', bretels: 'Bretels',
      },
      collectie: 'Bekijk de collectie', collectieUrl: '/nl/categorie/fietskleding/', opnieuw: 'Opnieuw beginnen',
      onderzoek: 'Draag je al kleding van ons?', onderzoekLink: 'Help ons de maattabel te verbeteren', onderzoekUrl: '/nl/maatonderzoek/',
      voet: 'Dit advies is een schatting en nog in ontwikkeling. Twijfel je?', voetLink: 'Neem contact op', voetNa: ', dan kijken we mee.', voetUrl: '/nl/contact/',
    },
    en: {
      locale: 'en-GB',
      naam: 'Size finder', heren: "Men's sizes",
      stap: (n, t) => `Step ${n} of ${t}`, klaar: 'Your advice',
      terug: 'Previous step', volgende: 'Next',
      basisTitel: 'What is your height and weight?',
      basisLead: "That's all we need to get started. No measuring required.",
      lengte: 'Height', gewicht: 'Weight',
      privacy: "Your details stay on your own device. We don't store anything.",
      foutLengte: (a, b) => `Please enter your height in centimetres, between ${a} and ${b}.`,
      foutGewicht: (a, b) => `Please enter your weight in kilos, between ${a} and ${b}.`,
      bouwTitel: 'Which upper body looks most like yours?', bouwLead: 'Look at your shoulders and chest.',
      smal: 'Slim', gemiddeld: 'Average', breed: 'Broad',
      buikTitel: 'And your belly?', buikLead: 'Seen from the side.', vlak: 'Flat', rond: 'Round',
      pasTitel: 'How tight do you wear your cycling clothing?', pasLead: 'This weighs heavily in your size.',
      race: 'Race', raceSub: 'As tight as possible', strak: 'Tight', strakSub: 'Like a second skin',
      normaal: 'Comfortable', normaalSub: 'Close-fitting, with a little more room',
      resTitel: 'Your size', wijzig: 'Change',
      kleding: { shirt: 'Jersey', broek: 'Bib shorts' }, kledingKlein: { shirt: 'jersey', broek: 'bib shorts' },
      past: m => `Size ${m} fits best`, grens: (a, b) => `Between ${a} and ${b}`,
      ruimer: (m, b) => `We recommend ${m}. If you prefer a looser fit, ${b} works too.`,
      strakker: (m, b) => `We recommend ${m}. If you prefer a tighter fit, ${b} works too.`,
      teKlein: 'Possibly smaller than our smallest size', teGroot: 'Possibly larger than our largest size',
      contactHulp: 'Get in touch and we will help you choose.',
      langShirt: (m, rug) => `You are tall for size ${m}. The back length is ${rug}, so the jersey may sit a little shorter.`,
      weinigData: m => `We have little data for size ${m} so far. The advice is less certain here.`,
      schaalSchatting: 'The percentages show which size men with your answers wear. The arrow is your position between the sizes.',
      vergelijk: k => `Compare with your own ${k}`,
      vergelijkUitleg: (k, m) => `Lay your best-fitting ${k} flat on a table and measure. This is how size ${m} measures:`,
      plat: {
        borstbreedte: 'Chest width', lengteAchter: 'Back length', lengteVoor: 'Front length', taille: 'Waist',
        heupbreedte: 'Hip width', binnenbeen: 'Inseam', lengteBretels: 'Length from straps', bretels: 'Straps',
      },
      collectie: 'View the collection', collectieUrl: '/en/category/cycling-clothing/', opnieuw: 'Start again',
      onderzoek: 'Already wearing our clothing?', onderzoekLink: 'Help us improve the size chart', onderzoekUrl: '/en/size-survey/',
      voet: 'This advice is an estimate and still in development. Not sure?', voetLink: 'Get in touch', voetNa: ' and we will help you choose.', voetUrl: '/en/contact/',
    },
  };

  /* ============================ Illustraties ============================ */

  // Gegenereerd met Gemini ("nano banana") op 16 nov 2026 en bijgesneden tot gelijke maat; ze staan in de
  // mediabibliotheek van de website. Het maatonderzoek gebruikt dezelfde bestanden.
  const BEELD = "https://www.36cycling.com/wp-content/uploads/2026/11/maatwijzer-";
  const beeld = (naam, breed, hoog) => `<img src="${BEELD}${naam}.webp" alt="" width="${breed}" height="${hoog}" decoding="async">`;
  const figuur = naam => beeld(naam, 480, 540);     // bovenlichaam, buik, pasvorm
  const ALLE_BEELDEN = ["bovenlichaam-smal", "bovenlichaam-gemiddeld", "bovenlichaam-breed", "buik-vlak", "buik-gemiddeld", "buik-rond",
    "pas-race", "pas-strak", "pas-normaal"];

  const ICOON = {
    shirt: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icoon" d="M18 6 Q24 12 30 6 L42 12 L45 24 L37 26 L36 20 L36 42 L12 42 L12 20 L11 26 L3 24 L6 12 Z"/></svg>',
    broek: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icoon" d="M17 4 L19 15 L29 15 L31 4 M13 17 L35 17 L38 44 L27 44 L24 28 L21 44 L10 44 Z"/></svg>',
    pijl: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 L6.5 10 L12.5 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vink: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5 L8.6 14 L15 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ============================== Opmaak ============================== */

  const CSS = `
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
.mw {
  --ink: #1b2629; --zwart: #000; --muted: #5f6b6f; --line: #d5d9da; --soft: #f5f3f0; --bg: #fff;
  --accent: #00c3d1; --accent-zacht: #e3f6f8; --let-op: #c2410c; --let-op-zacht: #fff1e8; --rood: #b3261e;
  --kop: ct_font_noway, "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
  --r: 6px;
  font: 400 17px/1.55 Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  color: var(--ink); max-width: 760px; margin: 0 auto; -webkit-text-size-adjust: 100%;
}
.kader { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 20px 20px 28px; box-shadow: 0 10px 30px -18px rgba(27, 38, 41, .35); }
@media (min-width: 640px) { .kader { padding: 28px 36px 40px; } }

.balk { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.terug { width: 40px; height: 40px; margin-left: -10px; padding: 9px; border: 0; background: none; color: var(--ink); cursor: pointer; border-radius: 50%; }
.terug:hover { background: var(--soft); }
.terug[hidden] { display: none; }
.terug svg { display: block; width: 100%; height: 100%; }
.staplabel { font-size: 14px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.chip { margin-left: auto; font-size: 13px; font-weight: 500; color: var(--ink); background: var(--accent-zacht); border-radius: 99px; padding: 3px 12px; white-space: nowrap; }
.voortgang { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0 28px; }
.voortgang span { height: 4px; border-radius: 2px; background: var(--line); transition: background-color .3s; }
.voortgang span.vol { background: var(--zwart); }

.stap { outline: none; }
@media (prefers-reduced-motion: no-preference) {
  .stap { animation: in .28s ease-out both; }
  .maat { animation: pop .4s cubic-bezier(.2, .9, .3, 1.2) .08s both; }
  .schaal .stip { animation: schuif .5s ease-out .15s both; }
  .keuze, .knop, .terug { transition: border-color .15s, background-color .15s, transform .15s, box-shadow .15s; }
}
@keyframes in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pop { from { opacity: 0; transform: scale(.82); } to { opacity: 1; transform: none; } }
@keyframes schuif { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: none; } }

h2.titel { font: 700 30px/1.12 var(--kop); margin: 0 0 8px; letter-spacing: .01em; text-wrap: balance; }
@media (min-width: 640px) { h2.titel { font-size: 36px; } }
.lead { color: var(--muted); margin: 0 0 24px; }

.velden { display: grid; gap: 16px; margin-bottom: 8px; }
@media (min-width: 520px) { .velden { grid-template-columns: 1fr 1fr; } }
label.naam { display: block; font-weight: 600; margin-bottom: 6px; }
.invoer { position: relative; }
.invoer input {
  width: 100%; height: 64px; padding: 0 56px 0 16px; margin: 0; font: 700 28px/1 var(--kop); color: var(--ink);
  border: 1.5px solid var(--line); border-radius: var(--r); background: var(--bg); appearance: none;
}
.invoer input::placeholder { color: #c3c8ca; font-weight: 400; }
.invoer input:focus { outline: none; border-color: var(--zwart); box-shadow: 0 0 0 3px var(--accent-zacht); }
.invoer .eenheid { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 16px; }
.hint { font-size: 14px; color: var(--muted); margin: 8px 0 0; }
.fout { font-size: 15px; color: var(--rood); font-weight: 500; margin: 6px 0 0; min-height: 24px; }

.knop {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 54px; padding: 0 28px; margin: 0;
  border: 1.5px solid var(--zwart); border-radius: var(--r); background: var(--zwart); color: #fff;
  font: 600 17px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none;
}
.knop:hover { background: var(--ink); border-color: var(--ink); }
.knop.breed { width: 100%; }
.knop.rustig { background: none; color: var(--ink); border-color: var(--line); }
.knop.rustig:hover { border-color: var(--ink); background: none; }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.keuzes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@media (min-width: 640px) { .keuzes { gap: 16px; } }
.keuze {
  position: relative; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; width: 100%; margin: 0; padding: 12px 6px 14px; text-align: center; cursor: pointer;
  border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: inherit;
}
.keuze:hover { border-color: var(--ink); transform: translateY(-2px); box-shadow: 0 8px 18px -12px rgba(27, 38, 41, .5); }
.keuze img { display: block; width: 100%; height: auto; max-height: 200px; object-fit: contain; margin: 0 auto; mix-blend-mode: multiply; }
.keuze b { display: block; margin-top: 6px; font-weight: 600; font-size: 17px; }
.keuze small { display: block; color: var(--muted); font-size: 13px; line-height: 1.3; margin-top: 2px; }
@media (max-width: 479px) {
  .kader { padding: 16px 14px 24px; }
  .keuzes { gap: 8px; }
  .keuze { padding: 10px 2px 12px; }
  .keuze b { font-size: 14px; letter-spacing: -.01em; }
  .keuze small { font-size: 11.5px; }
  .keuze .vinkje { top: 5px; right: 5px; width: 20px; height: 20px; }
}
/* De smalste telefoons (320 px): "Comfortabel" is het langste woord en past dan alleen met iets kleinere letters. */
@media (max-width: 359px) { .keuze b { font-size: 12.5px; } }
.keuze .vinkje { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; padding: 3px; border-radius: 50%; background: var(--accent); color: #fff; opacity: 0; transform: scale(.5); transition: opacity .15s, transform .15s; }
.keuze[aria-pressed="true"] { border-color: var(--zwart); box-shadow: inset 0 0 0 1px var(--zwart); background: var(--soft); }
.keuze[aria-pressed="true"] .vinkje { opacity: 1; transform: none; }
.icoon { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }

.samenvatting { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 0 0 22px; font-size: 14px; color: var(--muted); }
.samenvatting span { background: var(--soft); border-radius: 99px; padding: 3px 12px; color: var(--ink); }
.samenvatting button { border: 0; background: none; padding: 4px 2px; font: inherit; font-weight: 600; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

.kaarten { display: grid; gap: 14px; margin-bottom: 14px; }
@media (min-width: 680px) { .kaarten { grid-template-columns: 1fr 1fr; align-items: start; } }
.kaart { border: 1.5px solid var(--line); border-radius: 8px; padding: 18px 18px 14px; background: var(--bg); }
.kaartkop { display: flex; align-items: center; gap: 10px; }
.kaartkop svg { width: 34px; height: 34px; flex: none; }
.kaartkop h3 { margin: 0; font: 600 14px/1 Inter, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.maat { font: 700 84px/1 var(--kop); margin: 18px 0 2px; letter-spacing: -.01em; transform-origin: left bottom; }
.oordeel { font-weight: 600; margin: 0 0 14px; }
.oordeel.grens { color: var(--let-op); }
.uitleg { margin: 12px 0 0; font-size: 16px; }
.notitie { margin: 10px 0 0; padding: 10px 12px; background: var(--soft); border-radius: var(--r); font-size: 14px; line-height: 1.45; }

.schaal { position: relative; margin: 4px 0 6px; padding-top: 16px; }
.schaal .vakken { display: flex; height: 54px; border-radius: var(--r); overflow: hidden; border: 1.5px solid var(--line); }
.schaal .vak { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; line-height: 1; font-size: 14px; color: var(--muted); border-right: 1.5px solid var(--line); min-width: 0; }
.schaal .vak:last-child { border-right: 0; }
.schaal .vak b { font-weight: 600; }
.schaal .vak span { font-size: 13px; font-variant-numeric: tabular-nums; }
.schaal .vak.aan span { font-weight: 600; }
.schaal .vak.aan { background: var(--zwart); color: #fff; }
.schaal .stip { position: absolute; top: 3px; width: 0; height: 0; margin-left: -8px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 11px solid var(--accent); }
.schaal-uitleg { font-size: 13px; color: var(--muted); margin: 0; }

details { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; }
summary { cursor: pointer; font-weight: 600; font-size: 15px; padding: 4px 0; }
details p { font-size: 14px; color: var(--muted); margin: 8px 0 0; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 10px 0 4px; font-size: 15px; }
dt { color: var(--muted); } dd { margin: 0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }


.acties { display: flex; flex-wrap: wrap; gap: 10px; }
.acties .knop { flex: 1 1 220px; }
.extra { margin: 18px 0 0; font-size: 15px; }
.voet { margin: 10px 0 0; font-size: 13px; color: var(--muted); }
.extra a, .voet a { color: inherit; font-weight: 600; text-underline-offset: 3px; }
`;

  /* ============================== Opbouw ============================== */

  const STAPPEN = ['basis', 'bouw', 'buik', 'pas', 'resultaat'];
  const binnen = (v, r) => Number.isFinite(v) && v >= r[0] && v <= r[1];
  const getal = tekst => { const v = parseFloat(String(tekst).replace(',', '.')); return Number.isFinite(v) ? v : null; };

  function bouwOp(host) {
    if (host.shadowRoot) return;
    const taal = TEKST[host.dataset.lang] ? host.dataset.lang : ((document.documentElement.lang || 'nl').toLowerCase().startsWith('en') ? 'en' : 'nl');
    const t = TEKST[taal];
    const cm = n => n.toLocaleString(t.locale, { maximumFractionDigits: 1 }) + ' cm';
    const staat = { stap: 0, lengte: null, gewicht: null, bouw: null, buik: null, pas: null };

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="mw" lang="${taal}"><div class="kader">
        <div class="balk">
          <button class="terug" type="button" aria-label="${t.terug}" hidden>${ICOON.pijl}</button>
          <span class="staplabel"></span>
          <span class="chip">${t.heren}</span>
        </div>
        <div class="voortgang" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="toneel" aria-live="polite"></div>
      </div></div>`;
    const $ = sel => root.querySelector(sel);
    const toneel = $('.toneel'), terug = $('.terug'), staplabel = $('.staplabel');
    const segmenten = root.querySelectorAll('.voortgang span');

    function ga(stap) {
      staat.stap = Math.max(0, Math.min(STAPPEN.length - 1, stap));
      toon();
      // Alleen terugscrollen als de bovenkant van de maatwijzer uit beeld is (niet de hele pagina naar boven).
      const boven = host.getBoundingClientRect().top;
      if (boven < 0) window.scrollTo({ top: window.scrollY + boven - 110, behavior: 'auto' });
      const kop = $('.stap');
      if (kop) kop.focus({ preventScroll: true });
    }

    function toon() {
      const laatste = staat.stap === STAPPEN.length - 1;
      terug.hidden = staat.stap === 0;
      staplabel.textContent = laatste ? t.klaar : t.stap(staat.stap + 1, STAPPEN.length - 1);
      segmenten.forEach((s, i) => s.classList.toggle('vol', i <= staat.stap - (laatste ? 1 : 0)));
      ({ basis: toonBasis, bouw: toonBouw, buik: toonBuik, pas: toonPas, resultaat: toonResultaat })[STAPPEN[staat.stap]]();
    }

    function toonBasis() {
      toneel.innerHTML = `<div class="stap" tabindex="-1">
        <h2 class="titel">${t.basisTitel}</h2>
        <p class="lead">${t.basisLead}</p>
        <form novalidate>
          <div class="velden">
            <div>
              <label class="naam" for="mw-lengte">${t.lengte}</label>
              <div class="invoer"><input id="mw-lengte" type="text" inputmode="numeric" autocomplete="off" placeholder="180" value="${staat.lengte ?? ''}"><span class="eenheid">cm</span></div>
            </div>
            <div>
              <label class="naam" for="mw-gewicht">${t.gewicht}</label>
              <div class="invoer"><input id="mw-gewicht" type="text" inputmode="decimal" autocomplete="off" placeholder="75" value="${staat.gewicht ?? ''}"><span class="eenheid">kg</span></div>
            </div>
          </div>
          <p class="fout" role="alert"></p>
          <button class="knop breed" type="submit">${t.volgende}</button>
          <p class="hint">${t.privacy}</p>
        </form></div>`;
      $('form').addEventListener('submit', e => {
        e.preventDefault();
        const l = getal($('#mw-lengte').value), g = getal($('#mw-gewicht').value);
        const fout = $('.fout');
        if (!binnen(l, LIMIET.lengte)) { fout.textContent = t.foutLengte(LIMIET.lengte[0], LIMIET.lengte[1]); $('#mw-lengte').focus(); return; }
        if (!binnen(g, LIMIET.gewicht)) { fout.textContent = t.foutGewicht(LIMIET.gewicht[0], LIMIET.gewicht[1]); $('#mw-gewicht').focus(); return; }
        staat.lengte = l; staat.gewicht = g;
        ga(1);
      });
    }

    function toonKeuze(veld, titel, lead, opties) {
      toneel.innerHTML = `<div class="stap" tabindex="-1">
        <h2 class="titel">${titel}</h2>
        <p class="lead">${lead}</p>
        <div class="keuzes">
          ${opties.map(o => `
            <button class="keuze" type="button" data-waarde="${o.waarde}" aria-pressed="${staat[veld] === o.waarde}">
              <span class="vinkje">${ICOON.vink}</span>${o.tekening}<b>${o.naam}</b>${o.sub ? `<small>${o.sub}</small>` : ''}
            </button>`).join('')}
        </div></div>`;
      root.querySelectorAll('.keuze').forEach(knop => knop.addEventListener('click', () => {
        staat[veld] = knop.dataset.waarde;
        root.querySelectorAll('.keuze').forEach(k => k.setAttribute('aria-pressed', k === knop));
        setTimeout(() => ga(staat.stap + 1), 260);
      }));
    }

    function toonBouw() {
      toonKeuze('bouw', t.bouwTitel, t.bouwLead, [
        { waarde: 'smal', naam: t.smal, tekening: figuur("bovenlichaam-smal") },
        { waarde: 'gemiddeld', naam: t.gemiddeld, tekening: figuur("bovenlichaam-gemiddeld") },
        { waarde: 'breed', naam: t.breed, tekening: figuur("bovenlichaam-breed") },
      ]);
    }
    function toonBuik() {
      toonKeuze('buik', t.buikTitel, t.buikLead, [
        { waarde: 'vlak', naam: t.vlak, tekening: figuur("buik-vlak") },
        { waarde: 'gemiddeld', naam: t.gemiddeld, tekening: figuur("buik-gemiddeld") },
        { waarde: 'rond', naam: t.rond, tekening: figuur("buik-rond") },
      ]);
    }
    function toonPas() {
      toonKeuze('pas', t.pasTitel, t.pasLead, [
        { waarde: 'race', naam: t.race, sub: t.raceSub, tekening: figuur("pas-race") },
        { waarde: 'strak', naam: t.strak, sub: t.strakSub, tekening: figuur("pas-strak") },
        { waarde: 'normaal', naam: t.normaal, sub: t.normaalSub, tekening: figuur("pas-normaal") },
      ]);
    }

    function schaal(tabel, r) {
      const g = tabel.grenzen;
      const van = Math.max(0, r.index - 1), tot = Math.min(MATEN.length - 1, r.index + 1);
      const start = g[van], breed = g[tot + 1] - start;
      const pos = v => Math.max(0, Math.min(100, (v - start) / breed * 100));
      let vakken = '';
      const pct = Object.fromEntries(r.verdeling.map(d => [d.index, d.pct]));
      for (let i = van; i <= tot; i++) vakken += `<div class="vak ${i === r.index ? 'aan' : ''}" style="flex:${g[i + 1] - g[i]}"><b>${MATEN[i]}</b><span>${pct[i]}%</span></div>`;
      return `<div class="schaal">
          <div class="vakken">${vakken}</div>
          <div class="stip" style="left:${pos(r.plek)}%"></div>
        </div>
        <p class="schaal-uitleg">${t.schaalSchatting}</p>`;
    }

    function kaart(tabel, r) {
      const k = tabel.sleutel;
      let oordeel, uitleg = '';
      if (r.teKlein) { oordeel = t.teKlein; uitleg = t.contactHulp; }
      else if (r.teGroot) { oordeel = t.teGroot; uitleg = t.contactHulp; }
      else if (r.buur) {
        oordeel = r.buurGroter ? t.grens(r.maat, r.buur) : t.grens(r.buur, r.maat);
        uitleg = r.buurGroter ? t.ruimer(r.maat, r.buur) : t.strakker(r.maat, r.buur);
      } else {
        oordeel = t.past(r.maat);
      }
      const notities = [];
      // Feitelijke opmerking voor lange mensen bij het shirt: de ruglengte van de geadviseerde maat.
      if (k === 'shirt' && staat.lengte >= 190 && r.index <= 3) notities.push(t.langShirt(r.maat, cm(SHIRT.plat[1][1][r.index])));
      if (r.weinigData) notities.push(t.weinigData(r.maat));
      return `<div class="kaart">
          <div class="kaartkop">${ICOON[k]}<h3>${t.kleding[k]}</h3></div>
          <div class="maat">${r.maat}</div>
          <p class="oordeel ${r.buur ? 'grens' : ''}">${oordeel}</p>
          ${schaal(tabel, r)}
          ${uitleg ? `<p class="uitleg">${uitleg}</p>` : ''}
          ${notities.map(n => `<p class="notitie">${n}</p>`).join('')}
          <details>
            <summary>${t.vergelijk(t.kledingKlein[k])}</summary>
            <p>${t.vergelijkUitleg(t.kledingKlein[k], r.maat)}</p>
            <dl>
              ${tabel.plat.map(rij => `<dt>${t.plat[rij[0]]}</dt><dd>${cm(rij[1][r.index])}</dd>`).join('')}
            </dl>
          </details>
        </div>`;
    }

    function toonResultaat() {
      const delen = [`${staat.lengte} cm`, `${staat.gewicht.toLocaleString(t.locale)} kg`, t[staat.bouw], t[staat.buik], t[staat.pas]];
      toneel.innerHTML = `<div class="stap" tabindex="-1">
        <h2 class="titel">${t.resTitel}</h2>
        <div class="samenvatting">${delen.map(d => `<span>${d}</span>`).join('')}<button type="button" class="wijzig">${t.wijzig}</button></div>
        <div class="kaarten"></div>
        <div class="acties">
          <a class="knop" href="${t.collectieUrl}">${t.collectie}</a>
          <button class="knop rustig" type="button" id="mw-opnieuw">${t.opnieuw}</button>
        </div>
        <p class="extra">${t.onderzoek} <a href="${t.onderzoekUrl}">${t.onderzoekLink}</a>.</p>
        <p class="voet">${t.voet} <a href="${t.voetUrl}">${t.voetLink}</a>${t.voetNa}</p>
      </div>`;
      const r = maatAdvies(staat);
      $('.kaarten').innerHTML = kaart(SHIRT, r.shirt) + kaart(BROEK, r.broek);

      $('.wijzig').addEventListener('click', () => ga(0));
      $('#mw-opnieuw').addEventListener('click', () => {
        Object.assign(staat, { lengte: null, gewicht: null, bouw: null, buik: null, pas: null });
        ga(0);
      });
    }

    terug.addEventListener('click', () => ga(staat.stap - 1));
    toon();
    setTimeout(() => ALLE_BEELDEN.forEach(naam => { new Image().src = BEELD + naam + '.webp'; }), 300);
  }

  function start() { document.querySelectorAll('.c36-maatwijzer').forEach(bouwOp); }
  // "intern" is er alleen voor de analyse van het maatonderzoek (scripts/maatonderzoek-analyse.mjs in de websitemap).
  window.c36Maatwijzer = { advies: maatAdvies, start: start, versie: '0.9.1', intern: { MATEN, SHIRT, BROEK, MODEL, LIMIET } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  start();
})();
