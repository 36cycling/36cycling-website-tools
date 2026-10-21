// Test of de REST API bereikbaar is en de Application Password werkt.
import { loadConfig, whoAmI } from "../lib/wp.mjs";

const cfg = await loadConfig();
try {
  const me = await whoAmI(cfg);
  console.log(`OK — ingelogd als: ${me.name} (id ${me.id}), rollen: ${me.roles?.join(", ")}`);
  console.log(`Schrijfrechten op pagina's: ${me.capabilities?.edit_pages ? "ja" : "NEE"}`);
} catch (e) {
  console.error("Mislukt:", e.message);
  process.exit(1);
}
