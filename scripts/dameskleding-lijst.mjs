// Lijst van klanten die dameskleding kochten (eigen shop + klantenshops), voor een vraag over de maatvoering.
// Bronnen (beide in private/, niet in Git):
//   private/36cycling-orders-2019-2026.json            eigen shop 36Cycling (export 21 okt 2026)
//   private/klantenshops-dameskleding-2022-2026.json   klantenshops, alleen regels met dameskleding (export 17 nov 2026)
// Uitvoer: private/dameskleding-klanten.csv (puntkomma, UTF-8 met BOM; geschikt voor Excel en LaPosta-import)
// Gebruik: node scripts/dameskleding-lijst.mjs [--from=2022-01-01]
import { readFile, writeFile } from "node:fs/promises";

const P = (f) => new URL("../" + f, import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const FROM = args.from || "2022-01-01";

const isWomenName = (n) => /dame|lad(y|ies)|wom[ae]n/i.test(n) && !/unisex/i.test(n);
const skipAccessory = /mondkap|sok|sock|bidon|cap\b|pet\b|handschoen|glove|warmer|buff|tas\b|bag\b|muts/i;
const size = (v) => {
  const m = String(v || "").match(/(?:maat|size)[^:]*:+\s*([^,]+)/i);
  return m ? m[1].trim() : "";
};

const people = new Map();
const add = (r) => {
  const email = String(r.email || "").trim().toLowerCase();
  if (!email.includes("@") || /@(36cycling\.com|rondevanrotterdam\.nl)$/.test(email)) return; // eigen adressen (bestellingen namens klanten) niet
  const p = people.get(email) || { email, voornaam: "", achternaam: "", taal: "", bronnen: new Set(), producten: new Set(), laatste: "" };
  if (r.date >= p.laatste) {
    p.laatste = r.date;
    p.voornaam = r.firstname || p.voornaam;
    p.achternaam = r.lastname || p.achternaam;
    p.taal = r.language || p.taal;
  }
  p.bronnen.add(r.shop);
  p.producten.add(r.product.replace(/\s*\(\d+\)$/, "") + (size(r.variant) ? ` (${size(r.variant)})` : ""));
  people.set(email, p);
};

// Eigen shop
const own = JSON.parse(await readFile(P("private/36cycling-orders-2019-2026.json"), "utf8"));
let ownLines = 0;
for (const o of own.orders) {
  if (!["Shipped", "Processing", "Paid"].includes((o.orderStatus || [])[0])) continue;
  if ((o.orderDate || "") < FROM) continue;
  for (const l of o.lines) {
    const t = `${l.name || ""} | ${l.variant || ""}`;
    if (!isWomenName(t) || skipAccessory.test(t)) continue;
    ownLines++;
    add({ email: o.eMail, firstname: o.firstname, lastname: o.lastname, language: o.language, date: o.orderDate.slice(0, 10), shop: "36Cycling", product: l.name, variant: l.variant });
  }
}

// Klantenshops (export bevat al alleen dameskleding)
const ks = JSON.parse(await readFile(P("private/klantenshops-dameskleding-2022-2026.json"), "utf8"));
let ksLines = 0;
for (const r of ks.rows) {
  if (/^test$/i.test(r.webshop || "")) continue;
  if ((r.orderDate || "") < FROM) continue;
  ksLines++;
  add({ email: r.email, firstname: r.firstname, lastname: r.lastname, language: r.language, date: String(r.orderDate).slice(0, 10), shop: r.webshop, product: r.product, variant: r.variant });
}

const esc = (v) => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = [...people.values()].sort((a, b) => b.laatste.localeCompare(a.laatste));
const header = ["email", "voornaam", "achternaam", "taal", "webshop", "laatste_bestelling", "dameskleding"];
const csv = [header.join(";"), ...rows.map((p) => [p.email, p.voornaam, p.achternaam, p.taal || "nl", [...p.bronnen].join(", "), p.laatste, [...p.producten].join(" / ")].map(esc).join(";"))].join("\r\n");
await writeFile(P("private/dameskleding-klanten.csv"), "﻿" + csv, "utf8");

const both = rows.filter((p) => p.bronnen.has("36Cycling") && p.bronnen.size > 1).length;
const perYear = {};
for (const p of rows) perYear[p.laatste.slice(0, 4)] = (perYear[p.laatste.slice(0, 4)] || 0) + 1;
console.log(`Vanaf ${FROM}: eigen shop ${ownLines} regels, klantenshops ${ksLines} regels`);
console.log(`Unieke adressen: ${rows.length} (eigen shop ${rows.filter((p) => p.bronnen.has("36Cycling")).length}, beide ${both})`);
console.log("Laatste bestelling per jaar:", perYear);
console.log("Taal:", rows.reduce((a, p) => ((a[p.taal || "nl"] = (a[p.taal || "nl"] || 0) + 1), a), {}));
console.log("Geschreven: private/dameskleding-klanten.csv");
