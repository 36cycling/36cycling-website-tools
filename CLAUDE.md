# 36 Cycling – website (gereedschap)

Deze map bevat het gereedschap voor de website van 36 Cycling: scripts (Node, `scripts/`, `lib/`), eigen mu-plugins (`wp-root/mu-plugins/`), exports (`audit/`), het vertaalgeheugen NL→EN (`translations/en/`) en back-ups (`backups/`).

**Alle kennis, afspraken en de to-do-lijst staan in Obsidian**: `C:\Users\jeroe\Dropbox\_Obsidian\36\Website\`. Lees daar eerst `Website 36cycling.md` en volg `SKILL.md` (webmaster-draaiboek). Werk die notities bij na afloop van een taak.

Kort de belangrijkste regels:
- Akkoord van Jeroen voor publiceren, verwijderen, plugins en instellingen. Wachtwoorden/API-sleutels vult hij zelf in.
- Jeroens eigen opmaak nooit overschrijven; gericht wijzigen, met back-up in `backups/`.
- Elke wijziging in NL ook in EN.
- `config.json` (inloggegevens) en `private/` (persoonsgegevens) nooit tonen, kopiëren of delen.
- Code met backslashes: niet via een shell-heredoc schrijven; escapes opbouwen met `String.fromCharCode(92)` en resultaat controleren.
