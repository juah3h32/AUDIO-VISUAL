import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseJsonObject, parseBool } from "../_shared/turso";
import { requerirUsuario, esSuperadmin, esLiderAudiovisual, puedeGestionarUsuarios, type UsuarioFila } from "../_shared/authz";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth } from "../_shared/session";

// El alta/activacion de cuenta (correo + password) vive en api/auth/*.ts — este archivo solo
// administra usuarios YA existentes e invitaciones, siempre con sesion activa.

function filaAUsuario(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    correo: String(f.correo),
    rol: String(f.rol),
    puesto: f.puesto ? String(f.puesto) : undefined,
    especialidades: parseJsonArray(f.especialidades),
    avatarUrl: f.avatar_url ? String(f.avatar_url) : undefined,
    gestorRequisiciones: parseJsonObject(f.gestor_requisiciones),
    activo: parseBool(f.activo),
    creadoEn: String(f.creado_en),
  };
}

function filaAInvitacion(f: Record<string, unknown>) {
  return {
    correo: String(f.correo),
    nombre: String(f.nombre),
    rol: String(f.rol),
    gestorRequisiciones: parseJsonObject(f.gestor_requisiciones),
    creadoPorId: String(f.creado_por_id),
    creadoEn: String(f.creado_en),
  };
}

/** Campos permitidos por quien edita, portado de la regla `usuarios.update` de las viejas
 * firestore.rules: superadmin (cualquier campo) | lider_audiovisual (solo gestorRequisiciones/
 * especialidades/puesto, nunca rol) | el propio usuario sobre si mismo (solo avatarUrl). */
function camposPermitidos(editor: UsuarioFila, targetId: string): string[] {
  if (esSuperadmin(editor)) return ["nombre", "correo", "rol", "puesto", "especialidades", "avatarUrl", "gestorRequisiciones", "activo"];
  if (esLiderAudiovisual(editor)) return ["gestorRequisiciones", "especialidades", "puesto"];
  if (editor.id === targetId) return ["avatarUrl"];
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    // --- Invitaciones ---
    if (req.query.sub === "invitaciones") {
      const usuario = await requerirUsuario(req);
      if (!puedeGestionarUsuarios(usuario)) throw new ErrorAuth(403, "No tienes permiso para gestionar invitaciones.");

      if (req.method === "GET") {
        const filas = await db().execute("SELECT * FROM invitaciones");
        res.status(200).json(filas.rows.map((f) => filaAInvitacion(f as Record<string, unknown>)));
        return;
      }
      if (req.method === "POST") {
        const body = cuerpoJson<{ correo: string; nombre: string; rol: string; gestorRequisiciones?: unknown; creadoPorId: string }>(req);
        const correo = body.correo.trim().toLowerCase();
        await db().execute({
          sql: "INSERT INTO invitaciones (correo, nombre, rol, gestor_requisiciones, creado_por_id, creado_en) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(correo) DO UPDATE SET nombre = ?, rol = ?, gestor_requisiciones = ?, creado_por_id = ?",
          args: [
            correo, body.nombre, body.rol, body.gestorRequisiciones ? JSON.stringify(body.gestorRequisiciones) : null, body.creadoPorId, new Date().toISOString(),
            body.nombre, body.rol, body.gestorRequisiciones ? JSON.stringify(body.gestorRequisiciones) : null, body.creadoPorId,
          ],
        });
        res.status(201).json({ ok: true });
        return;
      }
      if (req.method === "DELETE") {
        const correo = String(req.query.correo ?? "").trim().toLowerCase();
        if (!correo) throw new ErrorAuth(400, "Falta el correo.");
        await db().execute({ sql: "DELETE FROM invitaciones WHERE correo = ?", args: [correo] });
        res.status(204).end();
        return;
      }
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }

    // --- Usuarios ---
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT * FROM usuarios");
      res.status(200).json(filas.rows.map((f) => filaAUsuario(f as Record<string, unknown>)));
      return;
    }

    if (req.method === "PATCH") {
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id del usuario.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      const permitidos = camposPermitidos(usuario, id);
      const enviados = Object.keys(body);
      const noPermitidos = enviados.filter((c) => !permitidos.includes(c));
      if (noPermitidos.length > 0) throw new ErrorAuth(403, `No tienes permiso para cambiar: ${noPermitidos.join(", ")}.`);
      if (enviados.length === 0) { res.status(200).json({ ok: true }); return; }

      const mapaColumnas: Record<string, string> = {
        nombre: "nombre", correo: "correo", rol: "rol", puesto: "puesto",
        especialidades: "especialidades", avatarUrl: "avatar_url",
        gestorRequisiciones: "gestor_requisiciones", activo: "activo",
      };
      const campos: string[] = [];
      const args: any[] = [];
      for (const campo of enviados) {
        campos.push(`${mapaColumnas[campo]} = ?`);
        const valor = body[campo];
        if (campo === "especialidades") args.push(JSON.stringify(valor ?? []));
        else if (campo === "gestorRequisiciones") args.push(valor ? JSON.stringify(valor) : null);
        else if (campo === "activo") args.push(valor ? 1 : 0);
        else args.push(valor ?? null);
      }
      args.push(id);
      await db().execute({ sql: `UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`, args });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      if (!esSuperadmin(usuario) && !esLiderAudiovisual(usuario)) throw new ErrorAuth(403, "No tienes permiso para eliminar usuarios.");
      const id = String(req.query.id ?? "");
      if (!id) throw new ErrorAuth(400, "Falta el id del usuario.");
      await db().execute({ sql: "DELETE FROM usuarios WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
