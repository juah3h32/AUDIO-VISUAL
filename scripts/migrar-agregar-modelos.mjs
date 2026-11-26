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

// ADD COLUMN sin NOT NULL/default no toca filas existentes — no destructivo. Idempotente: si ya
// corrio antes, Turso tira "duplicate column name" y aqui se ignora.
try {
  await client.execute("ALTER TABLE salidas ADD COLUMN modelos TEXT;");
  console.log("OK: columna modelos agregada a salidas.");
} catch (err) {
  if (String(err.message ?? err).includes("duplicate column")) {
    console.log("OK: columna modelos ya existia, nada que hacer.");
  } else {
    throw err;
  }
}
