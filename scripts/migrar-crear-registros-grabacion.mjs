import { createClient } from "@libsql/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// CREATE TABLE IF NOT EXISTS — no toca nada si ya existe. Tabla nueva, cero riesgo sobre datos
// existentes.
await client.execute(`
  CREATE TABLE IF NOT EXISTS registros_grabacion (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    nota TEXT,
    creado_por_id TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
`);
console.log("OK: tabla registros_grabacion lista.");
