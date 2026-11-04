import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_shared/turso";
import { manejarApi, cuerpoJson } from "../_shared/http";
import { ErrorAuth } from "../_shared/session";

/**
 * Primer paso del login: dado un correo, le dice al frontend que formulario mostrar.
 * - "activa": ya tiene password, mostrar campo de contraseña (login normal).
 * - "pendiente": hay invitacion SIN cuenta todavia, O hay cuenta (de la migracion vieja de
 *   Firebase) sin password_hash todavia — en ambos casos se muestra "crea tu contraseña".
 * - "sin_invitacion": nadie autorizo ese correo, no se puede continuar.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }
    const body = cuerpoJson<{ correo: string }>(req);
    const correo = (body.correo ?? "").trim().toLowerCase();
    if (!correo) throw new ErrorAuth(400, "Falta el correo.");

    const usuarioExistente = await db().execute({ sql: "SELECT password_hash FROM usuarios WHERE correo = ?", args: [correo] });
    if (usuarioExistente.rows[0]) {
      const tienePassword = Boolean(usuarioExistente.rows[0].password_hash);
      res.status(200).json({ estado: tienePassword ? "activa" : "pendiente" });
      return;
    }

    const invitacion = await db().execute({ sql: "SELECT correo FROM invitaciones WHERE correo = ?", args: [correo] });
    res.status(200).json({ estado: invitacion.rows[0] ? "pendiente" : "sin_invitacion" });
  });
}
