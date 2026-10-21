// Vult lege alt="" in op door de gebruiker gebouwde pagina's (chirurgisch: alleen
// lege alt-attributen van bekende afbeeldingen) + mediabibliotheek, en maakt de
// titelkop van Over 36 een H1 (zoals op Contact/Offerte).
import { loadConfig, setMediaAlt } from "../lib/wp.mjs";

const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const API = cfg.wp.baseUrl + "/wp-json/wp/v2";

const ALT = {
  "customer-stedin": "Stedin", "customer-dhl": "DHL", "customer-karcher": "Kärcher", "customer-quooker": "Quooker",
  "customer-als": "Stichting ALS Nederland", "customer-bicycling": "Bicycling", "customer-ahoy": "Rotterdam Ahoy",
  "customer-schaatsbaan": "Schaatsbaan Rotterdam", "customer-rpo": "Rotterdams Philharmonisch Orkest",
  "homepage-events": "Groep wielrenners in custom wielershirts tijdens een fietsevent in de bergen",
  "dexter3": "Twee wielrenners in paarse custom wielershirts met lange mouwen",
  "homepage-sports": "Hardloopsters in custom hardloopshirts tijdens een marathon",
  "ontwerp-je-wielershirt": "Wielershirt ontwerpen in de 3D-ontwerptool van 36 Cycling",
  "paris-hp-info": "Opbouw van de Paris HP zeem voor wielerbroeken",
  "dolomiti-cesen-info": "Dolomiti zeem voor wielerbroeken",
  "Force-info": "Opbouw van de Force zeem voor wielerbroeken",
  "over36-teamwear": "Wielerteam in custom teamkleding op een grindweg",
  "5stars-geel-fietskleding": "Vijf sterren klantbeoordeling",
  "klantfoto-FTVV": "Wielrenners van FTVV in custom teamkleding",
  "klantfoto-JoostPetit": "Fietsgroep in custom teamkleding op een dijkweg",
  "klantfoto-DeRijke": "Wielrenners in custom teamkleding van De Rijke",
  "teamkleding-sport": "Nederlands team in oranje custom sportkleding op een podium",
  "sportkleding-testimonial1": "Team in oranje custom sportkleding in een sporthal",
  "sportkleding-testimonial2": "Hardloopster in een custom singlet tijdens een wedstrijd",
  "coppi36-1": "Fausto Coppi met rugnummer 36",
  "Speedonwheels": "Wielrenner in zwarte Speed on Wheels-wielerkleding",
  "bib-zwart-langemouw-purple1": "Wielrenner in zwarte wielerbroek en paars shirt met lange mouwen",
};
// Bestandsnaam → sleutel (zonder extensie en zonder -1024x683-achtige maat).
const keyOf = (src) => (src.split("/").pop() || "").replace(/\.\w+$/, "").replace(/-\d+x\d+$/, "");

const mediaIds = new Map();
for (const id of [2, 6280, 6430, 939, 6346]) {
  const p = await (await fetch(`${API}/pages/${id}?context=edit`, { headers: AUTH })).json();
  let raw = p.content.raw, n = 0;
  raw = raw.replace(/<img[^>]*>/g, (tag) => {
    const src = (tag.match(/src="([^"]+)"/) || [])[1] || "";
    const alt = ALT[keyOf(src)];
    const mid = (tag.match(/wp-image-(\d+)/) || [])[1];
    if (alt && mid) mediaIds.set(mid, alt);
    if (alt && /alt=""/.test(tag)) { n++; return tag.replace('alt=""', `alt="${alt.replace(/"/g, "&quot;")}"`); }
    return tag;
  });
  let h1 = "";
  if (id === 939) {
    // Greenshift-titelkop → H1, net als op Contact/Offerte.
    raw = raw.replace(/(<!-- wp:greenshift-blocks\/heading \{"id":"gsbp-759f98d",)(?!"headingTag")/, '$1"headingTag":"h1",')
      .replace(/<h2( id="gspb_heading-id-gsbp-759f98d"[^>]*>[\s\S]*?)<\/h2>/, "<h1$1</h1>");
    h1 = /<h1 id="gspb_heading-id-gsbp-759f98d"/.test(raw) ? " | titelkop → H1" : " | H1 niet gevonden";
  }
  if (raw === p.content.raw) { console.log(`— #${id} ${p.slug}: niets te wijzigen`); continue; }
  const r = await fetch(`${API}/pages/${id}`, { method: "POST", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ content: raw }) });
  console.log(`✓ #${id} ${p.slug}: ${n} alt-teksten${h1} (HTTP ${r.status}, status ${(await r.json()).status})`);
}
let m = 0;
for (const [id, alt] of mediaIds) {
  const cur = await (await fetch(`${API}/media/${id}?context=edit&_fields=alt_text`, { headers: AUTH })).json();
  if (!cur.alt_text) { await setMediaAlt(cfg, id, alt); m++; }
}
console.log(`✓ mediabibliotheek: ${m} alt-teksten ingevuld`);
