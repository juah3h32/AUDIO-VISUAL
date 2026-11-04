import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray } from "../_shared/turso.js";
import { requerirUsuario, puedeAprobar, esGestorDelegado, gestorPuede } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId, siguienteFolio } from "../_shared/ids.js";

function filaARequisicion(f: Record<string, unknown>) {
  return {
    id: String(f.id), folio: String(f.folio), titulo: String(f.titulo),
    departamentoSolicitante: String(f.departamento_solicitante), nombreSolicitante: String(f.nombre_solicitante),
    solicitanteId: String(f.solicitante_id),
    responsableVentaId: f.responsable_venta_id ? String(f.responsable_venta_id) : undefined,
    responsableVentaCorreo: f.responsable_venta_correo ? String(f.responsable_venta_correo) : undefined,
    tipoContenido: String(f.tipo_contenido), objetivo: String(f.objetivo), descripcion: String(f.descripcion),
    publicoObjetivo: f.publico_objetivo ? String(f.publico_objetivo) : undefined,
    formatoSolicitado: f.formato_solicitado ? String(f.formato_solicitado) : undefined,
    cantidadEntregables: Number(f.cantidad_entregables ?? 0),
    fechaRequerida: String(f.fecha_requerida), prioridad: String(f.prioridad),
    referenciasVisuales: f.referencias_visuales ? parseJsonArray(f.referencias_visuales) : undefined,
    archivosAdjuntos: f.archivos_adjuntos ? parseJsonArray(f.archivos_adjuntos) : undefined,
    ubicacion: f.ubicacion ? String(f.ubicacion) : undefined,
    necesitaGrabacion: f.necesita_grabacion === 1,
    observaciones: f.observaciones ? String(f.observaciones) : undefined,
    estado: String(f.estado),
    liderAudiovisualCorreo: f.lider_audiovisual_correo ? String(f.lider_audiovisual_correo) : undefined,
    aprobadoPor: f.aprobado_por ? String(f.aprobado_por) : undefined,
    aprobadoEn: f.aprobado_en ? String(f.aprobado_en) : undefined,
    proyectosVinculados: f.proyectos_vinculados ? parseJsonArray(f.proyectos_vinculados) : undefined,
    creadoEn: String(f.creado_en), actualizadoEn: String(f.actualizado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      // El servidor decide el alcance segun el usuario autenticado — nunca confiar en lo que
      // mande el cliente. Equivalente a `puedeVerTodasLasRequisiciones()` + las dos queries
      // acotadas que Firestore necesitaba (aqui es un solo WHERE con OR, sin esa limitante).
      const veTodo = puedeAprobar(usuario) || (esGestorDelegado(usuario) && gestorPuede(usuario, "verRequisicionesDeOtros"));
      const filas = veTodo
        ? await db().execute("SELECT * FROM requisiciones ORDER BY creado_en DESC")
        : await db().execute({
            sql: "SELECT * FROM requisiciones WHERE solicitante_id = ? OR responsable_venta_id = ? ORDER BY creado_en DESC",
            args: [usuario.id, usuario.id],
          });
      res.status(200).json(filas.rows.map((f) => filaARequisicion(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      const body = cuerpoJson<Record<string, unknown>>(req);
      const propia = body.solicitanteId === usuario.id;
      const puedeCrearParaOtro = puedeAprobar(usuario) || (esGestorDelegado(usuario) && gestorPuede(usuario, "crearEnNombreDeTerceros"));
      if (!propia && !puedeCrearParaOtro) throw new ErrorAuth(403, "No puedes crear requisiciones a nombre de alguien mas.");

      const id = nuevoId();
      const folio = await siguienteFolio("requisiciones", "AV", 1001);
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO requisiciones (id, folio, titulo, departamento_solicitante, nombre_solicitante, solicitante_id,
                tipo_contenido, objetivo, descripcion, publico_objetivo, formato_solicitado, cantidad_entregables,
                fecha_requerida, prioridad, referencias_visuales, archivos_adjuntos, ubicacion, necesita_grabacion,
                observaciones, estado, lider_audiovisual_correo, creado_en, actualizado_en)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enviada', ?, ?, ?)`,
        args: [
          id, folio, body.titulo, body.departamentoSolicitante, body.nombreSolicitante, body.solicitanteId,
          body.tipoContenido, body.objetivo, body.descripcion, body.publicoObjetivo ?? null, body.formatoSolicitado ?? null,
          body.cantidadEntregables ?? 1, body.fechaRequerida, body.prioridad,
          JSON.stringify(body.referenciasVisuales ?? []), JSON.stringify(body.archivosAdjuntos ?? []),
          body.ubicacion ?? null, body.necesitaGrabacion ? 1 : 0, body.observaciones ?? null,
          body.liderAudiovisualCorreo ?? null, ahora, ahora,
        ] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM requisiciones WHERE id = ?", args: [id] });
      res.status(201).json(filaARequisicion(fila.rows[0] as Record<string, unknown>));
      return;
    }

    const id = String(req.query.id ?? "");
    if (!id) throw new ErrorAuth(400, "Falta el id de la requisicion.");

    if (req.method === "PATCH") {
      // Las unicas dos transiciones que existen hoy en la app: cambiar estado y asignar/quitar
      // gestor — ambas exclusivas de quien puede aprobar (ver firestore.rules: el gestor-
      // responsable de venta tiene explicitamente PROHIBIDO tocar estado/responsableVentaId).
      if (!puedeAprobar(usuario)) throw new ErrorAuth(403, "No tienes permiso para editar esta requisicion.");
      const accion = String(req.query.action ?? "");
      const ahora = new Date().toISOString();

      if (accion === "estado") {
        const body = cuerpoJson<{ estado: string }>(req);
        const esAprobada = body.estado === "aprobada";
        await db().execute({
          sql: `UPDATE requisiciones SET estado = ?, actualizado_en = ?${esAprobada ? ", aprobado_en = ?" : ""} WHERE id = ?`,
          args: esAprobada ? [body.estado, ahora, ahora, id] : [body.estado, ahora, id],
        });
        res.status(200).json({ ok: true });
        return;
      }

      if (accion === "gestor") {
        const body = cuerpoJson<{ gestor: { id: string; correo: string } | null }>(req);
        await db().execute({
          sql: "UPDATE requisiciones SET responsable_venta_id = ?, responsable_venta_correo = ?, actualizado_en = ? WHERE id = ?",
          args: [body.gestor?.id ?? null, body.gestor?.correo ?? null, ahora, id],
        });
        res.status(200).json({ ok: true });
        return;
      }

      throw new ErrorAuth(400, "Accion no reconocida.");
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
