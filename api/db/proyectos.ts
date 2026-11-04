import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray } from "../_shared/turso.js";
import { requerirUsuario, puedeCrearProyectos } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId, siguienteFolio } from "../_shared/ids.js";

function filaAProyecto(f: Record<string, unknown>) {
  return {
    id: String(f.id), folio: String(f.folio), nombre: String(f.nombre),
    requisicionesVinculadas: parseJsonArray(f.requisiciones_vinculadas),
    marcaId: f.marca_id ? String(f.marca_id) : undefined,
    responsablePrincipalId: f.responsable_principal_id ? String(f.responsable_principal_id) : undefined,
    colaboradoresIds: parseJsonArray(f.colaboradores_ids),
    departamentoSolicitante: String(f.departamento_solicitante), prioridad: String(f.prioridad),
    fechaInicio: f.fecha_inicio ? String(f.fecha_inicio) : undefined,
    fechaCompromiso: f.fecha_compromiso ? String(f.fecha_compromiso) : undefined,
    etapaActual: String(f.etapa_actual),
    etapasOmitidas: f.etapas_omitidas ? parseJsonArray(f.etapas_omitidas) : undefined,
    porcentajeAvance: Number(f.porcentaje_avance ?? 0),
    creadoEn: String(f.creado_en), actualizadoEn: String(f.actualizado_en),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM proyectos ORDER BY creado_en DESC");
      res.status(200).json(filas.rows.map((f) => filaAProyecto(f as Record<string, unknown>)));
      return;
    }

    if (!puedeCrearProyectos(usuario)) throw new ErrorAuth(403, "No tienes permiso para gestionar proyectos.");

    if (req.method === "POST") {
      const body = cuerpoJson<Record<string, unknown>>(req);
      const id = nuevoId();
      const folio = await siguienteFolio("proyectos", "PRY", 101);
      const ahora = new Date().toISOString();
      await db().execute({
        sql: `INSERT INTO proyectos (id, folio, nombre, requisiciones_vinculadas, marca_id, responsable_principal_id,
                colaboradores_ids, departamento_solicitante, prioridad, fecha_inicio, fecha_compromiso, etapa_actual,
                porcentaje_avance, creado_en, actualizado_en)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planeacion', 0, ?, ?)`,
        args: [
          id, folio, body.nombre, JSON.stringify(body.requisicionesVinculadas ?? []), body.marcaId ?? null,
          body.responsablePrincipalId ?? null, JSON.stringify(body.colaboradoresIds ?? []),
          body.departamentoSolicitante, body.prioridad, body.fechaInicio ?? null, body.fechaCompromiso ?? null,
          ahora, ahora,
        ] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM proyectos WHERE id = ?", args: [id] });
      res.status(201).json(filaAProyecto(fila.rows[0] as Record<string, unknown>));
      return;
    }

    const id = String(req.query.id ?? "");
    if (!id) throw new ErrorAuth(400, "Falta el id del proyecto.");

    if (req.method === "PATCH") {
      const mapa: Record<string, string> = {
        nombre: "nombre", marcaId: "marca_id", responsablePrincipalId: "responsable_principal_id",
        departamentoSolicitante: "departamento_solicitante", prioridad: "prioridad", fechaInicio: "fecha_inicio",
        fechaCompromiso: "fecha_compromiso", etapaActual: "etapa_actual", porcentajeAvance: "porcentaje_avance",
      };
      const mapaJson: Record<string, string> = { requisicionesVinculadas: "requisiciones_vinculadas", colaboradoresIds: "colaboradores_ids", etapasOmitidas: "etapas_omitidas" };
      const body = cuerpoJson<Record<string, unknown>>(req);
      const campos: string[] = [];
      const args: any[] = [];
      for (const [campo, valor] of Object.entries(body)) {
        if (mapa[campo]) { campos.push(`${mapa[campo]} = ?`); args.push(valor ?? null); }
        else if (mapaJson[campo]) { campos.push(`${mapaJson[campo]} = ?`); args.push(JSON.stringify(valor ?? [])); }
      }
      campos.push("actualizado_en = ?");
      args.push(new Date().toISOString(), id);
      await db().execute({ sql: `UPDATE proyectos SET ${campos.join(", ")} WHERE id = ?`, args });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      await db().execute({ sql: "DELETE FROM proyectos WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
