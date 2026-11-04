import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray } from "../_shared/turso";
import { requerirUsuario, puedeAsignarEntregables } from "../_shared/authz";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth } from "../_shared/session";
import { nuevoId, siguienteFolio } from "../_shared/ids";

function filaASalida(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    folio: String(f.folio),
    nombreJornada: String(f.nombre_jornada),
    proyectosRelacionados: parseJsonArray(f.proyectos_relacionados),
    tipoActividad: String(f.tipo_actividad),
    planta: String(f.planta),
    direccion: f.direccion ? String(f.direccion) : undefined,
    contactoPlanta: f.contacto_planta ? String(f.contacto_planta) : undefined,
    telefonoContacto: f.telefono_contacto ? String(f.telefono_contacto) : undefined,
    fecha: String(f.fecha),
    horaSalida: String(f.hora_salida),
    horaEstimadaLlegada: String(f.hora_estimada_llegada),
    horaInicioGrabacion: f.hora_inicio_grabacion ? String(f.hora_inicio_grabacion) : undefined,
    horaEstimadaFinalizacion: f.hora_estimada_finalizacion ? String(f.hora_estimada_finalizacion) : undefined,
    horaRegreso: f.hora_regreso ? String(f.hora_regreso) : undefined,
    personalAsignado: parseJsonArray(f.personal_asignado),
    responsableProduccionId: String(f.responsable_produccion_id),
    equipoRequerido: parseJsonArray(f.equipo_requerido),
    transporte: f.transporte ? String(f.transporte) : undefined,
    estadoAutorizacion: String(f.estado_autorizacion),
    observaciones: f.observaciones ? String(f.observaciones) : undefined,
    creadoEn: String(f.creado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM salidas");
      res.status(200).json(filas.rows.map((f) => filaASalida(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para crear salidas.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      const id = nuevoId();
      const folio = await siguienteFolio("salidas", "SAL", 101);
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO salidas (id, folio, nombre_jornada, proyectos_relacionados, tipo_actividad, planta, direccion,
                contacto_planta, telefono_contacto, fecha, hora_salida, hora_estimada_llegada, hora_inicio_grabacion,
                hora_estimada_finalizacion, hora_regreso, personal_asignado, responsable_produccion_id, equipo_requerido,
                transporte, estado_autorizacion, observaciones, creado_en)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
        args: [
          id, folio, body.nombreJornada, JSON.stringify(body.proyectosRelacionados ?? []), body.tipoActividad,
          body.planta, body.direccion ?? null, body.contactoPlanta ?? null, body.telefonoContacto ?? null,
          body.fecha, body.horaSalida, body.horaEstimadaLlegada, body.horaInicioGrabacion ?? null,
          body.horaEstimadaFinalizacion ?? null, body.horaRegreso ?? null, JSON.stringify(body.personalAsignado ?? []),
          body.responsableProduccionId, JSON.stringify(body.equipoRequerido ?? []), body.transporte ?? null,
          body.observaciones ?? null, ahora,
        ] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM salidas WHERE id = ?", args: [id] });
      res.status(201).json(filaASalida(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "PATCH") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para autorizar salidas.");
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      const body = cuerpoJson<{ estadoAutorizacion: "autorizada" | "rechazada" }>(req);
      await db().execute({ sql: "UPDATE salidas SET estado_autorizacion = ? WHERE id = ?", args: [body.estadoAutorizacion, id] });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
