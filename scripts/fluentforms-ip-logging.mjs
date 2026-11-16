// Fluent Forms: het bewaren van IP-adressen bij inzendingen uit- of aanzetten (Algemene instellingen → Diversen; geldt voor ALLE formulieren).
//   node scripts/fluentforms-ip-logging.mjs          → toont de huidige stand (wijzigt niets)
//   node scripts/fluentforms-ip-logging.mjs --uit    → IP-adressen niet meer bewaren (back-up van de instellingen in backups/)
//   node scripts/fluentforms-ip-logging.mjs --aan    → weer bewaren
// LET OP (16 nov 2026): de server (Cloud86) weigert elke POST naar fluentform/v1/global-settings met 403, ook een lege.
// --uit/--aan werken daardoor niet; de instelling moet in het beheer worden gezet. Lezen (zonder optie) werkt wel: gebruik dit om te controleren.
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const F = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json/fluentform/v1";
const KEY = "_fluentform_global_form_settings";
const VLAG = "isIpLogingDisabled"; // zo gespeld in Fluent Forms

async function lees() {
  const r = await fetch(`${F}/global-settings?key=${KEY}`, { headers: AUTH });
  if (!r.ok) throw new Error(`lezen mislukt: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const s = j[KEY];
  if (!s || typeof s !== "object" || !s.misc) throw new Error("onverwachte opbouw van de instellingen: " + JSON.stringify(j).slice(0, 300));
  return s;
}
const toon = (s) => console.log(`IP-adressen bewaren: ${s.misc[VLAG] ? "UIT" : "AAN"} | overige onderdelen: ${Object.keys(s).join(", ")} | misc: ${Object.keys(s.misc).join(", ")}`);

const huidig = await lees();
toon(huidig);
const wil = process.argv.includes("--uit") ? true : process.argv.includes("--aan") ? false : null;
if (wil !== null && !(VLAG in huidig.misc)) throw new Error(`instelling ${VLAG} niet gevonden; niets gewijzigd`);
if (wil !== null && huidig.misc[VLAG] === wil) console.log("Staat al goed; niets gewijzigd.");
else if (wil !== null) await wijzig();

async function wijzig() {
  await writeFile(new URL(`../backups/fluentform-global-settings-${Date.now()}.json`, import.meta.url), JSON.stringify(huidig, null, 2));
  const nieuw = { ...huidig, misc: { ...huidig.misc, [VLAG]: wil } };
  const r = await fetch(`${F}/global-settings`, {
    method: "POST", headers: { ...AUTH, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: "SaveGlobalLayoutSettings", form_settings: JSON.stringify(nieuw) }),
  });
  console.log("opslaan:", r.status, (await r.text()).slice(0, 200));

  // Teruglezen en vergelijken: alleen de ene vlag mag anders zijn.
  const na = await lees();
  toon(na);
  const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const verschillen = [];
  for (const k of new Set([...Object.keys(huidig), ...Object.keys(na)])) {
    if (k === "misc") { for (const m of new Set([...Object.keys(huidig.misc), ...Object.keys(na.misc)])) if (!zelfde(huidig.misc[m], na.misc[m])) verschillen.push("misc." + m); }
    else if (!zelfde(huidig[k], na[k])) verschillen.push(k);
  }
  console.log("gewijzigde instellingen:", verschillen.join(", ") || "geen");
}
