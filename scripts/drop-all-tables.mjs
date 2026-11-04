import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
let pendientes = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")).rows.map((r) => r.name);

// Varias pasadas: las tablas con FK hacia otras fallan hasta que sus "hijas" ya se borraron.
let vueltas = 0;
while (pendientes.length > 0 && vueltas < 10) {
  const siguientes = [];
  for (const nombre of pendientes) {
    try {
      await client.execute(`DROP TABLE IF EXISTS ${nombre}`);
      console.log("DROP:", nombre);
    } catch {
      siguientes.push(nombre);
    }
  }
  pendientes = siguientes;
  vueltas++;
}
if (pendientes.length > 0) console.log("No se pudieron borrar:", pendientes);
else console.log("Todas las tablas borradas.");
