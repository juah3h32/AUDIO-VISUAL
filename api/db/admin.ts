import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, esSuperadmin } from "../_shared/authz.js";
import { manejarApi } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";

/**
 * Boton de superadmin "vaciar toda la info" (Configuracion) — deja la app como recien
 * instalada. A proposito NO toca `usuarios`, `invitaciones`, `contadores`, ni `marcas`: borrar
 * `usuarios` dejaria a todo el equipo (incluido quien ejecuta esto) sin acceso en el siguiente
 * refresh, ya que `AuthContext` resuelve el rol contra esa tabla. `invitaciones` es la misma
 * categoria de datos de acceso/identidad (no operativos de un ciclo de trabajo) y borrarla
 * invalidaria invitaciones pendientes de gente que todavia no activa su cuenta. Marcas son
 * activos de la empresa, no datos operativos de un ciclo de trabajo.
 */
const TABLAS_A_VACIAR = [
  "requisiciones",
  "proyectos",
  "entregables",
  "entregables_comentarios",
  "guiones",
  "guiones_comentarios",
  "salidas",
  "notificaciones",
  "equipo_av",
  "colaboradores",
  "metas",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);
    if (!esSuperadmin(usuario)) throw new ErrorAuth(403, "Solo superadmin puede vaciar la informacion del sistema.");

    if (req.method === "POST" && req.query.action === "vaciar") {
      for (const tabla of TABLAS_A_VACIAR) {
        await db().execute(`DELETE FROM ${tabla}`);
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
