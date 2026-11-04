import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray } from "../_shared/turso.js";
import { requerirUsuario, puedeCrearProyectos } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId } from "../_shared/ids.js";

interface AssetMarcaEntrada {
  id?: string;
  tipo: "logo" | "tipografia" | "pdf" | "otro";
  nombre: string;
  url: string;
  fileId?: string;
}

async function filaAMarca(fila: Record<string, unknown>) {
  const assets = await db().execute({
    sql: "SELECT id, tipo, nombre, url, file_id FROM assets_marca WHERE marca_id = ?",
    args: [String(fila.id)],
  });
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    descripcion: fila.descripcion ? String(fila.descripcion) : undefined,
    colores: parseJsonArray(fila.colores),
    manualUrl: fila.manual_url ? String(fila.manual_url) : undefined,
    assets: assets.rows.map((a) => ({
      id: String(a.id),
      tipo: String(a.tipo),
      nombre: String(a.nombre),
      url: String(a.url),
      fileId: a.file_id ? String(a.file_id) : undefined,
    })),
    creadoEn: String(fila.creado_en),
    actualizadoEn: String(fila.actualizado_en),
  };
}

async function reemplazarAssets(marcaId: string, assets: AssetMarcaEntrada[] | undefined) {
  if (assets === undefined) return;
  await db().execute({ sql: "DELETE FROM assets_marca WHERE marca_id = ?", args: [marcaId] });
  for (const a of assets) {
    await db().execute({
      sql: "INSERT INTO assets_marca (id, marca_id, tipo, nombre, url, file_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [a.id ?? nuevoId(), marcaId, a.tipo, a.nombre, a.url, a.fileId ?? null],
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM marcas ORDER BY creado_en DESC");
      const marcas = await Promise.all(filas.rows.map((f) => filaAMarca(f as Record<string, unknown>)));
      res.status(200).json(marcas);
      return;
    }

    // Crear/editar/borrar marca: mismo permiso que crear proyectos (superadmin/lider).
    if (!puedeCrearProyectos(usuario)) {
      throw new ErrorAuth(403, "No tienes permiso para gestionar marcas.");
    }

    if (req.method === "POST") {
      const body = cuerpoJson<{
        nombre: string;
        descripcion?: string;
        colores: string[];
        manualUrl?: string;
        assets?: AssetMarcaEntrada[];
      }>(req);
      const id = nuevoId();
      const ahora = new Date().toISOString();
      await db().execute({
        sql: "INSERT INTO marcas (id, nombre, descripcion, colores, manual_url, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [id, body.nombre, body.descripcion ?? null, JSON.stringify(body.colores ?? []), body.manualUrl ?? null, ahora, ahora],
      });
      await reemplazarAssets(id, body.assets);
      const fila = await db().execute({ sql: "SELECT * FROM marcas WHERE id = ?", args: [id] });
      res.status(201).json(await filaAMarca(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "PATCH") {
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id de la marca.");
      const body = cuerpoJson<{
        nombre?: string;
        descripcion?: string;
        colores?: string[];
        manualUrl?: string;
        assets?: AssetMarcaEntrada[];
      }>(req);

      const campos: string[] = [];
      const args: any[] = [];
      if (body.nombre !== undefined) { campos.push("nombre = ?"); args.push(body.nombre); }
      if (body.descripcion !== undefined) { campos.push("descripcion = ?"); args.push(body.descripcion); }
      if (body.colores !== undefined) { campos.push("colores = ?"); args.push(JSON.stringify(body.colores)); }
      if (body.manualUrl !== undefined) { campos.push("manual_url = ?"); args.push(body.manualUrl); }
      campos.push("actualizado_en = ?");
      args.push(new Date().toISOString());
      args.push(id);
      await db().execute({ sql: `UPDATE marcas SET ${campos.join(", ")} WHERE id = ?`, args });
      await reemplazarAssets(id, body.assets);

      const fila = await db().execute({ sql: "SELECT * FROM marcas WHERE id = ?", args: [id] });
      if (!fila.rows[0]) throw new ErrorAuth(404, "Marca no encontrada.");
      res.status(200).json(await filaAMarca(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id de la marca.");
      await db().execute({ sql: "DELETE FROM assets_marca WHERE marca_id = ?", args: [id] });
      await db().execute({ sql: "DELETE FROM marcas WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
