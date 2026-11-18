// /nl/promotions/ en /en/promotions/ — promotionele producten (hoodies, polo's, t-shirts, petten, tassen).
// Teruggezet op 18 nov 2026: de pagina was bij de migratie niet overgezet (tekst uit het webarchief, juli 2026).
// Nieuwe pagina's worden als CONCEPT aangemaakt; een bestaande pagina blijft ongemoeid (Jeroen maakt zelf op).
//   node scripts/build-promotions.mjs
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";

const OLD = "https://oud.36cycling.com";
const ROOT = new URL("..", import.meta.url);
const STATE = new URL("state.json", ROOT);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(STATE, "utf8"));
const { heading, paragraph, list, image, buttons, column, columns, breadcrumbs } = blocks;
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const wp = async (method, path, body) => {
  const r = await fetch(cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json" + path, { method, headers: AUTH, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};

const hero = await ensureMedia(cfg, map, { src: `${OLD}/media/dohltwwu/header-promotional2.jpg`, alt: "Man in een zwarte hoodie en vrouw in zwarte wielerkleding, beide met een geel bedrukt logo", updateAlt: true });
const pakket = await ensureMedia(cfg, map, { src: `${OLD}/media/n44cwptx/promotions-pakket-ahoy.jpg`, alt: "Promotiepakket met paraplu, pet, handdoek, polo en korte broek met het logo van Rotterdam Ahoy", updateAlt: true });

const PAGES = {
  nl: {
    title: "Promotionele producten", slug: "promotions",
    seoTitle: "Promotiekleding bedrukken, promotionele producten",
    metadesc: "Promotionele kleding, zoals hoodies, t-shirts, bedrukte poloshirts en andere artikelen",
    focus: "promotiekleding bedrukken",
    content: [
      breadcrumbs(),
      heading("Promotionele producten", 1, { size: "x-large" }),
      image(hero),
      heading("Een breder aanbod", 2),
      paragraph("Je kent ons waarschijnlijk van onze wieler- en sportkleding. Al meer dan 10 jaar staan we voor kwaliteit, maatwerk en creatieve oplossingen voor bedrijven, clubs en teams. Maar we doen meer dan dat."),
      paragraph("Door onze jarenlange ervaring met evenementen, bedrijven en organisaties weten we als geen ander hoe je je merk kunt promoten. Dat vertalen we graag naar een breed aanbod."),
      heading("Dezelfde aandacht en creativiteit", 2),
      columns([
        column([
          paragraph("Naast onze wieler- en sportkleding maken we casual sportkleding en promotionele producten in jullie eigen huisstijl. Denk aan:"),
          list(["hoodies en sweaters", "polo's en t-shirts", "petten", "tassen", "en veel meer, zoals paraplu's en handdoeken"]),
          paragraph("Met dezelfde service, aandacht en creatief meedenken als je van ons gewend bent. Of het nu gaat om sportoutfits of bedrijfskleding, giveaways of teamwear: we denken met dezelfde toewijding met je mee."),
        ].join("\n\n")),
        column(image(pakket)),
      ]),
      heading("Meer weten?", 2),
      paragraph("Ben je benieuwd wat we voor je kunnen doen? We denken graag met je mee. We kunnen je idee snel visualiseren en tot leven brengen. Neem vrijblijvend contact op."),
      paragraph('Op zoek naar sportkleding of wielerkleding in eigen ontwerp? Lees meer over <a href="/nl/sportkleding-bedrukken/">sportkleding bedrukken</a> en <a href="/nl/wielerkleding-bedrukken/">wielerkleding bedrukken</a>.'),
      buttons([{ text: "Neem contact op", href: "/nl/contact/" }, { text: "Offerte aanvragen", href: "/nl/offerteaanvraag/" }]),
    ],
  },
  en: {
    title: "Promotional products", slug: "promotions",
    seoTitle: "Custom promotional clothing, promotional products",
    metadesc: "Promotional clothing, such as hoodies, T-shirts, printed polo shirts and other items",
    focus: "promotional clothing",
    content: [
      breadcrumbs(),
      heading("Promotional products", 1, { size: "x-large" }),
      image(hero),
      heading("A wider range", 2),
      paragraph("You probably know us for our cycling clothing and sportswear. For more than 10 years we have stood for quality, customisation and creative solutions for companies, clubs and teams. But we do more than that."),
      paragraph("Thanks to our many years of experience with events, companies and organisations, we know better than anyone how to promote your brand. We are happy to translate that into a wide range of products."),
      heading("The same attention and creativity", 2),
      columns([
        column([
          paragraph("Besides our cycling clothing and sportswear, we make casual sportswear and promotional products in your own corporate identity. Think of:"),
          list(["hoodies and sweaters", "polos and T-shirts", "caps", "bags", "and much more, such as umbrellas and towels"]),
          paragraph("With the same service, attention and creative input you are used to from us. Whether it is sports outfits or company clothing, giveaways or teamwear: we think along with you with the same dedication."),
        ].join("\n\n")),
        column(image(pakket)),
      ]),
      heading("Want to know more?", 2),
      paragraph("Curious what we can do for you? We are happy to think along with you. We can quickly visualise your idea and bring it to life. Feel free to get in touch."),
      paragraph('Looking for sportswear or cycling clothing in your own design? Read more about <a href="/en/custom-sportwear/">custom sportswear</a> and <a href="/en/custom-cycling-clothing/">custom cycling clothing</a>.'),
      buttons([{ text: "Contact us", href: "/en/contact/" }, { text: "Request a quote", href: "/en/request-a-quote/" }]),
    ],
  },
};

const ids = {};
for (const [lang, p] of Object.entries(PAGES)) {
  const key = `promotions-${lang}`;
  if (state[key]?.id) { ids[lang] = state[key].id; console.log(`pagina ${lang}: #${state[key].id} bestaat al, inhoud blijft ongemoeid`); continue; }
  const res = await upsertPage(cfg, {
    title: p.title, slug: p.slug, lang, status: "draft", content: p.content.join("\n\n"),
    meta: { _yoast_wpseo_title: p.seoTitle, _yoast_wpseo_metadesc: p.metadesc, _yoast_wpseo_focuskw: p.focus },
  });
  ids[lang] = res.id;
  state[key] = { id: res.id, link: res.link };
  await writeFile(STATE, JSON.stringify(state, null, 2));
  console.log(`pagina ${lang}: #${res.id} ${res.status} slug ${res.slug}`);
}
const vert = await wp("GET", `/c36/v1/translations?element_type=post_page&id=${ids.nl}`);
if (vert.translations?.en?.element_id !== ids.en) {
  await wp("POST", "/c36/v1/link", { element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" });
  console.log("NL- en EN-pagina gekoppeld in WPML");
}
console.log(JSON.stringify(ids));
