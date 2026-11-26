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

// ADD COLUMN con DEFAULT no toca filas existentes — no destructivo. Idempotente: si ya corrio
// antes, Turso tira "duplicate column name" y aqui se ignora.
const columnas = [
  "ALTER TABLE entregables ADD COLUMN sin_guion INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE entregables ADD COLUMN indicaciones TEXT;",
];

for (const sql of columnas) {
  try {
    await client.execute(sql);
    console.log("OK:", sql);
  } catch (err) {
    if (String(err.message ?? err).includes("duplicate column")) {
      console.log("OK: ya existia —", sql);
    } else {
      throw err;
    }
  }
}
