import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = readFileSync(join(__dirname, "turso-schema.sql"), "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await client.execute(stmt);
  const primeraLinea = stmt.split("\n")[0].slice(0, 70);
  console.log("OK:", primeraLinea);
}

const tablas = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
console.log("\nTablas en Turso:", tablas.rows.map((r) => r.name).join(", "));
