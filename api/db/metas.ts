import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseJsonObject } from "../_shared/turso.js";
import { requerirUsuario, puedeGestionarUsuarios } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";

function filaAMeta(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    responsabilidad: String(f.responsabilidad),
    metasSemanales: parseJsonObject(f.metas_semanales) ?? {},
    proyectosACargo: parseJsonArray(f.proyectos_a_cargo),
    actualizadoEn: f.actualizado_en ? String(f.actualizado_en) : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM metas");
      res.status(200).json(filas.rows.map((f) => filaAMeta(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "PUT") {
      if (!puedeGestionarUsuarios(usuario)) throw new ErrorAuth(403, "No tienes permiso para definir metas.");
      const body = cuerpoJson<{ id: string; responsabilidad: string; metasSemanales: Record<string, number>; proyectosACargo: string[] }>(req);
      if (!body.id) throw new ErrorAuth(400, "Falta el id.");
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO metas (id, responsabilidad, metas_semanales, proyectos_a_cargo, actualizado_en)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET responsabilidad = ?, metas_semanales = ?, proyectos_a_cargo = ?, actualizado_en = ?`,
        args: [
          body.id, body.responsabilidad, JSON.stringify(body.metasSemanales ?? {}), JSON.stringify(body.proyectosACargo ?? []), ahora,
          body.responsabilidad, JSON.stringify(body.metasSemanales ?? {}), JSON.stringify(body.proyectosACargo ?? []), ahora,
        ],
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
