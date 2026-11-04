import { db } from "./turso.js";
import { ErrorAuth } from "./session.js";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

function mensajeBloqueo(bloqueadoHasta: string): string {
  const minutos = Math.max(1, Math.ceil((new Date(bloqueadoHasta).getTime() - Date.now()) / 60000));
  return `Demasiados intentos fallidos. Espera ${minutos} minuto${minutos === 1 ? "" : "s"} e intenta de nuevo.`;
}

/** Corta el intento ANTES de tocar bcrypt/Turso de usuarios — un correo bloqueado ni siquiera
 * llega a comparar password. */
export async function verificarBloqueoLogin(correo: string): Promise<void> {
  const fila = await db().execute({ sql: "SELECT bloqueado_hasta FROM intentos_login WHERE correo = ?", args: [correo] });
  const bloqueadoHasta = fila.rows[0]?.bloqueado_hasta ? String(fila.rows[0].bloqueado_hasta) : null;
  if (bloqueadoHasta && new Date(bloqueadoHasta).getTime() > Date.now()) {
    throw new ErrorAuth(429, mensajeBloqueo(bloqueadoHasta));
  }
}

export async function registrarIntentoFallido(correo: string): Promise<void> {
  const fila = await db().execute({ sql: "SELECT intentos FROM intentos_login WHERE correo = ?", args: [correo] });
  const intentos = (Number(fila.rows[0]?.intentos) || 0) + 1;
  const bloqueadoHasta = intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null;
  await db().execute({
    sql: `INSERT INTO intentos_login (correo, intentos, bloqueado_hasta) VALUES (?, ?, ?)
          ON CONFLICT(correo) DO UPDATE SET intentos = excluded.intentos, bloqueado_hasta = excluded.bloqueado_hasta`,
    args: [correo, bloqueadoHasta ? 0 : intentos, bloqueadoHasta],
  });
}

export async function limpiarIntentos(correo: string): Promise<void> {
  await db().execute({ sql: "DELETE FROM intentos_login WHERE correo = ?", args: [correo] });
}
