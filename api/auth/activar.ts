import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { db, parseJsonArray, parseJsonObject, parseBool } from "../_shared/turso";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth, firmarSesion, setCookieSesion } from "../_shared/session";
import { nuevoId } from "../_shared/ids";

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

/**
 * Crea la contraseña por primera vez — cubre dos casos:
 * 1. Invitacion nueva (nunca hubo cuenta): crea la fila en `usuarios` con los datos de la
 *    invitacion (nombre/rol/gestorRequisiciones).
 * 2. Cuenta real que vino de la migracion de Firebase Auth (ya tenia fila en `usuarios`, sin
 *    password_hash): solo le pone el hash, sin tocar su rol/historial.
 * En ambos casos deja la sesion iniciada (misma cookie que /api/auth/login).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }
    const body = cuerpoJson<{ correo: string; password: string }>(req);
    const correo = (body.correo ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!correo) throw new ErrorAuth(400, "Falta el correo.");
    if (password.length < 8) throw new ErrorAuth(400, "La contraseña debe tener al menos 8 caracteres.");

    const hash = await bcrypt.hash(password, 10);

    const existente = await db().execute({ sql: "SELECT * FROM usuarios WHERE correo = ?", args: [correo] });
    const filaExistente = existente.rows[0];

    if (filaExistente) {
      if (filaExistente.password_hash) {
        throw new ErrorAuth(409, "Esta cuenta ya tiene contraseña. Inicia sesion normal.");
      }
      await db().execute({ sql: "UPDATE usuarios SET password_hash = ? WHERE id = ?", args: [hash, filaExistente.id] });
      const uid = String(filaExistente.id);
      setCookieSesion(res, await firmarSesion(uid));
      const fila = await db().execute({ sql: "SELECT * FROM usuarios WHERE id = ?", args: [uid] });
      res.status(200).json(filaAUsuario(fila.rows[0] as Record<string, unknown>));
      return;
    }

    const inv = await db().execute({ sql: "SELECT * FROM invitaciones WHERE correo = ?", args: [correo] });
    const invitacion = inv.rows[0];
    if (!invitacion) {
      throw new ErrorAuth(403, "Este correo no tiene invitacion. Pide a un administrador que te agregue en Configuracion.");
    }

    const uid = nuevoId();
    const ahora = new Date().toISOString();
    await db().execute({
      sql: "INSERT INTO usuarios (id, nombre, correo, rol, gestor_requisiciones, password_hash, activo, creado_en) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
      args: [uid, invitacion.nombre, correo, invitacion.rol, invitacion.gestor_requisiciones ?? null, hash, ahora],
    });
    setCookieSesion(res, await firmarSesion(uid));
    const fila = await db().execute({ sql: "SELECT * FROM usuarios WHERE id = ?", args: [uid] });
    res.status(201).json(filaAUsuario(fila.rows[0] as Record<string, unknown>));
  });
}
