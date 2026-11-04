import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OAuth2Client } from "google-auth-library";
import { ErrorAuth, requerirSesion } from "./_shared/session";
import { db } from "./_shared/turso";

/**
 * Centraliza TODAS las subidas en el Drive PERSONAL de pablocorona111@gmail.com, en vez de la
 * cuenta de quien este logueado en ese momento — asi el material de la empresa no queda
 * repartido en el Drive personal de cada colaborador que suba algo.
 *
 * Como es una cuenta Gmail normal (no Workspace), no aplica domain-wide delegation — se usa un
 * REFRESH TOKEN que pablocorona111 genero UNA sola vez autorizando el acceso (ver
 * `api/drive-authorize.ts`). Ese token no vence solo; el backend lo cambia por un access token
 * nuevo cada vez que hace falta. Requiere `GOOGLE_DRIVE_OWNER_CLIENT_ID`,
 * `GOOGLE_DRIVE_OWNER_CLIENT_SECRET` y `GOOGLE_DRIVE_OWNER_REFRESH_TOKEN` configuradas — sin eso
 * esto falla con un error claro, no es un bug de este codigo, es el setup pendiente.
 *
 * Flujo completo (ver tambien `src/services/driveService.ts` -> `subirArchivoCentralizado`):
 * este endpoint resuelve/crea la carpeta destino y abre una SESION de subida reanudable
 * (`uploadType=resumable`) con la cuenta del dueño. El NAVEGADOR sube los bytes del archivo
 * DIRECTO a esa URL (PUT) — un video grande nunca pasa por esta funcion serverless (evita el
 * limite de tamaño de body de Vercel) y de todos modos el archivo queda en la cuenta central, no
 * en la de quien subio.
 */

let clienteCacheado: { token: string; vence: number } | null = null;

async function obtenerTokenPropietario(): Promise<string> {
  if (clienteCacheado && clienteCacheado.vence > Date.now() + 60_000) return clienteCacheado.token;

  const clientId = process.env.GOOGLE_DRIVE_OWNER_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_OWNER_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_OWNER_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan GOOGLE_DRIVE_OWNER_CLIENT_ID / GOOGLE_DRIVE_OWNER_CLIENT_SECRET / GOOGLE_DRIVE_OWNER_REFRESH_TOKEN. Corre /api/drive-authorize primero."
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
 * El rol vive en Turso (`usuarios.rol`), se lee directo con el cliente de la base. Antes este
 * endpoint solo exigia estar logueado: cualquier rol podia abrir una sesion de subida y, con
 * `fileIdExistente` de un entregable ajeno, sobreescribir su contenido. Mismo filtro que ya
 * aplica el cliente en `puedeSubirVideos` (`src/lib/roles.ts`), pero ahora tambien server-side.
 */
async function verificarRolAutorizado(uid: string): Promise<void> {
  const res = await db().execute({ sql: "SELECT rol FROM usuarios WHERE id = ?", args: [uid] });
  const rol = res.rows[0]?.rol ? String(res.rows[0].rol) : null;
  if (!rol || !ROLES_PUEDEN_SUBIR_MATERIAL.has(rol)) {
    throw new ErrorAuth(403, "Tu rol no tiene permiso para subir material a Drive.");
  }
}

const CARPETA_RAIZ = "AV Control";

async function buscarCarpeta(nombre: string, token: string, parentId: string | null): Promise<string | null> {
  const escapado = nombre.replace(/'/g, "\\'");
  const condiciones = [
    `name='${escapado}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ];
  const q = encodeURIComponent(condiciones.join(" and "));
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`No se pudo buscar la carpeta "${nombre}" (${res.status}).`);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

async function crearCarpeta(nombre: string, token: string, parentId: string | null): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`No se pudo crear la carpeta "${nombre}" (${res.status}).`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function obtenerOCrearCarpeta(nombre: string, token: string, parentId: string | null = null): Promise<string> {
  const existente = await buscarCarpeta(nombre, token, parentId);
  if (existente) return existente;
  return crearCarpeta(nombre, token, parentId);
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

  const body = req.body as {
    nombre?: string;
    nombreCarpeta?: string;
    subcarpeta?: string;
    carpetaIdDestino?: string;
    fileIdExistente?: string;
  };
  if (!body?.nombre) {
    res.status(400).json({ error: "Falta el nombre del archivo." });
    return;
  }

  let token: string;
  try {
    token = await obtenerTokenPropietario();
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "No se pudo autenticar con la cuenta central de Drive.",
    });
    return;
  }

  try {
    // Reemplazar el contenido de `fileIdExistente` en el MISMO archivo — solo si se pide
    // explicitamente (el cliente no lo pide en el reintento tras un 403 a medias, ver
    // `subirArchivoCentralizado` en driveService.ts). Esto SOLO funciona si la cuenta central ya
    // es dueña de ese archivo (se creo despues de centralizar); para uno de ANTES (vivia en el
    // Drive personal de quien lo subio entonces), Drive puede dejar ABRIR esta sesion pero
    // rechazar el PUT de los bytes ya avanzada la subida — ese caso lo detecta y resuelve el
    // CLIENTE (no se puede saber aqui, la sesion en si se abre bien).
    if (body.fileIdExistente) {
      const sesionRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${body.fileIdExistente}?uploadType=resumable&fields=id`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ name: body.nombre }),
        }
      );
      if (sesionRes.ok) {
        const sessionUrl = sesionRes.headers.get("location");
        if (!sessionUrl) {
          res.status(502).json({ error: "Drive no entrego la URL de sesion." });
          return;
        }
        res.status(200).json({ sessionUrl, carpetaId: null });
        return;
      }
      if (sesionRes.status !== 403 && sesionRes.status !== 404) {
        res.status(sesionRes.status).json({ error: "No se pudo abrir la sesion de subida (reemplazo)." });
        return;
      }
      // 403/404 al ABRIR la sesion (no al subir bytes): sigue de largo, crea uno nuevo.
    }

    let carpetaId = body.carpetaIdDestino ?? null;
    if (!carpetaId) {
      const raizId = await obtenerOCrearCarpeta(CARPETA_RAIZ, token);
      const carpetaProyectoId = await obtenerOCrearCarpeta(body.nombreCarpeta || "Sin proyecto", token, raizId);
      carpetaId = body.subcarpeta
        ? await obtenerOCrearCarpeta(body.subcarpeta, token, carpetaProyectoId)
        : carpetaProyectoId;
    }

    const sesionRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name: body.nombre, parents: [carpetaId] }),
    });
    if (!sesionRes.ok) {
      res.status(sesionRes.status).json({ error: "No se pudo abrir la sesion de subida." });
      return;
    }
    const sessionUrl = sesionRes.headers.get("location");
    if (!sessionUrl) {
      res.status(502).json({ error: "Drive no entrego la URL de sesion." });
      return;
    }
    res.status(200).json({ sessionUrl, carpetaId });
  } catch {
    res.status(502).json({ error: "No se pudo hablar con Drive." });
  }
}
