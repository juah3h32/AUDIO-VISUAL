import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleAuth } from "google-auth-library";
import { ErrorAuth, requerirSesion } from "./_shared/session";

/**
 * Resuelve la carpeta de Drive donde vive un archivo (su `parents[0]`) — para backfill del link
 * de "ver todas las fotos" en entregables de fotografia subidos ANTES de que `carpetaFotosUrl`
 * existiera (ver RevisarEntregableDialog.tsx). Mismo patron de auth que drive-thumbnail.ts:
 * cuenta de servicio de solo lectura, sesion de AV Control obligatoria.
 */

let tokenCacheado: { token: string; vence: number } | null = null;

async function obtenerTokenServicio(): Promise<string> {
  if (tokenCacheado && tokenCacheado.vence > Date.now() + 60_000) return tokenCacheado.token;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const clavePrivada = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!email || !clavePrivada) {
    throw new Error("Faltan las variables GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const auth = new GoogleAuth({
    credentials: { client_email: email, private_key: clavePrivada },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const cliente = await auth.getClient();
  const { token } = await cliente.getAccessToken();
  if (!token) throw new Error("Google no entrego token para la cuenta de servicio.");

  tokenCacheado = { token, vence: Date.now() + 55 * 60 * 1000 };
  return token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requerirSesion(req);
  } catch (err) {
    const e = err as ErrorAuth;
    res.status(e.status ?? 401).json({ error: e.message });
    return;
  }

  const fileId = typeof req.query.id === "string" ? req.query.id : null;
  if (!fileId) {
    res.status(400).json({ error: "Falta el id del archivo." });
    return;
  }

  let token: string;
  try {
    token = await obtenerTokenServicio();
  } catch {
    res.status(500).json({ error: "No se pudo autenticar con Drive." });
    return;
  }

  let metaRes: Response;
  try {
    // `supportsAllDrives=true`: sin esto, Drive puede omitir o fallar en archivos que viven
    // dentro de una Unidad compartida (comun en cuentas de organizacion) — con cuenta personal
    // es un parametro inofensivo que no cambia nada.
    metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    res.status(502).json({ error: "No se pudo consultar Drive." });
    return;
  }

  if (!metaRes.ok) {
    res.status(metaRes.status).json({ error: "Drive no entrego los metadatos del archivo." });
    return;
  }

  const data = (await metaRes.json()) as { parents?: string[] };
  const carpetaId = data.parents?.[0];
  if (!carpetaId) {
    res.status(404).json({ error: "Este archivo no tiene carpeta (o no se pudo leer)." });
    return;
  }

  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).json({ carpetaId, carpetaUrl: `https://drive.google.com/drive/folders/${carpetaId}` });
}
