import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ErrorAuth, requerirSesion } from "./_shared/session.js";
import { db } from "./_shared/turso.js";

/**
 * Reenvia UN PEDAZO (chunk) de un archivo a una sesion de subida reanudable de Drive ya abierta
 * (ver `drive-upload-session.ts`). Existe porque el navegador NO puede subir directo a
 * `www.googleapis.com` (la API de Drive, a diferencia de Cloud Storage, no responde CORS en sus
 * URLs de sesion reanudable — `Access-Control-Allow-Origin` ausente, el navegador bloquea el
 * PUT). Asi que el archivo pasa por AQUI, pero en pedazos chicos (`TAMANO_CHUNK` en el cliente,
 * ver `subirBytesPorChunks` en `src/services/driveService.ts`) para no chocar con el limite de
 * tamaño de body de las funciones serverless de Vercel (~4.5 MB) — un video de cualquier tamaño
 * sube igual, solo que en varias llamadas en vez de una.
 *
 * El `sessionUrl` viaja en un header propio (no se reconstruye aqui) y se valida que apunte a
 * Drive antes de reenviar nada — sin eso, cualquiera podria usar esto como proxy generico a
 * cualquier URL.
 */

const ROLES_PUEDEN_SUBIR_MATERIAL = new Set(["superadmin", "lider_audiovisual", "colaborador_audiovisual"]);

/**
 * Mismo filtro de rol que `drive-upload-session.ts` (defensa en profundidad: aunque abrir la
 * sesion ya este restringido, este endpoint reenvia bytes a CUALQUIER sessionUrl de Drive que le
 * pasen en el header, asi que tambien exige rol valido en vez de solo "esta logueado").
 */
async function verificarRolAutorizado(uid: string): Promise<void> {
  const res = await db().execute({ sql: "SELECT rol FROM usuarios WHERE id = ?", args: [uid] });
  const rol = res.rows[0]?.rol ? String(res.rows[0].rol) : null;
  if (!rol || !ROLES_PUEDEN_SUBIR_MATERIAL.has(rol)) {
    throw new ErrorAuth(403, "Tu rol no tiene permiso para subir material a Drive.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") {
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

  const sessionUrl = req.headers["x-session-url"];
  if (typeof sessionUrl !== "string" || !sessionUrl.startsWith("https://www.googleapis.com/upload/drive/v3/files")) {
    res.status(400).json({ error: "Falta o es invalida la sesion de subida (x-session-url)." });
    return;
  }

  const contentRange = req.headers["content-range"];
  if (typeof contentRange !== "string") {
    res.status(400).json({ error: "Falta el header content-range." });
    return;
  }
  // El total del archivo viaja en cada pedazo ("bytes 0-3145727/104857600") — se puede topar el
  // tamaño sin esperar a que termine toda la subida ni llevar un contador aparte.
  const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024 * 1024;
  const totalDeclarado = /\/(\d+)$/.exec(contentRange)?.[1];
  if (totalDeclarado && Number(totalDeclarado) > TAMANO_MAXIMO_BYTES) {
    res.status(413).json({ error: "El archivo excede el limite de 5 GB." });
    return;
  }

  // Con Content-Type "application/octet-stream" (lo manda el cliente), @vercel/node entrega el
  // body ya como Buffer crudo — no hace falta parsear nada aqui.
  const body = req.body as Buffer | undefined;
  if (!body || !Buffer.isBuffer(body)) {
    res.status(400).json({ error: "Cuerpo de la peticion invalido (se esperaban bytes crudos)." });
    return;
  }

  let googleRes: Response;
  try {
    googleRes = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Range": contentRange, "Content-Length": String(body.length) },
      body: body as unknown as BodyInit,
    });
  } catch {
    res.status(502).json({ error: "No se pudo hablar con Drive." });
    return;
  }

  const texto = await googleRes.text();
  res.status(googleRes.status);
  const rango = googleRes.headers.get("range");
  if (rango) res.setHeader("Range", rango);
  res.setHeader("Content-Type", googleRes.headers.get("content-type") || "application/json");
  res.send(texto);
}
