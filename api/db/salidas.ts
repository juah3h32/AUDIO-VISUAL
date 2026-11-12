import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray } from "../_shared/turso.js";
import { requerirUsuario, puedeAsignarEntregables } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId, siguienteFolio } from "../_shared/ids.js";

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
      // Orden por fecha: sin esto, una salida cargada despues pero con fecha ANTERIOR (ej. una
      // visita que se nos paso registrar a tiempo) aparecia al final de la lista en vez de en su
      // lugar cronologico.
      const filas = await db().execute("SELECT * FROM salidas ORDER BY fecha ASC");
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
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para editar salidas.");
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      const body = cuerpoJson<{
        estadoAutorizacion?: "autorizada" | "rechazada";
        nombreJornada?: string;
        proyectosRelacionados?: string[];
        tipoActividad?: string;
        planta?: string;
        direccion?: string;
        contactoPlanta?: string;
        telefonoContacto?: string;
        fecha?: string;
        horaSalida?: string;
        horaEstimadaLlegada?: string;
        personalAsignado?: string[];
        responsableProduccionId?: string;
        transporte?: string;
        observaciones?: string;
      }>(req);

      const MAPA_CAMPOS: Record<string, string> = {
        estadoAutorizacion: "estado_autorizacion",
        nombreJornada: "nombre_jornada",
        tipoActividad: "tipo_actividad",
        planta: "planta",
        direccion: "direccion",
        contactoPlanta: "contacto_planta",
        telefonoContacto: "telefono_contacto",
        fecha: "fecha",
        horaSalida: "hora_salida",
        horaEstimadaLlegada: "hora_estimada_llegada",
        responsableProduccionId: "responsable_produccion_id",
        transporte: "transporte",
        observaciones: "observaciones",
      };
      const CAMPOS_JSON = new Set(["proyectosRelacionados", "personalAsignado"]);

      const campos: string[] = [];
      const args: unknown[] = [];
      for (const [clave, columna] of Object.entries(MAPA_CAMPOS)) {
        const valor = (body as Record<string, unknown>)[clave];
        if (valor === undefined) continue;
        campos.push(`${columna} = ?`);
        args.push(valor);
      }
      for (const clave of CAMPOS_JSON) {
        const valor = (body as Record<string, unknown>)[clave];
        if (valor === undefined) continue;
        campos.push(`${clave === "proyectosRelacionados" ? "proyectos_relacionados" : "personal_asignado"} = ?`);
        args.push(JSON.stringify(valor));
      }
      if (campos.length === 0) throw new ErrorAuth(400, "Nada que actualizar.");
      args.push(id);
      await db().execute({ sql: `UPDATE salidas SET ${campos.join(", ")} WHERE id = ?`, args });
      const fila = await db().execute({ sql: "SELECT * FROM salidas WHERE id = ?", args: [id] });
      if (!fila.rows[0]) throw new ErrorAuth(404, "Salida no encontrada.");
      res.status(200).json(filaASalida(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (req.method === "DELETE") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para eliminar salidas.");
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      await db().execute({ sql: "DELETE FROM salidas WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
