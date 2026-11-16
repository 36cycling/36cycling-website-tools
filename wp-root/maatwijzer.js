/* =====================================================================
   MAATWIJZER 36 Cycling, v0.3 (heren, FLOW shirt en SPEED broek)

   Eén los onderdeel: zoekt elk element met class "c36-maatwijzer" en bouwt
   daarin de maatwijzer op. Taal via data-lang="nl" of "en" (anders de taal
   van de pagina). De opmaak zit in een afgeschermd blok (shadow DOM), zodat
   het thema van de website en de maatwijzer elkaar niet in de weg zitten.

   Bronnen van het model:
   - maattabel-heren-cycling.pdf  -> lichaamsmaten per maat (borst, heup)
   - 2026-Maattabel afmetingen FLOW shirt en SPEED broek.xlsx -> vlakke maten

   Let op: de schatting uit lengte en gewicht is geijkt op vier personen plus
   een algemene verhouding tussen gewicht, lengte en omvang. De getallen in
   MODEL horen opnieuw bepaald te worden met de inzendingen van het
   maatonderzoek (Fluent Forms 7 en 8 op de website).
   ===================================================================== */
(function () {
  'use strict';
  if (window.c36Maatwijzer) return;

  /* ============================== Model ============================== */

  const MATEN = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  const SHIRT = {
    sleutel: 'shirt',
    // Grenzen tussen de maten in cm lichaamsomtrek (midden tussen de bereiken uit de pdf).
    grenzen: [79.5, 85.5, 90.5, 96.5, 102.5, 105.5, 110.5, 114.5, 117.5, 122.5],
    buitenTabelVanaf: 99,
    plat: [
      ['borstbreedte', [42, 45, 46, 49, 51.5, 53, 53.5, 56.5, 59]],
      ['lengteAchter', [60, 64.5, 66.5, 69, 70, 71, 72, 74, 74.5]],
      ['lengteVoor', [48.5, 52.5, 54, 56.5, 58, 59, 61.5, 61.5, 62]],
      ['taille', [35, 37, 38, 40, 42, 44, 45, 47, 49.5]],
    ],
  };

  const BROEK = {
    sleutel: 'broek',
    // De pdf loopt tot en met 3XL (119-126). 4XL en 5XL zijn doorgetrokken met stappen van 7 cm: aanname.
    grenzen: [82, 88, 94, 100, 106, 112, 119, 126, 133, 140],
    buitenTabelVanaf: 7,
    plat: [
      ['heupbreedte', [32.5, 34, 35, 37, 38.5, 40, 42, 42, 43]],
      ['binnenbeen', [22, 24, 25, 25, 27, 27, 28, 29, 31]],
      ['lengteBretels', [40.5, 42, 42.5, 45, 46, 47.5, 50, 51, 54]],
      ['bretels', [42.5, 42.5, 47, 49, 50, 50, 50, 50, 50]],
    ],
  };

  const MODEL = {
    // omvang = c + perKg * gewicht + perCm * lengte
    borst: { c: 97.7, perKg: 0.62, perCm: -0.27 },
    onder: { c: 94.6, perKg: 0.70, perCm: -0.27 },
    bouw: { smal: -2.5, gemiddeld: 0, breed: 2.5 },            // cm op de borst
    buik: {
      vlak: { borst: -0.5, onder: -2 },
      gemiddeld: { borst: 0, onder: 0 },
      rond: { borst: 1.5, onder: 3 },
    },
    pas: { strak: -2, normaal: 0, ruim: 2 },                   // cm verschuiving op beide
    spreiding: { borst: 4, onder: 3.5, gemeten: 1.5 },         // onzekerheid in cm
    grensMarge: { geschat: 1.5, gemeten: 1 },                  // zo dicht bij een grens = "tussen twee maten"
    // Broek: wie lang is en tussen twee maten zit, krijgt de grootste van de twee (langere pijp en bretels).
    // Regel en grens (188 cm) van 36 Cycling, bevestigd op 16 nov 2026; nog niet getoetst aan pasgegevens.
    lang: { vanaf: 188 },
  };

  const LIMIET = { lengte: [140, 215], gewicht: [40, 160], borst: [70, 140], heup: [70, 150] };

  function kiesMaat(tabel, cm, gemeten) {
    const g = tabel.grenzen;
    let i = 0;
    while (i < MATEN.length - 1 && cm >= g[i + 1]) i++;
    const marge = gemeten ? MODEL.grensMarge.gemeten : MODEL.grensMarge.geschat;
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
      buitenTabel: i >= tabel.buitenTabelVanaf,
    };
  }

  /* Rekent het advies uit. Wordt ook los gebruikt om het model te controleren. */
  function maatAdvies(inv) {
    const pas = MODEL.pas[inv.pas || 'normaal'];
    const bouw = MODEL.bouw[inv.bouw || 'gemiddeld'];
    const buik = MODEL.buik[inv.buik || 'gemiddeld'];
    const uit = {};

    const borstGemeten = Number.isFinite(inv.borst);
    const borst = borstGemeten
      ? inv.borst
      : MODEL.borst.c + MODEL.borst.perKg * inv.gewicht + MODEL.borst.perCm * inv.lengte + bouw + buik.borst;
    uit.shirt = Object.assign(kiesMaat(SHIRT, borst + pas, borstGemeten), {
      omvang: borst, plek: borst + pas, gemeten: borstGemeten,
      spreiding: borstGemeten ? MODEL.spreiding.gemeten : MODEL.spreiding.borst,
    });

    const heupGemeten = Number.isFinite(inv.heup);
    const onder = heupGemeten
      ? inv.heup
      : MODEL.onder.c + MODEL.onder.perKg * inv.gewicht + MODEL.onder.perCm * inv.lengte + buik.onder;
    uit.broek = Object.assign(kiesMaat(BROEK, onder + pas, heupGemeten), {
      omvang: onder, plek: onder + pas, gemeten: heupGemeten,
      spreiding: heupGemeten ? MODEL.spreiding.gemeten : MODEL.spreiding.onder,
    });

    // Twijfel tussen twee broekmaten en lang? Dan de grootste van de twee. Geldt ook na een heupmeting:
    // de omvang zegt niets over de lengte van de pijpen.
    const b = uit.broek;
    b.langKeuze = false;
    if (b.buur && !b.teKlein && !b.teGroot && inv.lengte >= MODEL.lang.vanaf) {
      if (b.buurGroter) {
        const kleinste = b.maat;
        b.index += 1;
        b.maat = MATEN[b.index];
        b.buur = kleinste;
        b.buurGroter = false;
        b.buitenTabel = b.index >= BROEK.buitenTabelVanaf;
      }
      b.langKeuze = true;
    }
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
      pasTitel: 'Hoe draag je je wielerkleding het liefst?', pasLead: 'Dit geeft de doorslag als je tussen twee maten zit.',
      strak: 'Strak', strakSub: 'Als een tweede huid', normaal: 'Normaal', normaalSub: 'Aansluitend, zonder te knellen',
      ruim: 'Ruim', ruimSub: 'Liever iets losser',
      resTitel: 'Jouw maat', wijzig: 'Wijzig',
      kleding: { shirt: 'Shirt', broek: 'Broek' }, kledingKlein: { shirt: 'shirt', broek: 'broek' },
      lichaam: { shirt: 'borstomtrek', broek: 'heupomtrek' },
      past: m => `Maat ${m} past het best`, grens: (a, b) => `Op de grens van ${a} en ${b}`,
      ruimer: (m, b) => `We adviseren ${m}. Wil je het ruimer, dan past ${b} ook.`,
      strakker: (m, b) => `We adviseren ${m}. Wil je het strakker, dan past ${b} ook.`,
      langKeuze: (m, b, verschil) => `Omdat je lang bent, adviseren we de grootste van de twee. Maat ${m} valt langer${verschil}. Wil je het strakker, dan past ${b} ook.`,
      langVerschil: (lang, kort) => `: ${lang} tegenover ${kort}, gemeten vanaf de bretels`,
      teKlein: 'Mogelijk kleiner dan onze kleinste maat', teGroot: 'Mogelijk groter dan onze grootste maat',
      contactHulp: 'Neem contact met ons op, dan kijken we mee.',
      langShirt: (m, rug) => `Je bent lang voor maat ${m}. De ruglengte is ${rug}, dus het shirt kan wat korter vallen.`,
      langBroek: m => `Je bent lang voor maat ${m}. De bretels kunnen wat strakker aanvoelen.`,
      buitenTabel: m => `Maat ${m} staat nog niet in onze officiële maattabel; dit advies is een schatting.`,
      schaalSchatting: 'Het pijltje is onze schatting, de streep erboven de onzekerheid.',
      schaalMeting: 'Het pijltje is je meting, de streep erboven de onzekerheid.',
      vergelijk: k => `Vergelijk met je eigen ${k}`,
      vergelijkUitleg: (k, m) => `Leg je best passende ${k} plat op tafel en meet na. Zo valt maat ${m}:`,
      geschat: l => `Geschatte ${l}`, gemeten: l => `Gemeten ${l}`,
      plat: {
        borstbreedte: 'Borstbreedte', lengteAchter: 'Lengte achter', lengteVoor: 'Lengte voor', taille: 'Taille',
        heupbreedte: 'Heupbreedte', binnenbeen: 'Binnenbeenlengte', lengteBretels: 'Lengte vanaf bretels', bretels: 'Bretels',
      },
      meetNodigTitel: 'Eén meting geeft uitsluitsel',
      meetNodig: wat => `Bij je ${wat} zit je tussen twee maten. Pak een meetlint en vul de maat hieronder in.`,
      en: ' en ',
      meetOptieTitel: 'Wil je het zeker weten?', meetOptie: 'Met een meetlint wordt het advies nauwkeuriger. Dit hoeft niet.',
      borst: 'Borstomtrek', heup: 'Heupomtrek',
      meetBorst: 'Meet rond het breedste deel van je borst, net onder je oksels.',
      meetHeup: 'Meet rond het breedste deel van je heupen en billen.',
      meetAlgemeen: 'Houd het lint horizontaal en trek het niet strak aan.',
      hoeMeten: wat => `Hoe meet je je ${wat}?`,
      uitkomst: (k, m) => `${k}: maat ${m}`,
      foutMeting: (wat, a, b) => `Controleer je ${wat}: we verwachten een waarde tussen ${a} en ${b} cm.`,
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
      pasTitel: 'How do you prefer to wear your cycling clothing?', pasLead: 'This tips the balance when you are between two sizes.',
      strak: 'Tight', strakSub: 'Like a second skin', normaal: 'Regular', normaalSub: 'Close-fitting without pinching',
      ruim: 'Loose', ruimSub: 'Rather a bit looser',
      resTitel: 'Your size', wijzig: 'Change',
      kleding: { shirt: 'Jersey', broek: 'Bib shorts' }, kledingKlein: { shirt: 'jersey', broek: 'bib shorts' },
      lichaam: { shirt: 'chest', broek: 'hips' },
      past: m => `Size ${m} fits best`, grens: (a, b) => `Between ${a} and ${b}`,
      ruimer: (m, b) => `We recommend ${m}. If you prefer a looser fit, ${b} works too.`,
      strakker: (m, b) => `We recommend ${m}. If you prefer a tighter fit, ${b} works too.`,
      langKeuze: (m, b, verschil) => `Because you are tall, we recommend the larger of the two. Size ${m} is longer${verschil}. If you prefer a tighter fit, ${b} works too.`,
      langVerschil: (lang, kort) => `: ${lang} versus ${kort}, measured from the straps`,
      teKlein: 'Possibly smaller than our smallest size', teGroot: 'Possibly larger than our largest size',
      contactHulp: 'Get in touch and we will help you choose.',
      langShirt: (m, rug) => `You are tall for size ${m}. The back length is ${rug}, so the jersey may sit a little shorter.`,
      langBroek: m => `You are tall for size ${m}. The straps may feel a little tighter.`,
      buitenTabel: m => `Size ${m} is not in our official size chart yet; this advice is an estimate.`,
      schaalSchatting: 'The arrow is our estimate, the line above it the uncertainty.',
      schaalMeting: 'The arrow is your measurement, the line above it the uncertainty.',
      vergelijk: k => `Compare with your own ${k}`,
      vergelijkUitleg: (k, m) => `Lay your best-fitting ${k} flat on a table and measure. This is how size ${m} measures:`,
      geschat: l => `Estimated ${l}`, gemeten: l => `Measured ${l}`,
      plat: {
        borstbreedte: 'Chest width', lengteAchter: 'Back length', lengteVoor: 'Front length', taille: 'Waist',
        heupbreedte: 'Hip width', binnenbeen: 'Inseam', lengteBretels: 'Length from straps', bretels: 'Straps',
      },
      meetNodigTitel: 'One measurement settles it',
      meetNodig: wat => `For your ${wat} you are between two sizes. Grab a tape measure and enter the measurement below.`,
      en: ' and ',
      meetOptieTitel: 'Want to be sure?', meetOptie: 'A tape measure makes the advice more accurate. This is optional.',
      borst: 'Chest', heup: 'Hips',
      meetBorst: 'Measure around the fullest part of your chest, just under your armpits.',
      meetHeup: 'Measure around the fullest part of your hips and buttocks.',
      meetAlgemeen: "Keep the tape horizontal and don't pull it tight.",
      hoeMeten: wat => `How do you measure your ${wat}?`,
      uitkomst: (k, m) => `${k}: size ${m}`,
      foutMeting: (wat, a, b) => `Please check your ${wat}: we expect a value between ${a} and ${b} cm.`,
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
  const meetbeeld = naam => beeld("meten-" + naam, 360, 600);
  const ALLE_BEELDEN = ["bovenlichaam-smal", "bovenlichaam-gemiddeld", "bovenlichaam-breed", "buik-vlak", "buik-gemiddeld", "buik-rond",
    "pasvorm-strak", "pasvorm-normaal", "pasvorm-ruim", "meten-borst", "meten-heup"];

  const ICOON = {
    shirt: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icoon" d="M18 6 Q24 12 30 6 L42 12 L45 24 L37 26 L36 20 L36 42 L12 42 L12 20 L11 26 L3 24 L6 12 Z"/></svg>',
    broek: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icoon" d="M17 4 L19 15 L29 15 L31 4 M13 17 L35 17 L38 44 L27 44 L24 28 L21 44 L10 44 Z"/></svg>',
    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><rect x="9" y="8.5" width="2" height="6.5" rx="1" fill="#fff"/><circle cx="10" cy="5.6" r="1.25" fill="#fff"/></svg>',
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
.terug svg, .info svg { display: block; width: 100%; height: 100%; }
.staplabel { font-size: 14px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.chip { margin-left: auto; font-size: 13px; font-weight: 500; color: var(--ink); background: var(--accent-zacht); border-radius: 99px; padding: 3px 12px; white-space: nowrap; }
.voortgang { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0 28px; }
.voortgang span { height: 4px; border-radius: 2px; background: var(--line); transition: background-color .3s; }
.voortgang span.vol { background: var(--zwart); }

.stap { outline: none; }
@media (prefers-reduced-motion: no-preference) {
  .stap { animation: in .28s ease-out both; }
  .maat { animation: pop .4s cubic-bezier(.2, .9, .3, 1.2) .08s both; }
  .schaal .stip, .schaal .band { animation: schuif .5s ease-out .15s both; }
  .keuze, .knop, .info, .terug { transition: border-color .15s, background-color .15s, transform .15s, box-shadow .15s; }
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
  position: relative; display: block; width: 100%; margin: 0; padding: 12px 6px 14px; text-align: center; cursor: pointer;
  border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: inherit;
}
.keuze:hover { border-color: var(--ink); transform: translateY(-2px); box-shadow: 0 8px 18px -12px rgba(27, 38, 41, .5); }
.keuze img { display: block; width: 100%; height: auto; max-height: 200px; object-fit: contain; margin: 0 auto; mix-blend-mode: multiply; }
.keuze b { display: block; margin-top: 6px; font-weight: 600; font-size: 17px; }
.keuze small { display: block; color: var(--muted); font-size: 13px; line-height: 1.3; margin-top: 2px; }
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

.schaal { position: relative; margin: 4px 0 6px; padding-top: 24px; }
.schaal .vakken { display: flex; height: 38px; border-radius: var(--r); overflow: hidden; border: 1.5px solid var(--line); }
.schaal .vak { display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; color: var(--muted); border-right: 1.5px solid var(--line); min-width: 0; }
.schaal .vak:last-child { border-right: 0; }
.schaal .vak.aan { background: var(--zwart); color: #fff; }
.schaal .band { position: absolute; top: 4px; height: 5px; background: var(--accent); opacity: .45; border-radius: 3px; }
.schaal .stip { position: absolute; top: 11px; width: 0; height: 0; margin-left: -8px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 11px solid var(--accent); }
.schaal-uitleg { font-size: 13px; color: var(--muted); margin: 0; }

details { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; }
summary { cursor: pointer; font-weight: 600; font-size: 15px; padding: 4px 0; }
details p { font-size: 14px; color: var(--muted); margin: 8px 0 0; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 10px 0 4px; font-size: 15px; }
dt { color: var(--muted); } dd { margin: 0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

.meten { border: 1.5px solid var(--line); border-radius: 8px; padding: 18px; margin-bottom: 20px; background: var(--bg); }
.meten.nodig { border-color: var(--let-op); background: var(--let-op-zacht); }
.meten h3 { margin: 0 0 4px; font: 700 22px/1.2 var(--kop); }
.meten > div > p { margin: 0 0 14px; font-size: 15px; }
.meetrijen { display: grid; gap: 14px; }
@media (min-width: 680px) { .meetrijen { grid-template-columns: 1fr 1fr; } }
.meetrij { display: grid; grid-template-columns: 62px 1fr; gap: 12px; align-items: center; }
.meetrij > img { width: 62px; height: auto; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r); padding: 3px; }
.meetlabel { position: relative; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.meetlabel label { font-weight: 600; font-size: 15px; }
.info { width: 32px; height: 32px; padding: 6px; margin: -6px 0; border: 0; background: none; color: var(--ink); cursor: pointer; border-radius: 50%; }
.info:hover, .info[aria-expanded="true"] { color: var(--accent); }
.meetrij .invoer input { height: 52px; font-size: 22px; }
.uitkomst { font-weight: 700; margin-top: 6px; font-size: 15px; }
.uitkomst:empty { display: none; }
.wolk {
  position: absolute; z-index: 5; bottom: calc(100% + 8px); left: 0; width: 210px; padding: 12px; text-align: left;
  background: var(--bg); color: var(--ink); border: 1.5px solid var(--ink); border-radius: 8px; box-shadow: 0 14px 30px -14px rgba(27, 38, 41, .6);
  font-size: 14px; line-height: 1.4;
}
.wolk[hidden] { display: none; }
.wolk img { display: block; width: 140px; height: auto; margin: 0 auto 8px; }
.wolk p { margin: 0; }
.wolk p + p { margin-top: 6px; color: var(--muted); }

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
    const staat = { stap: 0, lengte: null, gewicht: null, bouw: null, buik: null, pas: null, borst: null, heup: null };

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
        { waarde: 'strak', naam: t.strak, sub: t.strakSub, tekening: figuur("pasvorm-strak") },
        { waarde: 'normaal', naam: t.normaal, sub: t.normaalSub, tekening: figuur("pasvorm-normaal") },
        { waarde: 'ruim', naam: t.ruim, sub: t.ruimSub, tekening: figuur("pasvorm-ruim") },
      ]);
    }

    function schaal(tabel, r) {
      const g = tabel.grenzen;
      const van = Math.max(0, r.index - 1), tot = Math.min(MATEN.length - 1, r.index + 1);
      const start = g[van], breed = g[tot + 1] - start;
      const pos = v => Math.max(0, Math.min(100, (v - start) / breed * 100));
      let vakken = '';
      for (let i = van; i <= tot; i++) vakken += `<div class="vak ${i === r.index ? 'aan' : ''}" style="flex:${g[i + 1] - g[i]}">${MATEN[i]}</div>`;
      const links = pos(r.plek - r.spreiding), rechts = pos(r.plek + r.spreiding);
      return `<div class="schaal">
          <div class="vakken">${vakken}</div>
          <div class="band" style="left:${links}%;width:${rechts - links}%"></div>
          <div class="stip" style="left:${pos(r.plek)}%"></div>
        </div>
        <p class="schaal-uitleg">${r.gemeten ? t.schaalMeting : t.schaalSchatting}</p>`;
    }

    function kaart(tabel, r) {
      const k = tabel.sleutel;
      let oordeel, uitleg = '';
      if (r.teKlein) { oordeel = t.teKlein; uitleg = t.contactHulp; }
      else if (r.teGroot) { oordeel = t.teGroot; uitleg = t.contactHulp; }
      else if (r.buur && r.langKeuze) {
        // Lang en tussen twee broekmaten: de grootste van de twee, met de lengte erbij als die echt verschilt.
        const lengtes = BROEK.plat[2][1], iKlein = MATEN.indexOf(r.buur);
        oordeel = t.grens(r.buur, r.maat);
        uitleg = t.langKeuze(r.maat, r.buur, lengtes[r.index] > lengtes[iKlein] ? t.langVerschil(cm(lengtes[r.index]), cm(lengtes[iKlein])) : '');
      } else if (r.buur) {
        oordeel = r.buurGroter ? t.grens(r.maat, r.buur) : t.grens(r.buur, r.maat);
        uitleg = r.buurGroter ? t.ruimer(r.maat, r.buur) : t.strakker(r.maat, r.buur);
      } else {
        oordeel = t.past(r.maat);
      }
      const notities = [];
      if (staat.lengte >= 190 && r.index <= 3) notities.push(k === 'shirt' ? t.langShirt(r.maat, cm(SHIRT.plat[1][1][r.index])) : t.langBroek(r.maat));
      if (r.buitenTabel) notities.push(t.buitenTabel(r.maat));
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
              <dt>${(r.gemeten ? t.gemeten : t.geschat)(t.lichaam[k])}</dt><dd>${cm(Math.round(r.omvang))}</dd>
            </dl>
          </details>
        </div>`;
    }

    /* Ververst alleen de advieskaarten en de kop van het meetblok, zodat de invoervelden hun focus houden. */
    function werkResultaatBij() {
      const r = maatAdvies(staat);
      const twijfel = [];
      if (r.shirt.buur && !r.shirt.gemeten) twijfel.push(t.kledingKlein.shirt);
      if (r.broek.buur && !r.broek.gemeten) twijfel.push(t.kledingKlein.broek);
      $('.kaarten').innerHTML = kaart(SHIRT, r.shirt) + kaart(BROEK, r.broek);
      $('.meten').classList.toggle('nodig', twijfel.length > 0);
      $('.meetkop').innerHTML = twijfel.length
        ? `<h3>${t.meetNodigTitel}</h3><p>${t.meetNodig(twijfel.join(t.en))}</p>`
        : `<h3>${t.meetOptieTitel}</h3><p>${t.meetOptie}</p>`;
      $('#mw-uit-borst').textContent = r.shirt.gemeten ? t.uitkomst(t.kleding.shirt, r.shirt.maat) : '';
      $('#mw-uit-heup').textContent = r.broek.gemeten ? t.uitkomst(t.kleding.broek, r.broek.maat) : '';
    }

    function meetrij(veld, uitleg) {
      return `<div class="meetrij">
          ${meetbeeld(veld)}
          <div>
            <div class="meetlabel">
              <label for="mw-${veld}">${t[veld]}</label>
              <button class="info" type="button" aria-expanded="false" aria-controls="mw-wolk-${veld}" aria-label="${t.hoeMeten(t[veld].toLowerCase())}">${ICOON.info}</button>
              <div class="wolk" id="mw-wolk-${veld}" role="tooltip" hidden>${meetbeeld(veld)}<p>${uitleg}</p><p>${t.meetAlgemeen}</p></div>
            </div>
            <div class="invoer"><input id="mw-${veld}" type="text" inputmode="decimal" autocomplete="off" value="${staat[veld] ?? ''}"><span class="eenheid">cm</span></div>
            <div class="uitkomst" id="mw-uit-${veld}" aria-live="polite"></div>
          </div>
        </div>`;
    }

    function toonResultaat() {
      const delen = [`${staat.lengte} cm`, `${staat.gewicht.toLocaleString(t.locale)} kg`, t[staat.bouw], t[staat.buik], t[staat.pas]];
      toneel.innerHTML = `<div class="stap" tabindex="-1">
        <h2 class="titel">${t.resTitel}</h2>
        <div class="samenvatting">${delen.map(d => `<span>${d}</span>`).join('')}<button type="button" class="wijzig">${t.wijzig}</button></div>
        <div class="kaarten"></div>
        <div class="meten">
          <div class="meetkop"></div>
          <div class="meetrijen">${meetrij('borst', t.meetBorst)}${meetrij('heup', t.meetHeup)}</div>
          <p class="fout" role="alert"></p>
        </div>
        <div class="acties">
          <a class="knop" href="${t.collectieUrl}">${t.collectie}</a>
          <button class="knop rustig" type="button" id="mw-opnieuw">${t.opnieuw}</button>
        </div>
        <p class="extra">${t.onderzoek} <a href="${t.onderzoekUrl}">${t.onderzoekLink}</a>.</p>
        <p class="voet">${t.voet} <a href="${t.voetUrl}">${t.voetLink}</a>${t.voetNa}</p>
      </div>`;
      werkResultaatBij();

      ['borst', 'heup'].forEach(veld => {
        const el = $('#mw-' + veld);
        el.addEventListener('change', () => {
          const v = getal(el.value), fout = $('.meten .fout');
          fout.textContent = '';
          if (el.value.trim() === '') staat[veld] = null;
          else if (!binnen(v, LIMIET[veld])) { staat[veld] = null; fout.textContent = t.foutMeting(t[veld].toLowerCase(), LIMIET[veld][0], LIMIET[veld][1]); }
          else staat[veld] = v;
          werkResultaatBij();
        });
      });

      // i-knoppen: open bij aanwijzen met de muis, en bij klik of tik blijft het wolkje staan tot je ergens anders klikt.
      root.querySelectorAll('.info').forEach(knop => {
        const wolk = root.getElementById(knop.getAttribute('aria-controls'));
        let vast = false;
        const zet = open => {
          wolk.hidden = !open;
          knop.setAttribute('aria-expanded', open);
          if (open) {
            // Binnen het kader houden: schuif naar links als het wolkje rechts zou uitsteken.
            wolk.style.left = '0px';
            const over = wolk.getBoundingClientRect().right - $('.kader').getBoundingClientRect().right + 12;
            if (over > 0) wolk.style.left = -over + 'px';
          }
        };
        knop.addEventListener('click', e => { e.stopPropagation(); vast = wolk.hidden ? true : !vast; zet(vast); });
        knop.addEventListener('mouseenter', () => { if (!vast) zet(true); });
        knop.addEventListener('mouseleave', () => { if (!vast) zet(false); });
        knop.addEventListener('keydown', e => { if (e.key === 'Escape') { vast = false; zet(false); } });
        root.addEventListener('click', e => { if (vast && !wolk.contains(e.target)) { vast = false; zet(false); } });
      });

      $('.wijzig').addEventListener('click', () => ga(0));
      $('#mw-opnieuw').addEventListener('click', () => {
        Object.assign(staat, { lengte: null, gewicht: null, bouw: null, buik: null, pas: null, borst: null, heup: null });
        ga(0);
      });
    }

    terug.addEventListener('click', () => ga(staat.stap - 1));
    toon();
    setTimeout(() => ALLE_BEELDEN.forEach(naam => { new Image().src = BEELD + naam + '.webp'; }), 300);
  }

  function start() { document.querySelectorAll('.c36-maatwijzer').forEach(bouwOp); }
  window.c36Maatwijzer = { advies: maatAdvies, start: start, versie: '0.3' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  start();
})();
