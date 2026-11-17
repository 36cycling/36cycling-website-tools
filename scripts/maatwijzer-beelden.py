# Maatwijzer/maatonderzoek: snijdt de vier gegenereerde drieluiken (Gemini "nano banana", 16 nov 2026) tot 12 losse
# afbeeldingen van gelijke maat. Binnen een reeks houden de figuren dezelfde schaal, zodat smal/gemiddeld/breed eerlijk
# naast elkaar staan. Een bijschrift dat het model onder een figuur zette, wordt weggelaten.
#   python scripts/maatwijzer-beelden.py          (alles)   of   python scripts/maatwijzer-beelden.py dames
# Bron: media/maatwijzer/bron/*.jpg   Uitvoer: media/maatwijzer/ai/*.webp (wit als achtergrond)
#
# ZO ZIJN DE BRONNEN GEMAAKT (MCP mcp-image, provider gemini, per reeks één afbeelding met drie figuren naast elkaar):
# - Formaat 21:9 voor bovenlichaam, buik en pasvorm; 16:9 voor meten (hele figuren).
# - Vaste stijlzin in elke prompt: "faceless male mannequin ... pure white background ... three equal columns with clear white
#   space between them and white space above every head ... only the outer contour is drawn, as one clean uniform dark charcoal
#   line (#1b2629) of constant medium thickness ... filled with one single flat very light warm grey ... no facial features,
#   no hair, no clothing, no muscle lines, no shading, no gradients, no shadows, no ground line ... The image contains absolutely
#   no text: no words, no captions, no letters, no labels, no numbers, no arrows."
# - bovenlichaam: bustes van voren, recht afgesneden op de heup. Het verschil kwam pas duidelijk door types te beschrijven:
#   "a very thin, lanky marathon runner type" / "an ordinary man of average build" / "a big, broad-shouldered rugby player type
#   with a very wide barrel chest ... not fat, no belly". Alleen "slim/average/broad" gaf bijna drie dezelfde figuren, en die
#   woorden kwamen als bijschrift in beeld.
# - buik: zelfde bustes "seen exactly from the side, in profile, all facing to the right"; "completely flat belly" /
#   "slightly rounded belly" / "clearly round belly that sticks out well beyond the chest".
# - pasvorm: de gemiddelde figuur drie keer, met "a plain solid dark charcoal short-sleeve cycling jersey": "skin-tight like a
#   second skin" / "regular fit, sitting close to the body with a little room" / "clearly loose, noticeably wider than the body".
# - meten: hele figuur van voren, drie keer, met "exactly one bright turquoise (#00c3d1) measuring tape wrapped horizontally
#   around the body": borst "just under the armpits" / taille "at navel height" / heup "at the widest part of the buttocks".
# - Voor dezelfde stijl in een volgende reeks: een eerdere reeks meegeven als voorbeeld (inputImagePaths) met de zin
#   "Use the attached image only as the style reference". Afgekeurde proeven staan in media/maatwijzer/bron/proeven/.
import os
import sys
from PIL import Image

HIER = os.path.dirname(os.path.abspath(__file__))
BRON = os.path.join(HIER, "..", "media", "maatwijzer", "bron")
UIT = os.path.join(HIER, "..", "media", "maatwijzer", "ai")
os.makedirs(UIT, exist_ok=True)

REEKSEN = [
    # bronbestand, namen (links, midden, rechts), tegelbreedte, tegelhoogte, marge
    ("bovenlichaam.jpg", ["bovenlichaam-smal", "bovenlichaam-gemiddeld", "bovenlichaam-breed"], 480, 540, 26),
    ("buik.jpg", ["buik-vlak", "buik-gemiddeld", "buik-rond"], 480, 540, 26),
    ("pasvorm.jpg", ["pasvorm-strak", "pasvorm-normaal", "pasvorm-ruim"], 480, 540, 26),
    # Pasvoorkeur sinds v0.9 (Race / Strak / Normaal; niemand koos "ruim"). Prompt: dezelfde figuur drie keer met een donker
    # wielershirt: "race-fit aero jersey, painted-on tight, long tight sleeves almost to the elbow" / "tight cycling jersey that
    # follows the body contour" / "regular club-fit jersey, still sporty and fitted, a little room around the waist, NOT a baggy T-shirt".
    ("pas.jpg", ["pas-race", "pas-strak", "pas-normaal"], 480, 540, 26),
    ("meten.jpg", ["meten-borst", "meten-taille", "meten-heup"], 360, 600, 22),
    # Dames (17 nov 2026), voor de dameskeuze in de maatwijzer. Gemaakt met de herenreeks als stijlvoorbeeld
    # ("Use the attached image only as the style reference ... three faceless FEMALE mannequins ... clearly a woman by
    # silhouette only: narrower shoulders, a gentle modest bust contour, a defined waist and slightly wider hips").
    # Bovenlichaam: "very slender, petite long-distance runner type" / "ordinary woman of average build" / "strong,
    # broad-shouldered swimmer type". Buik en pas zijn in een tweede ronde bijgewerkt (eerste versie als voorbeeld, alleen
    # de rechter figuur opnieuw): de ronde buik oogde als zwanger ("a heavier woman with a soft, full midsection, clearly
    # NOT pregnant") en het comfortabele shirt als een wijd T-shirt ("still clearly a fitted women's cycling jersey ...
    # only with a little ease"). Eerste versies: bron/proeven/dames-*1.jpg.
    ("dames-bovenlichaam.jpg", ["dames-bovenlichaam-smal", "dames-bovenlichaam-gemiddeld", "dames-bovenlichaam-breed"], 480, 540, 26),
    ("dames-buik.jpg", ["dames-buik-vlak", "dames-buik-gemiddeld", "dames-buik-rond"], 480, 540, 26),
    ("dames-pas.jpg", ["dames-pas-race", "dames-pas-strak", "dames-pas-normaal"], 480, 540, 26),
]
# Alleen bepaalde reeksen opnieuw snijden: python scripts/maatwijzer-beelden.py dames  (begin van de bestandsnaam)
if len(sys.argv) > 1:
    REEKSEN = [r for r in REEKSEN if r[0].startswith(tuple(sys.argv[1:]))]
DREMPEL = 236  # donkerder dan dit telt als tekening


def bezet(kolom):
    """Geeft per rij en per kolom of er tekening staat."""
    grijs = kolom.convert("L")
    b, h = grijs.size
    px = grijs.load()
    rijen = [any(px[x, y] < DREMPEL for x in range(b)) for y in range(h)]
    return rijen


def figuur_rijen(rijen):
    """Boven- en ondergrens van de figuur; een los blokje onderaan (bijschrift) telt niet mee."""
    blokken, start = [], None
    for y, vol in enumerate(rijen + [False]):
        if vol and start is None:
            start = y
        elif not vol and start is not None:
            blokken.append((start, y))
            start = None
    blokken = [b for b in blokken if b[1] - b[0] >= 3]
    grootste = max(blokken, key=lambda b: b[1] - b[0])
    return grootste


for bestand, namen, tb, th, marge in REEKSEN:
    img = Image.open(os.path.join(BRON, bestand)).convert("RGB")
    B, H = img.size
    kolommen = [img.crop((round(i * B / 3), 0, round((i + 1) * B / 3), H)) for i in range(3)]
    dozen = []
    for kolom in kolommen:
        boven, onder = figuur_rijen(bezet(kolom))
        strook = kolom.crop((0, boven, kolom.size[0], onder)).convert("L")
        px = strook.load()
        xs = [x for x in range(strook.size[0]) if any(px[x, y] < DREMPEL for y in range(strook.size[1]))]
        dozen.append((min(xs), boven, max(xs) + 1, onder))
    top = min(d[1] for d in dozen)
    bodem = max(d[3] for d in dozen)
    breedst = max(d[2] - d[0] for d in dozen)
    schaal = min((th - 2 * marge) / (bodem - top), (tb - 2 * marge) / breedst)
    for naam, kolom, (x0, _, x1, _) in zip(namen, kolommen, dozen):
        stuk = kolom.crop((x0, top, x1, bodem))
        nb, nh = round(stuk.size[0] * schaal), round(stuk.size[1] * schaal)
        stuk = stuk.resize((nb, nh), Image.LANCZOS)
        # Bijna-wit van de JPEG naar zuiver wit, zodat de achtergrond overal gelijk is.
        stuk = stuk.point(lambda v: 255 if v > 246 else v)
        tegel = Image.new("RGB", (tb, th), (255, 255, 255))
        tegel.paste(stuk, ((tb - nb) // 2, (th - nh) // 2))
        pad = os.path.join(UIT, f"maatwijzer-{naam}.webp")
        tegel.save(pad, "WEBP", quality=90, method=6)
        print(f"{naam}: {tb}x{th}, figuur {nb}x{nh}, {os.path.getsize(pad) // 1024} kB")
