// Smoke test del sistema de auth propio (correo + password + cookie de sesion).
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BASE = process.argv[2] || "http://localhost:3300";
const CORREO_TEST = "test-auth@local.test";
const CORREO_EXISTENTE = "test-existente@local.test";
const PASSWORD = "clave-de-prueba-123";

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

function extraerCookie(res) {
  const set = res.headers.get("set-cookie");
  if (!set) return null;
  return set.split(";")[0]; // "av_session=xxx"
}

async function probar(nombre, fn) {
  try { await fn(); console.log(`OK  ${nombre}`); }
  catch (e) { console.log(`ERR ${nombre}:`, e.message); }
}

// Limpieza previa
await turso.execute({ sql: "DELETE FROM usuarios WHERE correo IN (?, ?)", args: [CORREO_TEST, CORREO_EXISTENTE] });
await turso.execute({ sql: "DELETE FROM invitaciones WHERE correo = ?", args: [CORREO_TEST] });

await probar("POST /api/auth/estado -> sin_invitacion", async () => {
  const r = await fetch(`${BASE}/api/auth/estado`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST }) });
  const d = await r.json();
  if (d.estado !== "sin_invitacion") throw new Error(JSON.stringify(d));
});

// Crea invitacion directo en Turso (equivalente a que un admin ya logueado la cree).
await turso.execute({
  sql: "INSERT INTO invitaciones (correo, nombre, rol, creado_por_id, creado_en) VALUES (?, ?, ?, ?, ?)",
  args: [CORREO_TEST, "Test Auth", "colaborador_audiovisual", "x", new Date().toISOString()],
});

await probar("POST /api/auth/estado -> pendiente (con invitacion)", async () => {
  const r = await fetch(`${BASE}/api/auth/estado`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST }) });
  const d = await r.json();
  if (d.estado !== "pendiente") throw new Error(JSON.stringify(d));
});

await probar("POST /api/auth/activar -> password muy corta rechazada", async () => {
  const r = await fetch(`${BASE}/api/auth/activar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST, password: "123" }) });
  if (r.status !== 400) throw new Error(`status ${r.status}`);
});

let cookieTest;
await probar("POST /api/auth/activar -> crea cuenta y sesion", async () => {
  const r = await fetch(`${BASE}/api/auth/activar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST, password: PASSWORD }) });
  const d = await r.json();
  if (r.status !== 201 || d.rol !== "colaborador_audiovisual") throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  cookieTest = extraerCookie(r);
  if (!cookieTest) throw new Error("no llego cookie de sesion");
  console.log("   -> usuario creado:", d.nombre, d.id);
});

await probar("GET /api/auth/me -> perfil correcto", async () => {
  const r = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieTest } });
  const d = await r.json();
  if (r.status !== 200 || d.correo !== CORREO_TEST) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
});

await probar("GET /api/auth/me SIN cookie -> 401", async () => {
  const r = await fetch(`${BASE}/api/auth/me`);
  if (r.status !== 401) throw new Error(`status ${r.status}`);
});

await probar("POST /api/auth/activar OTRA VEZ -> 409 (ya tiene password)", async () => {
  const r = await fetch(`${BASE}/api/auth/activar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST, password: PASSWORD }) });
  if (r.status !== 409) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("POST /api/auth/login -> password incorrecta -> 401", async () => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST, password: "incorrecta" }) });
  if (r.status !== 401) throw new Error(`status ${r.status}`);
});

let cookieLogin;
await probar("POST /api/auth/login -> correcto", async () => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_TEST, password: PASSWORD }) });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  cookieLogin = extraerCookie(r);
});

await probar("POST /api/auth/logout -> borra cookie", async () => {
  const r = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: cookieLogin } });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

// --- Caso "usuario real migrado sin password" (simulado con fila insertada directo) ---
await turso.execute({
  sql: "INSERT INTO usuarios (id, nombre, correo, rol, activo, creado_en) VALUES (?, ?, ?, 'superadmin', 1, ?)",
  args: ["uid-migrado-test", "Usuario Migrado", CORREO_EXISTENTE, new Date().toISOString()],
});
await probar("POST /api/auth/estado -> pendiente (usuario migrado sin password)", async () => {
  const r = await fetch(`${BASE}/api/auth/estado`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_EXISTENTE }) });
  const d = await r.json();
  if (d.estado !== "pendiente") throw new Error(JSON.stringify(d));
});
await probar("POST /api/auth/activar -> usuario migrado conserva su rol/id", async () => {
  const r = await fetch(`${BASE}/api/auth/activar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: CORREO_EXISTENTE, password: PASSWORD }) });
  const d = await r.json();
  if (r.status !== 200 || d.id !== "uid-migrado-test" || d.rol !== "superadmin") throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
});

// Limpieza
await turso.execute({ sql: "DELETE FROM usuarios WHERE correo IN (?, ?)", args: [CORREO_TEST, CORREO_EXISTENTE] });
await turso.execute({ sql: "DELETE FROM invitaciones WHERE correo = ?", args: [CORREO_TEST] });
console.log("Limpieza completa.");
