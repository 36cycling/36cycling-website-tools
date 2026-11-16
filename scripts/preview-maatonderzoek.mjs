// Proefweergave van de conceptpagina's van het maatonderzoek, zonder in te loggen in de browser:
// neemt de openbare contactpagina (thema + formulieropmaak) en zet daar de weergegeven inhoud van het concept in.
// Alleen om de indeling te bekijken; voorwaardelijke velden en versturen werken hier niet.
//   node scripts/preview-maatonderzoek.mjs <uitvoermap>
import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { loadConfig } from "../lib/wp.mjs";

const uit = process.argv[2];
if (!uit) throw new Error("Geef een uitvoermap op");
const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const BASE = cfg.wp.baseUrl.replace(/\/$/, "");
const state = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));

for (const [lang, schil] of [["nl", "/nl/contact/"], ["en", "/en/contact/"]]) {
  const id = state[`maatonderzoek-${lang}`].id;
  const page = await (await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?context=edit&lang=${lang}`, { headers: AUTH })).json();
  const html = await (await fetch(BASE + schil + "?nocache=" + Date.now())).text();
  const $ = load(html);
  $("head").prepend(`<base href="${BASE}/">`);
  $(".entry-content").first().html(page.content.rendered);
  $(".cmplz-cookiebanner, #cmplz-cookiebanner-container").remove();
  await writeFile(`${uit}/_proef-${lang}.html`, $.html());
  const c = load(page.content.rendered);
  console.log(lang, page.status, "| velden:", c("form [name]").length, "| plaatjes:", c("form img").length, "| knop:", c("form button[type=submit]").text().trim());
}
