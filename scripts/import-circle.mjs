// Importeert Circle-leden (CSV-exports uit Umbraco Members / Forms én LaPosta) in FluentCRM.
// Gebruik: node scripts/import-circle.mjs <bestand.csv> [<bestand2.csv> …] [--go]
// Zonder --go: proefdraai (alleen tellen en tonen, niets wegschrijven).
// Leden komen op status "subscribed" in lijst "36 Cycling Circle" met tag "Import Umbraco" — geen bevestigingsmail.
// Bestaande contacten worden niet overschreven, alleen aan de lijst/tag toegevoegd.
// Afmeldingen: een statuskolom (LaPosta: afgemeld/unsubscribed, ongeldig/cleaned/bounced) of een bestandsnaam met
// "afgemeld"/"unsub" maakt het contact "unsubscribed"/"bounced". Afmelding wint altijd van een aanmelding elders.
// Afgemelde leden blijven wél in de Circle-lijst (korting), ze krijgen alleen geen mail meer.
import { readFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const args = process.argv.slice(2);
const GO = args.includes("--go");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) { console.error("Geef een of meer CSV-bestanden op."); process.exit(1); }

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const F = cfg.wp.baseUrl + "/wp-json/fluent-crm/v2";
const LIST = "36-cycling-circle", TAG = "import-umbraco";

// Eenvoudige CSV-parser (quotes, ; of , als scheidingsteken).
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Kolommen herkennen op naam.
const pick = (head, re) => head.findIndex((h) => re.test(h.trim()));
const contacts = new Map();
const RANK = { subscribed: 0, unsubscribed: 1, bounced: 2 };
for (const file of files) {
  const rows = parseCsv(await readFile(file, "utf8"));
  const head = rows.shift().map((h) => h.toLowerCase());
  const iMail = pick(head, /e-?mail/), iStatus = pick(head, /^status$|^state$/), iFirst = pick(head, /voornaam|first/), iLast = pick(head, /achternaam|last|surname/), iName = pick(head, /^(naam|name)$/);
  if (iMail < 0) { console.error(`${file}: geen e-mailkolom gevonden in [${head.join(", ")}]`); process.exit(1); }
  const fileUnsub = /afgemeld|unsub|uitgeschreven/i.test(file);
  console.log(`${file}: ${rows.length} rijen — e-mail="${head[iMail]}", voornaam="${head[iFirst] ?? "-"}", achternaam="${head[iLast] ?? head[iName] ?? "-"}", status="${head[iStatus] ?? (fileUnsub ? "(alles afgemeld)" : "-")}"`);
  for (const r of rows) {
    const email = (r[iMail] || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    let first = iFirst >= 0 ? r[iFirst]?.trim() : "", last = iLast >= 0 ? r[iLast]?.trim() : "";
    if (!first && !last && iName >= 0) [first, ...last] = (r[iName] || "").trim().split(/\s+/), last = last.join(" ");
    const st = (iStatus >= 0 ? r[iStatus] || "" : "").toLowerCase();
    const status = /ongeldig|cleaned|bounce/.test(st) ? "bounced" : fileUnsub || /afgemeld|unsub|uitgeschreven|verwijderd/.test(st) ? "unsubscribed" : "subscribed";
    const prev = contacts.get(email) || {};
    contacts.set(email, { email, first_name: prev.first_name || first || "", last_name: prev.last_name || last || "", status: RANK[status] > RANK[prev.status || "subscribed"] ? status : prev.status || "subscribed" });
  }
}
const per = [...contacts.values()].reduce((m, c) => (m[c.status] = (m[c.status] || 0) + 1, m), {});
console.log(`Uniek, geldig e-mailadres: ${contacts.size}`, per);
if (!GO) { console.log("Proefdraai — voorbeeld:", [...contacts.values()].slice(0, 3)); console.log("Draai opnieuw met --go om te importeren."); process.exit(0); }

const ids = async (path, slug) => {
  const j = await (await fetch(`${F}/${path}?search=${slug}`, { headers: H })).json();
  const arr = j.lists || j.tags?.data || [];
  const hit = arr.find((x) => x.slug === slug);
  if (!hit) throw new Error(`${path} "${slug}" niet gevonden`);
  return hit.id;
};
const listId = await ids("lists", LIST), tagId = await ids("tags", TAG);

let nieuw = 0, bestond = 0, fout = 0, klaar = 0;
const todo = [...contacts.values()];
async function one(c) {
  const found = await (await fetch(`${F}/subscribers?search=${encodeURIComponent(c.email)}`, { headers: H })).json();
  const ex = (found.subscribers?.data || []).find((s) => s.email.toLowerCase() === c.email);
  const r = ex
    ? await fetch(`${F}/subscribers/sync-segments`, { method: "PUT", headers: H, body: JSON.stringify({ subscribers: [ex.id], action_type: "add", attach: { lists: [listId], tags: [tagId] } }) })
    : await fetch(`${F}/subscribers`, { method: "POST", headers: H, body: JSON.stringify({ ...c, lists: [listId], tags: [tagId] }) });
  if (r.ok && ex && c.status !== "subscribed" && ex.status !== c.status) {
    const u = await fetch(`${F}/subscribers/${ex.id}`, { method: "PUT", headers: H, body: JSON.stringify({ subscriber: { status: c.status } }) });
    if (!u.ok) console.log(`✗ status ${c.email}: ${u.status}`);
  }
  if (!r.ok) { fout++; console.log(`✗ ${c.email}: ${r.status} ${(await r.text()).slice(0, 150)}`); }
  else ex ? bestond++ : nieuw++;
  if (++klaar % 250 === 0) console.log(`… ${klaar}/${todo.length}`);
}
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (next < todo.length) await one(todo[next++]); }));
console.log(`Klaar: ${nieuw} nieuw, ${bestond} bestonden al (aan lijst toegevoegd), ${fout} fouten.`);
