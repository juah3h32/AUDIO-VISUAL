import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseBool } from "../_shared/turso";
import { requerirUsuario } from "../_shared/authz";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth } from "../_shared/session";
import { nuevoId } from "../_shared/ids";

function filaAEquipoAV(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    codigoInterno: String(f.codigo_interno),
    nombre: String(f.nombre),
    categoria: String(f.categoria),
    marca: f.marca ? String(f.marca) : undefined,
    modelo: f.modelo ? String(f.modelo) : undefined,
    numeroSerie: f.numero_serie ? String(f.numero_serie) : undefined,
    estado: String(f.estado),
    responsableId: f.responsable_id ? String(f.responsable_id) : undefined,
    ubicacion: f.ubicacion ? String(f.ubicacion) : undefined,
    disponibilidad: parseBool(f.disponibilidad),
    ultimoMantenimiento: f.ultimo_mantenimiento ? String(f.ultimo_mantenimiento) : undefined,
    proximoMantenimiento: f.proximo_mantenimiento ? String(f.proximo_mantenimiento) : undefined,
  };
}

function filaAColaborador(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    tieneCuenta: parseBool(f.tiene_cuenta),
    nombre: String(f.nombre),
    puesto: String(f.puesto),
    especialidades: parseJsonArray(f.especialidades),
    disponibilidad: String(f.disponibilidad),
    proyectosAsignados: parseJsonArray(f.proyectos_asignados),
    tareasPendientes: Number(f.tareas_pendientes ?? 0),
    cargaEstimada: Number(f.carga_estimada ?? 0),
    cargaReal: Number(f.carga_real ?? 0),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    await requerirUsuario(req);
    const tipo = String(req.query.tipo ?? "colaboradores");

    if (req.method === "GET" && tipo === "equipo_av") {
      const filas = await db().execute("SELECT * FROM equipo_av");
      res.status(200).json(filas.rows.map((f) => filaAEquipoAV(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM colaboradores");
      res.status(200).json(filas.rows.map((f) => filaAColaborador(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "POST") {
      const body = cuerpoJson<{ nombre: string; puesto: string; especialidades: string[]; disponibilidad: string; tieneCuenta?: boolean }>(req);
      const id = nuevoId();
      await db().execute({
        sql: "INSERT INTO colaboradores (id, tiene_cuenta, nombre, puesto, especialidades, disponibilidad, proyectos_asignados, tareas_pendientes, carga_estimada, carga_real) VALUES (?, ?, ?, ?, ?, ?, '[]', 0, 0, 0)",
        args: [id, body.tieneCuenta ? 1 : 0, body.nombre, body.puesto, JSON.stringify(body.especialidades ?? []), body.disponibilidad],
      });
      const fila = await db().execute({ sql: "SELECT * FROM colaboradores WHERE id = ?", args: [id] });
      res.status(201).json(filaAColaborador(fila.rows[0] as Record<string, unknown>));
      return;
    }

    // Especialidades/puesto que el lider asigna en Equipo. Cuenta real -> tabla "usuarios";
    // externo sin cuenta -> su fila en "colaboradores". Mismo criterio que el codigo Firestore.
    if (req.method === "PATCH" && tipo === "perfil") {
      const id = String(req.query.id ?? "");
      const tieneCuenta = req.query.tieneCuenta === "1";
      if (!id) throw new ErrorAuth(400, "Falta el id.");
      const body = cuerpoJson<{ especialidades: string[]; puesto: string }>(req);
      if (tieneCuenta) {
        await db().execute({
          sql: "UPDATE usuarios SET especialidades = ?, puesto = ? WHERE id = ?",
          args: [JSON.stringify(body.especialidades ?? []), body.puesto, id],
        });
      } else {
        await db().execute({
          sql: "UPDATE colaboradores SET especialidades = ?, puesto = ? WHERE id = ?",
          args: [JSON.stringify(body.especialidades ?? []), body.puesto, id],
        });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
