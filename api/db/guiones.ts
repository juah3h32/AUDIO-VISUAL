import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, puedeCrearProyectos, esSuperadmin, esGestorRequisiciones, type UsuarioFila } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId, siguienteFolio } from "../_shared/ids.js";

function filaAGuion(f: Record<string, unknown>) {
  return {
    id: String(f.id), folio: String(f.folio),
    proyectoId: f.proyecto_id ? String(f.proyecto_id) : undefined,
    titulo: String(f.titulo), objetivo: String(f.objetivo), contenido: String(f.contenido),
    responsableId: String(f.responsable_id),
    gestorResponsableId: f.gestor_responsable_id ? String(f.gestor_responsable_id) : undefined,
    estado: String(f.estado),
    aprobadorId: f.aprobador_id ? String(f.aprobador_id) : undefined,
    creadoEn: String(f.creado_en),
  };
}

function filaAComentario(f: Record<string, unknown>) {
  return { id: String(f.id), autorId: String(f.autor_id), autorNombre: String(f.autor_nombre), texto: String(f.texto), creadoEn: String(f.creado_en) };
}

/** Portado de la regla `guiones.update`: superadmin (todo) | propio responsable si estado no es
 * "aprobado" | gestor de requisiciones SOLO si no cambia contenido/responsableId (aprueba o pide
 * cambios, no edita el texto). */
function puedeActualizarGuion(usuario: UsuarioFila, actual: { estado: string; responsableId: string; contenido: string }, cambios: Record<string, unknown>): boolean {
  if (esSuperadmin(usuario)) return true;
  if (usuario.id === actual.responsableId && actual.estado !== "aprobado") return true;
  if (esGestorRequisiciones(usuario)) {
    const tocaContenido = "contenido" in cambios && cambios.contenido !== actual.contenido;
    const tocaResponsable = "responsableId" in cambios && cambios.responsableId !== actual.responsableId;
    return !tocaContenido && !tocaResponsable;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);
    const id = req.query.id ? String(req.query.id) : null;
    const sub = req.query.sub ? String(req.query.sub) : null;

    if (sub === "comentarios") {
      if (!id) throw new ErrorAuth(400, "Falta el id del guion.");
      if (req.method === "GET") {
        const filas = await db().execute({ sql: "SELECT * FROM guiones_comentarios WHERE guion_id = ? ORDER BY creado_en ASC", args: [id] });
        res.status(200).json(filas.rows.map((f) => filaAComentario(f as Record<string, unknown>)));
        return;
      }
      if (req.method === "POST") {
        // Mas estricto que esGestorRequisiciones(): aqui SOLO rol community exacto (sin
        // delegado), igual que firestore.rules para esta subcoleccion especifica.
        if (!esSuperadmin(usuario) && usuario.rol !== "community") {
          throw new ErrorAuth(403, "No tienes permiso para comentar este guion.");
        }
        const body = cuerpoJson<{ autorId: string; autorNombre: string; texto: string }>(req);
        await db().execute({
          sql: "INSERT INTO guiones_comentarios (id, guion_id, autor_id, autor_nombre, texto, creado_en) VALUES (?, ?, ?, ?, ?, ?)",
          args: [nuevoId(), id, body.autorId, body.autorNombre, body.texto, new Date().toISOString()],
        });
        res.status(201).json({ ok: true });
        return;
      }
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM guiones ORDER BY creado_en DESC");
      res.status(200).json(filas.rows.map((f) => filaAGuion(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      if (!puedeCrearProyectos(usuario)) throw new ErrorAuth(403, "No tienes permiso para crear guiones.");
      const body = cuerpoJson<{ proyectoId?: string; titulo: string; objetivo: string; contenido: string; responsableId: string; gestorResponsableId?: string }>(req);
      const guionId = nuevoId();
      const folio = await siguienteFolio("guiones", "GN", 101);
      await db().execute({
        sql: "INSERT INTO guiones (id, folio, proyecto_id, titulo, objetivo, contenido, responsable_id, gestor_responsable_id, estado, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)",
        args: [guionId, folio, body.proyectoId ?? null, body.titulo, body.objetivo, body.contenido, body.responsableId, body.gestorResponsableId ?? null, new Date().toISOString()],
      });
      const fila = await db().execute({ sql: "SELECT * FROM guiones WHERE id = ?", args: [guionId] });
      res.status(201).json(filaAGuion(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (!id) throw new ErrorAuth(400, "Falta el id del guion.");

    if (req.method === "PATCH") {
      const actualRes = await db().execute({ sql: "SELECT estado, responsable_id, contenido FROM guiones WHERE id = ?", args: [id] });
      const actual = actualRes.rows[0];
      if (!actual) throw new ErrorAuth(404, "Guion no encontrado.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      if (!puedeActualizarGuion(usuario, { estado: String(actual.estado), responsableId: String(actual.responsable_id), contenido: String(actual.contenido) }, body)) {
        throw new ErrorAuth(403, "No tienes permiso para editar este guion.");
      }
      const mapa: Record<string, string> = { titulo: "titulo", objetivo: "objetivo", contenido: "contenido", responsableId: "responsable_id", estado: "estado", aprobadorId: "aprobador_id", gestorResponsableId: "gestor_responsable_id" };
      const campos: string[] = [];
      const args: any[] = [];
      for (const [campo, valor] of Object.entries(body)) {
        if (mapa[campo]) { campos.push(`${mapa[campo]} = ?`); args.push(valor ?? null); }
      }
      if (campos.length > 0) {
        args.push(id);
        await db().execute({ sql: `UPDATE guiones SET ${campos.join(", ")} WHERE id = ?`, args });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
