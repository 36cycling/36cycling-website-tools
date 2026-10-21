// Publiceert Engelse vertalingen: pagina's/berichten → publish; producten → zelfde status als het NL-origineel.
import { loadConfig } from "../lib/wp.mjs";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const count = {};
const bump = (k) => (count[k] = (count[k] || 0) + 1);
for (const type of ["pages", "posts"]) {
  for (let p = 1; p < 5; p++) {
    const j = await (await fetch(`${W}/wp/v2/${type}?lang=en&status=draft&per_page=100&page=${p}&_fields=id,slug`, { headers: H })).json();
    if (!Array.isArray(j) || !j.length) break;
    for (const x of j) {
      const r = await fetch(`${W}/wp/v2/${type}/${x.id}`, { method: "POST", headers: H, body: JSON.stringify({ status: "publish" }) });
      bump(`${type} ${r.ok ? "gepubliceerd" : "FOUT " + r.status}`);
    }
  }
}
const all = [];
for (const lang of ["nl", "en"]) for (let p = 1; p < 6; p++) { const j = await (await fetch(`${W}/wc/v3/products?per_page=100&page=${p}&status=any&lang=${lang}`, { headers: H })).json(); if (!Array.isArray(j) || !j.length) break; all.push(...j.filter((x) => !all.some((y) => y.id === x.id))); }
const byId = Object.fromEntries(all.map((x) => [x.id, x]));
let i = 0; const nl = all.filter((x) => x.lang === "nl");
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < nl.length) {
    const p = nl[i++]; const en = byId[+p.translations?.en];
    if (!en) { bump("product zonder EN"); continue; }
    if (en.status === p.status) { bump(`product al ${p.status}`); continue; }
    const r = await fetch(`${W}/wc/v3/products/${en.id}`, { method: "PUT", headers: H, body: JSON.stringify({ status: p.status }) });
    bump(`product → ${p.status}${r.ok ? "" : " FOUT " + r.status}`);
  }
}));
console.log(count);
