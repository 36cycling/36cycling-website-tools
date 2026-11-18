// Yoast-titel/-omschrijving/-focus van de belangrijkste shopcategorieën (NL + EN), afgestemd op de zoektermen
// uit Search Console (18 nov 2026: "fietsshirt heren", "wielershirt heren", "wielerkleding heren", "fietsshirt dames" …
// stonden op plek 15–20 met algemene titels zonder "wieler…"). Alleen Yoast-velden; categorienaam en tekst blijven gelijk.
//   node scripts/category-seo-titels.mjs [--dry]
import { loadConfig } from "../lib/wp.mjs";
const DRY = process.argv.includes("--dry");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const S = " | 36 Cycling";
const CATS = [
  { nl: 41, en: 141,
    NL: ["Wielerkleding en fietskleding voor dames en heren", "Wielerkleding en fietskleding voor dames en heren van 36 Cycling: wielershirts, fietsbroeken, jacks en accessoires uit onze eigen collectie.", "wielerkleding"],
    EN: ["Cycling clothing for women and men", "Cycling clothing for women and men by 36 Cycling: cycling jerseys, bib shorts, jackets and accessories from our own collection.", "cycling clothing"] },
  { nl: 42, en: 144,
    NL: ["Wielerkleding heren: shirts, broeken en jacks", "Wielerkleding en fietskleding voor heren van 36 Cycling: wielershirts, fietsbroeken, jacks en accessoires uit onze eigen collectie.", "wielerkleding heren"],
    EN: ["Men's cycling clothing: jerseys, shorts and jackets", "Men's cycling clothing by 36 Cycling: cycling jerseys, bib shorts, jackets and accessories from our own collection.", "men's cycling clothing"] },
  { nl: 67, en: 157,
    NL: ["Wielershirts en fietsshirts heren", "Wielershirts en fietsshirts voor heren van 36 Cycling, met korte en lange mouwen. Ademende stoffen en een goede pasvorm voor elke rit.", "wielershirts heren"],
    EN: ["Men's cycling jerseys, short and long sleeve", "Men's cycling jerseys by 36 Cycling, with short and long sleeves. Breathable fabrics and a good fit for every ride.", "men's cycling jerseys"] },
  { nl: 43, en: 151,
    NL: ["Wielerbroeken en fietsbroeken heren", "Wielerbroeken en fietsbroeken voor heren van 36 Cycling: korte en lange broeken, voor comfort op elke rit.", "wielerbroek heren"],
    EN: ["Men's cycling shorts and bib shorts", "Men's cycling shorts and bib shorts by 36 Cycling: short and long, for comfort on every ride.", "men's bib shorts"] },
  { nl: 82, en: 143,
    NL: ["Wielerkleding dames: shirts, broeken en jacks", "Wielerkleding en fietskleding voor dames van 36 Cycling: wielershirts, fietsbroeken en jacks met een damespasvorm.", "wielerkleding dames"],
    EN: ["Women's cycling clothing: jerseys, shorts and jackets", "Women's cycling clothing by 36 Cycling: cycling jerseys, bib shorts and jackets with a women's fit.", "women's cycling clothing"] },
  { nl: 86, en: 156,
    NL: ["Wielershirts en fietsshirts dames", "Wielershirts en fietsshirts voor dames van 36 Cycling, met korte en lange mouwen. Ademende stoffen en een damespasvorm voor elke rit.", "fietsshirt dames"],
    EN: ["Women's cycling jerseys, short and long sleeve", "Women's cycling jerseys by 36 Cycling, with short and long sleeves. Breathable fabrics and a women's fit for every ride.", "women's cycling jerseys"] },
  { nl: 83, en: 152,
    NL: ["Wielerbroeken en fietsbroeken dames", "Wielerbroeken en fietsbroeken voor dames van 36 Cycling: korte en lange broeken met een damespasvorm, voor comfort op elke rit.", "fietsbroek dames"],
    EN: ["Women's cycling shorts and bib shorts", "Women's cycling shorts and bib shorts by 36 Cycling: short and long, with a women's fit, for comfort on every ride.", "women's cycling shorts"] },
];
for (const c of CATS) for (const lang of ["nl", "en"]) {
  const [title, metadesc, focuskw] = c[lang.toUpperCase()];
  const body = { taxonomy: "product_cat", term_id: c[lang], title: title + S, metadesc, focuskw };
  if (DRY) { console.log(lang, c[lang], (title + S).length, metadesc.length, title); continue; }
  const r = await fetch(`${W}/c36/v1/term-seo?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  console.log(r.ok ? "✓" : "✗ " + r.status, lang, c[lang], title, r.ok ? "" : (await r.text()).slice(0, 200));
}
