// Zet de maatwijzer in het hoofdmenu: Shop → Heren en Shop → Dames, telkens na Fietsjacks (NL-menu 28),
// en Shop → Men / Women, after Cycling jackets (EN-menu 225). Heren sinds 16 nov 2026, dames sinds 17 nov 2026 (v0.11).
// Het nieuwe item neemt de Blocksy-opmaak over van het item waar het achter komt.
// Onder Dames is het een eigen link met #dames (Engels: #ladies) achter het adres: de maatwijzer (vanaf v0.12) opent
// dan met Dames gekozen (18 nov 2026). Onder Heren is het de gewone paginalink.
// Opnieuw draaien is veilig: staat het item er op die plek al, dan gebeurt er niets (of alleen de link wordt bijgewerkt).
//   node scripts/menu-maatwijzer.mjs          → proef: laat zien wat er zou gebeuren
//   node scripts/menu-maatwijzer.mjs --apply  → voert door (back-up van het menu in backups/)
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2";
const state = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));
const wacht = (ms) => new Promise((k) => setTimeout(k, ms));
async function call(method, path, body) {
  const r = await fetch(W + path, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error(`${method} ${path} → ${r.status}: geen JSON (${t.slice(0, 80).replace(/\s+/g, " ")})`); }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

// na = het menu-item waar de maatwijzer direct achter komt (zelfde ouder).
const MENUS = [
  { lang: "nl", menu: 28, na: 5628, titel: "Maatwijzer", pagina: state["maatwijzer-nl"].id },
  { lang: "nl", menu: 28, na: 5620, titel: "Maatwijzer", pagina: state["maatwijzer-nl"].id, anker: "#dames" },
  { lang: "en", menu: 225, na: 7896, titel: "Size finder", pagina: state["maatwijzer-en"].id },
  { lang: "en", menu: 225, na: 7904, titel: "Size finder", pagina: state["maatwijzer-en"].id, anker: "#ladies" },
];
for (const m of MENUS) {
  const items = await call("GET", `/menu-items?menus=${m.menu}&per_page=100&context=edit&lang=${m.lang}`);
  const anker = items.find((i) => i.id === m.na);
  if (!anker) throw new Error(`${m.lang}: menu-item #${m.na} niet gevonden`);
  // Met een anker (#dames) is het een eigen link naar het adres van de pagina; anders de gewone paginalink.
  const adres = m.anker ? (await call("GET", `/pages/${m.pagina}?_fields=link`)).link + m.anker : null;
  const link = adres ? { type: "custom", object: "custom", url: adres } : { type: "post_type", object: "page", object_id: m.pagina };
  const basis = adres ? adres.split("#")[0] : null;
  const bestaand = items.find((i) => i.parent === anker.parent && ((i.object === "page" && i.object_id === m.pagina) || (basis && i.type === "custom" && i.url.split("#")[0] === basis)));
  if (bestaand) {
    const goed = adres ? bestaand.type === "custom" && bestaand.url === adres : bestaand.object === "page";
    if (goed) { console.log(`${m.lang}: staat al in het menu onder #${anker.parent}${adres ? " → " + adres : ""}`); continue; }
    console.log(`${m.lang}: menu-item #${bestaand.id} onder #${anker.parent} krijgt de link ${adres || "naar pagina " + m.pagina}`);
    if (!APPLY) continue;
    await writeFile(new URL(`../backups/menu-${m.menu}-before-maatwijzer-${Date.now()}.json`, import.meta.url), JSON.stringify(items, null, 2));
    const bij = await call("POST", `/menu-items/${bestaand.id}?lang=${m.lang}`, link);
    console.log(`${m.lang}: menu-item #${bij.id} bijgewerkt → ${bij.type} ${bij.url} (titel "${bij.title.rendered}", plek ${bij.menu_order}, ouder #${bij.parent})`);
    continue;
  }
  // Het item komt na het anker én na alles wat onder het anker hangt.
  const onder = (id) => items.filter((i) => i.parent === id).flatMap((i) => [i, ...onder(i.id)]);
  const plek = Math.max(anker.menu_order, ...onder(anker.id).map((i) => i.menu_order)) + 1;
  const schuiven = items.filter((i) => i.menu_order >= plek).sort((a, b) => b.menu_order - a.menu_order);
  console.log(`${m.lang}: "${m.titel}" komt op plek ${plek}, onder ouder #${anker.parent}, na "${anker.title.raw || anker.title.rendered}"; ${schuiven.length} items schuiven één plek op`);
  if (!APPLY) continue;
  await writeFile(new URL(`../backups/menu-${m.menu}-before-maatwijzer-${Date.now()}.json`, import.meta.url), JSON.stringify(items, null, 2));
  for (const i of schuiven) { await call("POST", `/menu-items/${i.id}?lang=${m.lang}`, { menu_order: i.menu_order + 1 }); await wacht(120); }
  const nieuw = await call("POST", `/menu-items?lang=${m.lang}`, {
    title: m.titel, menus: m.menu, parent: anker.parent, menu_order: plek, ...link, status: "publish",
  });
  console.log(`${m.lang}: menu-item #${nieuw.id} aangemaakt → ${nieuw.url}`);
  const meta = await fetch(W.replace("/wp/v2", "/c36/v1") + "/copy-meta", { method: "POST", headers: H, body: JSON.stringify({ from: anker.id, to: nieuw.id }) });
  console.log(`${m.lang}: Blocksy-opmaak overgenomen van #${anker.id}: ${meta.status} ${JSON.stringify((await meta.json()).copied || [])}`);
  // Controle: volgorde zonder dubbele plekken, en de buren van het nieuwe item.
  const na = (await call("GET", `/menu-items?menus=${m.menu}&per_page=100&context=edit&lang=${m.lang}`)).sort((a, b) => a.menu_order - b.menu_order);
  const dubbel = na.filter((i, n) => n && i.menu_order === na[n - 1].menu_order).length;
  const pos = na.findIndex((i) => i.id === nieuw.id);
  console.log(`${m.lang}: ${na.length} items, dubbele plekken: ${dubbel}, buren: "${na[pos - 1]?.title.rendered}" ← "${na[pos].title.rendered}" → "${na[pos + 1]?.title.rendered}"`);
}
