import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OAuth2Client } from "google-auth-library";
import { ErrorAuth, requerirSesion } from "./_shared/session";
import { db } from "./_shared/turso";

/**
 * Manda un archivo (o carpeta) de Drive a la papelera — no borrado permanente, Drive la vacia
 * sola a los 30 dias, asi que si fue un error se puede recuperar desde la papelera de Drive
 * mientras tanto. Usa la cuenta central del dueño (mismo refresh token que
 * `drive-upload-session.ts`/`drive-share.ts` — ver ese archivo para el detalle completo del
 * setup). Si el archivo es de ANTES de centralizar (vive en el Drive personal de quien lo subio
 * entonces), la cuenta central solo tiene permiso de lector publico y esto falla con 403 — eso se
 * reporta tal cual, no hay forma de borrarlo sin acceso de edicion sobre el archivo original.
 */

let clienteCacheado: { token: string; vence: number } | null = null;

async function obtenerTokenPropietario(): Promise<string> {
  if (clienteCacheado && clienteCacheado.vence > Date.now() + 60_000) return clienteCacheado.token;

  const clientId = process.env.GOOGLE_DRIVE_OWNER_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_OWNER_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_OWNER_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan GOOGLE_DRIVE_OWNER_CLIENT_ID / GOOGLE_DRIVE_OWNER_CLIENT_SECRET / GOOGLE_DRIVE_OWNER_REFRESH_TOKEN."
    );
  }

  const cliente = new OAuth2Client(clientId, clientSecret);
  cliente.setCredentials({ refresh_token: refreshToken });
  const { token } = await cliente.getAccessToken();
  if (!token) throw new Error("Google no entrego token para la cuenta del dueño.");

  clienteCacheado = { token, vence: Date.now() + 55 * 60 * 1000 };
  return token;
}

const ROLES_PUEDEN_SUBIR_MATERIAL = new Set(["superadmin", "lider_audiovisual", "colaborador_audiovisual"]);

/**
 * El rol vive en Turso (`usuarios.rol`). Antes este endpoint solo exigia estar logueado:
 * cualquier rol (hasta "solicitante") podia mandar a la papelera CUALQUIER archivo de Drive con
 * solo conocer su `fileId`. Mismo filtro que ya aplica el cliente en `puedeSubirVideos`
 * (`src/lib/roles.ts`), pero ahora tambien server-side.
 */
async function verificarRolAutorizado(uid: string): Promise<void> {
  const res = await db().execute({ sql: "SELECT rol FROM usuarios WHERE id = ?", args: [uid] });
  const rol = res.rows[0]?.rol ? String(res.rows[0].rol) : null;
  if (!rol || !ROLES_PUEDEN_SUBIR_MATERIAL.has(rol)) {
    throw new ErrorAuth(403, "Tu rol no tiene permiso para borrar material en Drive.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }

  try {
    const uid = await requerirSesion(req);
    await verificarRolAutorizado(uid);
  } catch (err) {
    const e = err as ErrorAuth;
    res.status(e.status ?? 401).json({ error: e.message });
    return;
  }

  const id = (req.body as { id?: string })?.id;
  if (!id) {
    res.status(400).json({ error: "Falta el id del archivo." });
    return;
  }

  let token: string;
  try {
    token = await obtenerTokenPropietario();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "No se pudo autenticar con Drive." });
    return;
  }

  try {
    const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    if (!trashRes.ok) {
      res.status(trashRes.status).json({
        error:
          trashRes.status === 403 || trashRes.status === 404
            ? "No se pudo borrar en Drive (es de antes de centralizar y la cuenta central no tiene permiso de edicion sobre ese archivo)."
            : "No se pudo borrar el archivo en Drive.",
      });
      return;
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "No se pudo hablar con Drive." });
  }
}
