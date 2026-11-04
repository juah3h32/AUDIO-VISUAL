import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseBool } from "../_shared/turso";
import { requerirUsuario, puedeAsignarEntregables, esSuperadmin, esLiderAudiovisual, esGestorRequisiciones, type UsuarioFila } from "../_shared/authz";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth } from "../_shared/session";
import { nuevoId } from "../_shared/ids";

const COLUMNAS: Record<string, string> = {
  proyectoId: "proyecto_id", marcaId: "marca_id", nombre: "nombre", tipo: "tipo", formato: "formato",
  orientacionVideo: "orientacion_video", resolucion: "resolucion", duracion: "duracion",
  responsableId: "responsable_id", fechaCompromiso: "fecha_compromiso", version: "version", estado: "estado",
  urlRevision: "url_revision", urlFinal: "url_final", orientacionVideoAlt: "orientacion_video_alt",
  urlRevisionAlt: "url_revision_alt", urlFinalAlt: "url_final_alt", carpetaFotosUrl: "carpeta_fotos_url",
  guionId: "guion_id", aprobadorId: "aprobador_id", creadoEn: "creado_en", porcentajeAvance: "porcentaje_avance",
  avanceActualizadoEn: "avance_actualizado_en", fechaEnviado: "fecha_enviado", fechaEntregado: "fecha_entregado",
  fechaAprobado: "fecha_aprobado",
};
const COLUMNAS_JSON: Record<string, string> = { fotos: "fotos", fotosParaBorrar: "fotos_para_borrar" };

function filaAEntregable(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    proyectoId: f.proyecto_id ? String(f.proyecto_id) : undefined,
    marcaId: f.marca_id ? String(f.marca_id) : undefined,
    nombre: String(f.nombre),
    tipo: String(f.tipo),
    formato: f.formato ? String(f.formato) : undefined,
    orientacionVideo: f.orientacion_video ? String(f.orientacion_video) : undefined,
    resolucion: f.resolucion ? String(f.resolucion) : undefined,
    duracion: f.duracion ? String(f.duracion) : undefined,
    responsableId: String(f.responsable_id),
    fechaCompromiso: String(f.fecha_compromiso),
    version: String(f.version),
    estado: String(f.estado),
    urlRevision: f.url_revision ? String(f.url_revision) : undefined,
    urlFinal: f.url_final ? String(f.url_final) : undefined,
    orientacionVideoAlt: f.orientacion_video_alt ? String(f.orientacion_video_alt) : undefined,
    urlRevisionAlt: f.url_revision_alt ? String(f.url_revision_alt) : undefined,
    urlFinalAlt: f.url_final_alt ? String(f.url_final_alt) : undefined,
    fotos: f.fotos ? parseJsonArray(f.fotos) : undefined,
    carpetaFotosUrl: f.carpeta_fotos_url ? String(f.carpeta_fotos_url) : undefined,
    fotosParaBorrar: f.fotos_para_borrar ? parseJsonArray(f.fotos_para_borrar) : undefined,
    guionId: f.guion_id ? String(f.guion_id) : undefined,
    aprobadorId: f.aprobador_id ? String(f.aprobador_id) : undefined,
    creadoEn: String(f.creado_en),
    porcentajeAvance: f.porcentaje_avance != null ? Number(f.porcentaje_avance) : undefined,
    avanceActualizadoEn: f.avance_actualizado_en ? String(f.avance_actualizado_en) : undefined,
    fechaEnviado: f.fecha_enviado ? String(f.fecha_enviado) : undefined,
    fechaEntregado: f.fecha_entregado ? String(f.fecha_entregado) : undefined,
    fechaAprobado: f.fecha_aprobado ? String(f.fecha_aprobado) : undefined,
  };
}

function filaAComentario(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    autorId: String(f.autor_id),
    autorNombre: String(f.autor_nombre),
    texto: String(f.texto),
    momento: f.momento ? String(f.momento) : undefined,
    creadoEn: String(f.creado_en),
    corregido: parseBool(f.corregido),
  };
}

/** Portado 1:1 de la regla `entregables.update` de firestore.rules. */
function puedeActualizar(usuario: UsuarioFila, actual: { estado: string; responsableId: string }, cambios: Record<string, unknown>): boolean {
  if (esSuperadmin(usuario) || esGestorRequisiciones(usuario)) return true;
  const nuevoEstado = typeof cambios.estado === "string" ? cambios.estado : actual.estado;
  if (esLiderAudiovisual(usuario)) return nuevoEstado === actual.estado;
  const esResponsable = usuario.id === actual.responsableId;
  const rolValido = ["superadmin", "lider_audiovisual", "colaborador_audiovisual"].includes(usuario.rol);
  return esResponsable && rolValido && nuevoEstado !== "aprobado";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);
    const id = req.query.id ? String(req.query.id) : null;
    const sub = req.query.sub ? String(req.query.sub) : null;

    // --- Comentarios ---
    if (sub === "comentarios") {
      if (!id) throw new ErrorAuth(400, "Falta el id del entregable.");

      if (req.method === "GET") {
        const filas = await db().execute({
          sql: "SELECT * FROM entregables_comentarios WHERE entregable_id = ? ORDER BY creado_en ASC",
          args: [id],
        });
        res.status(200).json(filas.rows.map((f) => filaAComentario(f as Record<string, unknown>)));
        return;
      }

      if (req.method === "POST") {
        if (!esSuperadmin(usuario) && !esGestorRequisiciones(usuario)) {
          throw new ErrorAuth(403, "No tienes permiso para comentar este entregable.");
        }
        const body = cuerpoJson<{ autorId: string; autorNombre: string; texto: string; momento?: string }>(req);
        await db().execute({
          sql: "INSERT INTO entregables_comentarios (id, entregable_id, autor_id, autor_nombre, texto, momento, creado_en, corregido) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
          args: [nuevoId(), id, body.autorId, body.autorNombre, body.texto, body.momento ?? null, new Date().toISOString()],
        });
        res.status(201).json({ ok: true });
        return;
      }

      if (req.method === "PATCH" && req.query.action === "marcar-corregidos") {
        const entregable = await db().execute({ sql: "SELECT responsable_id FROM entregables WHERE id = ?", args: [id] });
        const fila = entregable.rows[0];
        if (!fila) throw new ErrorAuth(404, "Entregable no encontrado.");
        const puede = esSuperadmin(usuario) || esGestorRequisiciones(usuario) || esLiderAudiovisual(usuario) || usuario.id === String(fila.responsable_id);
        if (!puede) throw new ErrorAuth(403, "No tienes permiso.");
        await db().execute({ sql: "UPDATE entregables_comentarios SET corregido = 1 WHERE entregable_id = ? AND corregido = 0", args: [id] });
        res.status(200).json({ ok: true });
        return;
      }

      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }

    // --- Entregables ---
    if (req.method === "GET" && id) {
      const fila = await db().execute({ sql: "SELECT * FROM entregables WHERE id = ?", args: [id] });
      if (!fila.rows[0]) throw new ErrorAuth(404, "Entregable no encontrado.");
      res.status(200).json(filaAEntregable(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM entregables");
      res.status(200).json(filas.rows.map((f) => filaAEntregable(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para crear entregables.");
      const body = cuerpoJson<Record<string, unknown> & {
        opciones?: { estadoFinal: "aprobado" | "entregado"; fecha: string; urlFinal: string; aprobadorId: string };
      }>(req);
      const { opciones, ...data } = body;
      const nuevoEntregableId = nuevoId();
      const ahora = opciones?.fecha ?? new Date().toISOString();

      await db().execute({
        sql: `INSERT INTO entregables (id, proyecto_id, marca_id, nombre, tipo, formato, orientacion_video, resolucion,
                duracion, responsable_id, fecha_compromiso, version, estado, url_final, guion_id, aprobador_id,
                creado_en, fecha_aprobado, fecha_entregado)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1', ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          nuevoEntregableId, data.proyectoId ?? null, data.marcaId ?? null, data.nombre, data.tipo, data.formato ?? null,
          data.orientacionVideo ?? null, data.resolucion ?? null, data.duracion ?? null, data.responsableId,
          data.fechaCompromiso, opciones ? opciones.estadoFinal : "pendiente", opciones?.urlFinal ?? null,
          data.guionId ?? null, opciones?.aprobadorId ?? null, ahora,
          opciones ? opciones.fecha : null, opciones?.estadoFinal === "entregado" ? opciones.fecha : null,
        ] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM entregables WHERE id = ?", args: [nuevoEntregableId] });
      res.status(201).json(filaAEntregable(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (!id) throw new ErrorAuth(400, "Falta el id del entregable.");

    if (req.method === "PATCH") {
      const actualRes = await db().execute({ sql: "SELECT estado, responsable_id FROM entregables WHERE id = ?", args: [id] });
      const actual = actualRes.rows[0];
      if (!actual) throw new ErrorAuth(404, "Entregable no encontrado.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      if (!puedeActualizar(usuario, { estado: String(actual.estado), responsableId: String(actual.responsable_id) }, body)) {
        throw new ErrorAuth(403, "No tienes permiso para editar este entregable.");
      }

      const campos: string[] = [];
      const args: any[] = [];
      for (const [campo, valor] of Object.entries(body)) {
        if (COLUMNAS[campo]) {
          campos.push(`${COLUMNAS[campo]} = ?`);
          args.push(valor ?? null);
        } else if (COLUMNAS_JSON[campo]) {
          campos.push(`${COLUMNAS_JSON[campo]} = ?`);
          args.push(valor && Array.isArray(valor) && valor.length > 0 ? JSON.stringify(valor) : null);
        }
      }
      if (campos.length === 0) {
        res.status(200).json({ ok: true });
        return;
      }
      args.push(id);
      await db().execute({ sql: `UPDATE entregables SET ${campos.join(", ")} WHERE id = ?`, args });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para eliminar entregables.");
      await db().execute({ sql: "DELETE FROM entregables_comentarios WHERE entregable_id = ?", args: [id] });
      await db().execute({ sql: "DELETE FROM entregables WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
