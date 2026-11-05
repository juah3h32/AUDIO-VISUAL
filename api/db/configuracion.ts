import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso.js";
import { requerirUsuario, esSuperadmin } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";

/**
 * Configuracion global de la app — pares clave/valor, una fila por clave. Hoy solo guarda el
 * fileId de Drive de la foto del banner "Frase del dia" (`foto_frase_dia`), pero un ajuste nuevo
 * de superadmin a futuro puede reusar esta misma tabla sin migracion.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);

    if (req.method === "GET") {
      const filas = await db().execute("SELECT clave, valor FROM configuracion");
      const mapa: Record<string, string> = {};
      for (const f of filas.rows) mapa[String(f.clave)] = String(f.valor);
      res.status(200).json(mapa);
      return;
    }

    if (req.method === "PATCH") {
      if (!esSuperadmin(usuario)) throw new ErrorAuth(403, "Solo superadmin puede cambiar la configuracion.");
      const body = cuerpoJson<{ clave?: string; valor?: string }>(req);
      if (!body.clave) throw new ErrorAuth(400, "Falta la clave de configuracion.");
      const ahora = new Date().toISOString();
      await db().execute({
        sql: "INSERT INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?) ON CONFLICT(clave) DO UPDATE SET valor = ?, actualizado_en = ?",
        args: [body.clave, body.valor ?? "", ahora, body.valor ?? "", ahora],
      });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
