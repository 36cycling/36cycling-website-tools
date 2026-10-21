// Corrigeert dubbele/foute producttitels en vult ontbrekende meta-descriptions (Yoast) via WC REST.
// Meta's alleen invullen als het veld nu leeg is.
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3/products";
const SOW = "uit de Speed on Wheels-collectie van 36 Cycling en Niki Terpstra";

// Titel die niet bij het product hoorde (het andere product van het paar houdt z'n titel).
const TITLES = {
  5542: "Speed on Wheels T-shirt wit",
  5540: "Speed on Wheels hoodie wit",
  5514: "Speed on Wheels hoodie zwart",
  5511: "Speed on Wheels sokken Aero zwart",
  5366: "Teenwarmers neopreen, zwart",
  5197: "Fiets zonnebril - NEBULA, transparant",
  5185: "Wielersokken Dry Knit 22 cm hoog, wit",
  5019: "Lange dames fietsbroek zonder zeem, zwart",
  4990: "Fietsbroek dames EcoRACER, zwart",
};

const METAS = {
  5542: `Wit T-shirt van Speed on Wheels, ${SOW}. Bestel het Speed on Wheels T-shirt eenvoudig online.`,
  5541: `Zwart T-shirt van Speed on Wheels, ${SOW}. Bestel het Speed on Wheels T-shirt eenvoudig online.`,
  5540: `Lekker warme hoodie in de stijl van Speed on Wheels, in het wit. ${SOW.charAt(0).toUpperCase() + SOW.slice(1)}.`,
  5514: `Lekker warme hoodie in de stijl van Speed on Wheels, in het zwart. ${SOW.charAt(0).toUpperCase() + SOW.slice(1)}.`,
  5513: `Speed on Wheels sokken: De Snelste Sok ter wereld. ${SOW.charAt(0).toUpperCase() + SOW.slice(1)}.`,
  5512: `Witte Aero fietssokken van Speed on Wheels, ${SOW}. Bestel ze eenvoudig online.`,
  5511: `Zwarte Aero fietssokken van Speed on Wheels, ${SOW}. Bestel ze eenvoudig online.`,
  5510: "Witte fietssokken van Speed on Wheels, gemaakt van ademende, vochtafvoerende stof die je voeten droog en koel houdt tijdens elke rit.",
  5483: "Zwarte fietssokken van Speed on Wheels, gemaakt van ademend en vochtafvoerend materiaal, zodat je voeten koel en droog blijven tijdens elke rit.",
  5482: "De zwarte wielerbroek van Speed on Wheels is gemaakt van duurzame Endurance-stof, voor optimale compressie en spierondersteuning op lange ritten.",
  5481: "Het zwarte jack van Speed on Wheels combineert stijl en functionaliteit: hoogwaardig, waterafstotend materiaal dat je beschermt tegen regen.",
  5480: "Het witte jack van Speed on Wheels brengt zichtbaarheid en functionaliteit samen: lichtgewicht, waterafstotend en ademend materiaal.",
  5453: "Vertegenwoordig je Nederland op het WK gravel? Speed on Wheels heeft een ultralicht, oranje wielershirt ontwikkeld om in aan de start te verschijnen.",
  5452: "Het Speed on Wheels Elite wielershirt in wit/oranje is samen met Niki Terpstra ontworpen: een aero shirt met een uiterst comfortabele pasvorm.",
  5451: "Het Speed on Wheels Elite wielershirt in zwart is ontwikkeld voor de ambitieuze wielrenner, met een strakke Shape-Fit pasvorm: licht en comfortabel.",
  5450: "Het Speed on Wheels Elite wielershirt in wit is samen met Niki Terpstra ontworpen: aero reliëf op de mouwen, gel gripper en drie achterzakken.",
  5401: "Retro wielerpet met een knipoog naar het Euromast Team uit de jaren '60. De koerspet is een stijlicoon in de wielersport, nu in het grijs.",
  5392: "Running jacket voor dames van 36 Cycling in zwart/blauw. Bekijk de maattabel en bestel het jacket eenvoudig online.",
  5391: "Wintermuts van Super Roubaix-stof voor koude dagen. De bovenkant sluit met een koord, zodat je de muts ook om de hals kunt dragen.",
  5216: "Witte fietssokken Band van 36 Cycling. Maak je wieleroutfit compleet en bestel de sokken eenvoudig online.",
  4964: "Het Pro All Season Jack in camo is een groot deel van het jaar te dragen: zacht, ademend en elastisch 4-way stretch materiaal met gevoerde binnenkant.",
};

const ids = [...new Set([...Object.keys(TITLES), ...Object.keys(METAS)])];
const backup = {};
for (const id of ids) {
  const p = await (await fetch(`${B}/${id}`, { headers: AUTH })).json();
  const cur = Object.fromEntries((p.meta_data || []).map((m) => [m.key, m.value]));
  backup[id] = { name: p.name, title: cur._yoast_wpseo_title ?? null, metadesc: cur._yoast_wpseo_metadesc ?? null };
  await writeFile(new URL("../audit/backup-products-seo.json", import.meta.url), JSON.stringify(backup, null, 2));
  const meta = [];
  if (TITLES[id]) meta.push({ key: "_yoast_wpseo_title", value: TITLES[id] });
  if (METAS[id] && !cur._yoast_wpseo_metadesc) meta.push({ key: "_yoast_wpseo_metadesc", value: METAS[id] });
  if (!meta.length) { console.log(`— #${id} ${p.name}: niets te doen`); continue; }
  const r = await fetch(`${B}/${id}`, { method: "PUT", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ meta_data: meta }) });
  const j = await r.json();
  const after = Object.fromEntries((j.meta_data || []).map((m) => [m.key, m.value]));
  console.log(`${r.ok ? "✓" : "✗"} #${id} ${p.name}${TITLES[id] ? ` | titel → "${after._yoast_wpseo_title}"` : ""}${METAS[id] ? ` | meta (${(after._yoast_wpseo_metadesc || "").length})` : ""}`);
}
