import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleAuth } from "google-auth-library";
import { ErrorAuth, requerirSesion } from "./_shared/session";

/**
 * Igual que `drive-video.ts` pero para la miniatura: con la cuenta de servicio, cualquiera ve la
 * miniatura real sin conectar nada propio.
 *
 * Solo pide los metadatos (`thumbnailLink`) y redirige ahi — el link de miniatura de Drive ya
 * es publico una vez generado, no hace falta bajar y reenviar los bytes nosotros mismos.
 *
 * SEGURIDAD: igual que el video, este endpoint exige la cookie de sesion de AV Control
 * (`requerirSesion`) — el navegador la manda sola en cualquier <img src> al mismo origen.
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
  // Primero la sesion: sin usuario valido no se consulta Drive ni se revela el link de miniatura.
  try {
    await requerirSesion(req);
  } catch (err) {
    const e = err as ErrorAuth;
    // El <img> ignora el cuerpo, pero el JSON sirve para diagnosticar desde las herramientas.
    res.status(e.status ?? 401).json({ error: e.message });
    return;
  }

  const fileId = typeof req.query.id === "string" ? req.query.id : null;
  if (!fileId) {
    res.status(400).end();
    return;
  }

  let token: string;
  try {
    token = await obtenerTokenServicio();
  } catch {
    res.status(500).end();
    return;
  }

  let metaRes: Response;
  try {
    metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    res.status(502).end();
    return;
  }

  if (!metaRes.ok) {
    res.status(metaRes.status).end();
    return;
  }

  const data = (await metaRes.json()) as { thumbnailLink?: string };
  if (!data.thumbnailLink) {
    res.status(404).end();
    return;
  }

  // El link viene con un tamaño chico al final (ej. "=s220") — se cambia por uno mas grande.
  // `size` opcional (ej. para la vista previa ampliada de una foto, mas grande que la miniatura
  // de la cuadricula) — se acota entre 100 y 2000 para no pedirle a Drive un numero absurdo.
  const sizeParam = Number(req.query.size);
  const size = Number.isFinite(sizeParam) ? Math.min(2000, Math.max(100, Math.round(sizeParam))) : 400;
  const miniaturaGrande = data.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.redirect(302, miniaturaGrande);
}
