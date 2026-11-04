import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, puedeAsignarEntregables } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId } from "../_shared/ids.js";

function filaAPlanta(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    direccion: f.direccion ? String(f.direccion) : undefined,
    contactoPlanta: f.contacto_planta ? String(f.contacto_planta) : undefined,
    telefonoContacto: f.telefono_contacto ? String(f.telefono_contacto) : undefined,
    creadoEn: String(f.creado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM plantas ORDER BY nombre COLLATE NOCASE");
      res.status(200).json(filas.rows.map((f) => filaAPlanta(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para crear plantas.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      if (!body.nombre || typeof body.nombre !== "string") throw new ErrorAuth(400, "Falta el nombre de la planta.");
      const id = nuevoId();
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO plantas (id, nombre, direccion, contacto_planta, telefono_contacto, creado_en)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, body.nombre, body.direccion ?? null, body.contactoPlanta ?? null, body.telefonoContacto ?? null, ahora] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM plantas WHERE id = ?", args: [id] });
      res.status(201).json(filaAPlanta(fila.rows[0] as Record<string, unknown>));
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
