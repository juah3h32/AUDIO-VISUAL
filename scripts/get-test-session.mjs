import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

export const UID_PRUEBA = "test-superadmin-uid";
const CORREO_PRUEBA = "test-sesion@local.test";
const PASSWORD_PRUEBA = "clave-de-prueba-123";

/** Inserta un usuario de prueba directo en Turso (sin password) y lo activa via /api/auth/activar
 * para obtener una cookie de sesion real — mismo camino que seguiria cualquier usuario. */
export async function obtenerSesionDePrueba(base, rol = "superadmin") {
  const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  await turso.execute({ sql: "DELETE FROM usuarios WHERE id = ? OR correo = ?", args: [UID_PRUEBA, CORREO_PRUEBA] });
  await turso.execute({
    sql: "INSERT INTO usuarios (id, nombre, correo, rol, activo, creado_en) VALUES (?, ?, ?, ?, 1, ?)",
    args: [UID_PRUEBA, "Test " + rol, CORREO_PRUEBA, rol, new Date().toISOString()],
  });

  const r = await fetch(`${base}/api/auth/activar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo: CORREO_PRUEBA, password: PASSWORD_PRUEBA }),
  });
  if (r.status !== 200) throw new Error(`No se pudo activar sesion de prueba: ${r.status} ${JSON.stringify(await r.json())}`);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return { cookie, turso };
}

export async function limpiarUsuarioPrueba(turso) {
  await turso.execute({ sql: "DELETE FROM usuarios WHERE id = ? OR correo = ?", args: [UID_PRUEBA, CORREO_PRUEBA] });
}
