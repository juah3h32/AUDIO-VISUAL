import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, esSuperadmin } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId } from "../_shared/ids.js";

function filaANotificacion(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    paraUsuarioId: String(f.para_usuario_id),
    texto: String(f.texto),
    entregableId: f.entregable_id ? String(f.entregable_id) : undefined,
    guionId: f.guion_id ? String(f.guion_id) : undefined,
    leida: f.leida === 1,
    creadoEn: String(f.creado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      // Cada quien ve solo las suyas; superadmin puede pedir las de cualquiera (panel de admin).
      const paraUsuarioId = req.query.paraUsuarioId ? String(req.query.paraUsuarioId) : usuario.id;
      if (paraUsuarioId !== usuario.id && !esSuperadmin(usuario)) {
        throw new ErrorAuth(403, "No puedes ver las notificaciones de otra persona.");
      }
      const filas = await db().execute({
        sql: "SELECT * FROM notificaciones WHERE para_usuario_id = ? ORDER BY creado_en DESC LIMIT 30",
        args: [paraUsuarioId],
      });
      res.status(200).json(filas.rows.map((f) => filaANotificacion(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      const body = cuerpoJson<{ paraUsuarioId: string; texto: string; entregableId?: string; guionId?: string }>(req);
      await db().execute({
        sql: "INSERT INTO notificaciones (id, para_usuario_id, texto, entregable_id, guion_id, leida, creado_en) VALUES (?, ?, ?, ?, ?, 0, ?)",
        args: [nuevoId(), body.paraUsuarioId, body.texto, body.entregableId ?? null, body.guionId ?? null, new Date().toISOString()],
      });
      res.status(201).json({ ok: true });
      return;
    }

    if (req.method === "PATCH") {
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      const fila = await db().execute({ sql: "SELECT para_usuario_id FROM notificaciones WHERE id = ?", args: [id] });
      if (!fila.rows[0]) throw new ErrorAuth(404, "Notificacion no encontrada.");
      if (String(fila.rows[0].para_usuario_id) !== usuario.id) throw new ErrorAuth(403, "No puedes marcar esta notificacion.");
      await db().execute({ sql: "UPDATE notificaciones SET leida = 1 WHERE id = ?", args: [id] });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
