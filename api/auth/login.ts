import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { db, parseJsonArray, parseJsonObject, parseBool } from "../_shared/turso.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth, firmarSesion, setCookieSesion } from "../_shared/session.js";
import { verificarBloqueoLogin, registrarIntentoFallido, limpiarIntentos } from "../_shared/rateLimit.js";

function filaAUsuario(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    correo: String(f.correo),
    rol: String(f.rol),
    puesto: f.puesto ? String(f.puesto) : undefined,
    especialidades: parseJsonArray(f.especialidades),
    avatarUrl: f.avatar_url ? String(f.avatar_url) : undefined,
    gestorRequisiciones: parseJsonObject(f.gestor_requisiciones),
    activo: parseBool(f.activo),
    creadoEn: String(f.creado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }
    const body = cuerpoJson<{ correo: string; password: string }>(req);
    const correo = (body.correo ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    // Mismo mensaje generico tanto si el correo no existe como si la contraseña es incorrecta —
    // no hay que confirmarle a quien intenta entrar cual de las dos cosas fallo.
    const MENSAJE_GENERICO = "Correo o contraseña incorrectos.";

    await verificarBloqueoLogin(correo);

    const res_ = await db().execute({ sql: "SELECT * FROM usuarios WHERE correo = ?", args: [correo] });
    const fila = res_.rows[0];
    if (!fila || !fila.password_hash) {
      await registrarIntentoFallido(correo);
      throw new ErrorAuth(401, MENSAJE_GENERICO);
    }

    const valido = await bcrypt.compare(password, String(fila.password_hash));
    if (!valido) {
      await registrarIntentoFallido(correo);
      throw new ErrorAuth(401, MENSAJE_GENERICO);
    }

    if (!parseBool(fila.activo)) throw new ErrorAuth(403, "Tu cuenta esta desactivada. Contacta a un administrador.");

    await limpiarIntentos(correo);
    setCookieSesion(res, await firmarSesion(String(fila.id)));
    res.status(200).json(filaAUsuario(fila as Record<string, unknown>));
  });
}
