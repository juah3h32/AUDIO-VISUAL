import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, esSuperadmin } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId } from "../_shared/ids.js";

function filaARegistro(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    fecha: String(f.fecha),
    cantidad: Number(f.cantidad),
    tipo: String(f.tipo),
    nota: f.nota ? String(f.nota) : undefined,
    creadoPorId: String(f.creado_por_id),
    creadoEn: String(f.creado_en),
  };
}

/** Bitacora manual — solo superadmin la ve, captura o borra (ver RegistroGrabacion, types/index.ts). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);
    if (!esSuperadmin(usuario)) throw new ErrorAuth(403, "No tienes permiso para ver esta bitacora.");

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM registros_grabacion ORDER BY fecha DESC");
      res.status(200).json(filas.rows.map((f) => filaARegistro(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      const body = cuerpoJson<{ fecha: string; cantidad: number; tipo: "grabacion" | "fotografia"; nota?: string }>(req);
      if (!body.fecha || !body.cantidad || !body.tipo) throw new ErrorAuth(400, "Faltan datos del registro.");
      const id = nuevoId();
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO registros_grabacion (id, fecha, cantidad, tipo, nota, creado_por_id, creado_en)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, body.fecha, body.cantidad, body.tipo, body.nota ?? null, usuario.id, ahora] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM registros_grabacion WHERE id = ?", args: [id] });
      res.status(201).json(filaARegistro(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      await db().execute({ sql: "DELETE FROM registros_grabacion WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
