// Maatonderzoek: maakt de 6 lichaamstekeningen (zelfde vormen als in de maatwijzer) als PNG in media/maatwijzer/ (via Edge, zonder venster).
//   node scripts/maatonderzoek-tekeningen.mjs   → daarna uploadt build-maatonderzoek.mjs ze (eenmalig; zie state.json → maatonderzoek.media)
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = fileURLToPath(new URL("../media/maatwijzer/", import.meta.url));
const INK = "#1b2629", FILL = "#e3e7df";

function voor(s, w) {
  const c = 50;
  const d = ["M44 24 L56 24", `L${c + s} 31`, `Q${c + s + 7} 34 ${c + s + 8} 46`, `L${c + s + 9} 74 L${c + s + 3} 74`,
    `L${c + s} 48`, `L${c + w} 106 L${c - w} 106`, `L${c - s} 48`, `L${c - s - 3} 74 L${c - s - 9} 74`,
    `L${c - s - 8} 46`, `Q${c - s - 7} 34 ${c - s} 31`, "Z"].join(" ");
  return `<circle class="l" cx="50" cy="13" r="9"/><path class="l" d="${d}"/>`;
}
function zij(b) {
  const d = `M45 24 Q34 28 33 46 Q33 76 37 106 L60 106 Q${b + 1} 97 ${b} 82 Q${b} 64 65 52 Q67 40 62 32 Q59 26 55 24 Z`;
  return `<circle class="l" cx="50" cy="13" r="9"/><path class="l" d="${d}"/><path class="a" d="M47 36 Q42 56 49 78"/>`;
}
const TEKENINGEN = {
  "maatwijzer-bovenlichaam-smal": voor(19, 16),
  "maatwijzer-bovenlichaam-gemiddeld": voor(24, 19),
  "maatwijzer-bovenlichaam-breed": voor(30, 21),
  "maatwijzer-buik-vlak": zij(61),
  "maatwijzer-buik-gemiddeld": zij(68),
  "maatwijzer-buik-rond": zij(79),
};
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
if (!edge) throw new Error("Edge niet gevonden");
await mkdir(dir, { recursive: true });
const W = 360, H = 400;
for (const [naam, inhoud] of Object.entries(TEKENINGEN)) {
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff;overflow:hidden}svg{display:block;width:${W}px;height:${H}px}
.l{fill:${FILL};stroke:${INK};stroke-width:1.6;stroke-linejoin:round}.a{fill:none;stroke:${INK};stroke-width:1.6;stroke-linecap:round}</style>
<svg viewBox="-5 -3 110 118" xmlns="http://www.w3.org/2000/svg">${inhoud}</svg>`;
  const bron = dir + naam + ".html";
  await writeFile(bron, html);
  execFileSync(edge, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${dir}${naam}.png`, pathToFileURL(bron).href], { stdio: "ignore" });
  console.log(naam, existsSync(`${dir}${naam}.png`) ? "ok" : "MISLUKT");
}
