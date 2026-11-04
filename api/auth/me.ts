import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseJsonObject, parseBool } from "../_shared/turso";
import { manejarApi } from "../_shared/http";
import { ErrorAuth, requerirSesion } from "../_shared/session";

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

/** Restaura/refresca la sesion actual — usado al cargar la app y en el poll periodico de
 * AuthContext.tsx (reemplaza el `onSnapshot` en vivo que tenia Firestore sobre el rol). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }
    const uid = await requerirSesion(req);
    const fila = await db().execute({ sql: "SELECT * FROM usuarios WHERE id = ?", args: [uid] });
    if (!fila.rows[0]) throw new ErrorAuth(401, "Tu cuenta ya no existe. Vuelve a iniciar sesion.");
    res.status(200).json(filaAUsuario(fila.rows[0] as Record<string, unknown>));
  });
}
