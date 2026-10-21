// Complianz (cookiebalk + cookiebeleid) tweetalig maken.
//   node scripts/complianz-en.mjs pages    → NL-pagina netjes (/nl/cookiebeleid/), EN-kopie /en/cookie-policy/ + WPML-koppeling
//   node scripts/complianz-en.mjs strings  → Engelse teksten van de cookiebalk (vereist c36/v1/string-translation)
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const STATE = new URL("../state.json", import.meta.url);
const call = async (method, path, body) => {
  const r = await fetch(W + path, { method, headers: H, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};

const EN = {
  accept: "Accept",
  accept_informational: "Accept",
  dismiss: "Decline",
  view_preferences: "Preferences",
  save_preferences: "Save preferences",
  revoke: "Manage consent",
  header: "Manage consent",
  message_optin: "<p>We use cookies to improve our website and show you relevant ads.</p>",
  category_functional: "Functional",
  category_prefs: "Preferences",
  category_stats: "Statistics",
  category_all: "Marketing",
  functional_text: "The technical storage or access is strictly necessary for the legitimate purpose of enabling the use of a specific service explicitly requested by the subscriber or user, or for the sole purpose of carrying out the transmission of a communication over an electronic communications network.",
  preferences_text: "The technical storage or access is necessary for the legitimate purpose of storing preferences that are not requested by the subscriber or user.",
  statistics_text: "The technical storage or access that is used exclusively for statistical purposes.",
  statistics_text_anonymous: "The technical storage or access that is used exclusively for anonymous statistical purposes. Without a subpoena, voluntary compliance on the part of your Internet Service Provider, or additional records from a third party, information stored or retrieved for this purpose alone cannot usually be used to identify you.",
  marketing_text: "The technical storage or access is required to create user profiles to send advertising, or to track the user on a website or across several websites for similar marketing purposes.",
  blocked_content_text: "Click to accept {category} cookies and enable this content",
  "cmplz_link_title_cookie-statement": "Cookie policy",
};

const mode = process.argv[2];
if (mode === "pages") {
  const [nl] = await call("GET", "/wp/v2/pages?slug=cookiebeleid-eu,cookiebeleid&lang=nl&context=edit&_fields=id,slug,content,title");
  if (!nl) throw new Error("NL-cookiebeleid niet gevonden");
  const meta = (t, d) => ({ _yoast_wpseo_title: t + cfg.seoTitleSuffix, _yoast_wpseo_metadesc: d });
  await call("POST", `/wp/v2/pages/${nl.id}?lang=nl`, {
    title: "Cookiebeleid", slug: "cookiebeleid",
    meta: meta("Cookiebeleid", "Welke cookies 36 Cycling gebruikt, waarvoor, en hoe je je toestemming beheert of intrekt."),
  });
  const state = JSON.parse(await readFile(STATE, "utf8"));
  const enBody = { title: "Cookie policy", slug: "cookie-policy", content: nl.content.raw, status: "publish",
    meta: meta("Cookie policy", "Which cookies 36 Cycling uses, what for, and how to manage or withdraw your consent.") };
  const en = await call("POST", state["cookiebeleid-en"] ? `/wp/v2/pages/${state["cookiebeleid-en"].id}?lang=en` : "/wp/v2/pages?lang=en", enBody);
  const link = await call("POST", "/c36/v1/link", { element_type: "post_page", source_id: nl.id, translation_id: en.id, lang: "en", source_lang: "nl" });
  state.cookiebeleid = { id: nl.id };
  state["cookiebeleid-en"] = { id: en.id, link: en.link };
  await writeFile(STATE, JSON.stringify(state, null, 2));
  console.log(`NL ${nl.id} → /nl/cookiebeleid/ | EN ${en.id} ${en.status} ${en.link}\nWPML:`, JSON.stringify(link.translations));
} else if (mode === "strings") {
  console.log(await call("POST", "/c36/v1/string-translation", { context: "complianz", lang: "en", strings: EN }));
} else {
  console.log("Gebruik: node scripts/complianz-en.mjs pages|strings");
}
