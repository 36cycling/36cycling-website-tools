// Footer NL (Blocksy contentblok 216): het Blocksy-blok "Contactgegevens" (toont op de site zijn kleuren niet → donkere
// tekst op zwart) vervangen door twee gewone regels in het tekstblok erboven (zelfde opmaak als de footerlinks).
// Daarna EN via: node scripts/translate-en.mjs apply 216  (+ vertaling in cblock-216.todo.en.txt)
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const url = `${cfg.wp.baseUrl}/wp-json/wp/v2/ct_content_block/216`;
const cur = await (await fetch(`${url}?context=edit&_fields=content`, { headers: H })).json();
let c = cur.content.raw;
if (!c.includes("wp:blocksy/contact-info")) { console.log("Contactblok is al weg — niets te doen."); process.exit(0); }
await writeFile(new URL(`../backups/ct_content_block-216-${Date.now()}.json`, import.meta.url), JSON.stringify(cur, null, 2));

const u = (hex) => String.fromCharCode(92) + "u" + hex;
const esc = (s) => s.replace(/</g, u("003c")).replace(/>/g, u("003e")).replace(/"/g, u("0022"));
const add = '<br><strong>Telefoon:</strong> <a href="tel:+31182232008">0182 - 232 008</a><br><strong>E-mail:</strong> <a href="mailto:info@36cycling.com">info@36cycling.com</a>';

// 1. Het Blocksy widgets-wrapper-blok met het contactblok erin verwijderen.
const ws = c.indexOf("<!-- wp:blocksy/widgets-wrapper");
const ciAt = c.indexOf("<!-- wp:blocksy/contact-info", ws);
const weTag = "<!-- /wp:blocksy/widgets-wrapper -->";
const we = c.indexOf(weTag, ciAt);
if (ws < 0 || ciAt < 0 || we < 0) throw new Error("Structuur onverwacht");
const before = c.slice(0, ws).replace(/\s+$/, "");
c = before + "\n\n" + c.slice(we + weTag.length).replace(/^\s+/, "");

// 2. De twee regels toevoegen aan het tekstblok vlak vóór het contactblok (attribuut + HTML).
const tStart = c.lastIndexOf("<!-- wp:greenshift-blocks/text", ws);
const tCommentEnd = c.indexOf("-->", tStart);
const tClose = c.indexOf("<!-- /wp:greenshift-blocks/text -->", tStart);
let comment = c.slice(tStart, tCommentEnd);
const anchorAttr = esc('Cookiebeleid</a><br>');
if (comment.split(anchorAttr).length !== 2) throw new Error("Attribuut-anker niet (uniek) gevonden");
comment = comment.replace(anchorAttr, anchorAttr + esc(add));
let html = c.slice(tCommentEnd, tClose);
const anchorHtml = 'Cookiebeleid</a><br>';
if (html.split(anchorHtml).length !== 2) throw new Error("HTML-anker niet (uniek) gevonden");
html = html.replace(anchorHtml, anchorHtml + add);
c = c.slice(0, tStart) + comment + html + c.slice(tClose);

const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ content: c }) });
const now = (await (await fetch(`${url}?context=edit&_fields=content`, { headers: H })).json()).content.raw;
console.log(r.ok ? "Footer NL bijgewerkt" : `Fout ${r.status}`, "| contactblok weg:", !now.includes("blocksy/contact-info"),
  "| tel-links (attribuut+HTML):", now.split("tel:+31182232008").length - 1);
