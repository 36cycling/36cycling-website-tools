# Migratie 36cycling → rondevanrotterdam.nl

Gefaseerde migratie van **marketing-pagina's** van de oude Umbraco-site naar de nieuwe
WordPress-site. WooCommerce-shop komt later, apart. Oude site blijft voorlopig live.

## Pipeline per pagina

1. **Extract** — oude pagina crawlen → `pages/<slug>.json` (SEO-titel, koppen, teksten,
   alle afbeeldingen + alt-teksten). Jij reviewt dit bestand.
2. **Media** — afbeeldingen downloaden → uploaden naar WP media library via REST,
   inclusief `alt_text`. Mapping oude-URL → WP media-ID bijhouden.
3. **Bouwen** — pagina opbouwen volgens stijlpagina (post 969), status = `draft`.
4. **Verifiëren** — nieuwe pagina in preview-browser checken (koppen, afbeeldingen,
   alt, Yoast-meta). Jij publiceert.

## SEO
- On-page SEO (H1/H2, alt-teksten, meta-title/description) wordt 1:1 overgenomen.
- `redirects.csv` groeit met elke pagina mee → klaar als redirect-document vóór go-live.

## Setup
1. Kopieer `config.example.json` → `config.json` (staat in .gitignore, nooit committen).
2. Vul WP-gebruikersnaam + Application Password in
   (WP-admin → Gebruikers → Profiel → Application Passwords).
3. Test: `node scripts/test-auth.mjs`

## Bestanden
- `config.json` — credentials (geheim, gitignored)
- `pages/*.json` — bron van waarheid per pagina
- `media/` — gedownloade afbeeldingen (tijdelijk)
- `lib/wp.mjs` — REST-client (media-upload, pagina's)
- `redirects.csv` — groeiende redirect-lijst
