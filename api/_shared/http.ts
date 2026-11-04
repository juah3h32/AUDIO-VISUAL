import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ErrorAuth } from "./session";

/** Envuelve un handler de endpoint: atrapa `ErrorAuth` (401/403/500 con mensaje claro) y
 * cualquier otro error (500 generico) para que ningun endpoint de `api/db/*.ts` deje un request
 * colgado o regrese HTML/vacio en vez de JSON. */
export async function manejarApi(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => Promise<void>
): Promise<void> {
  try {
    await handler();
  } catch (err) {
    if (err instanceof ErrorAuth) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error en api/db:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno." });
  }
}

export function cuerpoJson<T = Record<string, unknown>>(req: VercelRequest): T {
  return (typeof req.body === "object" && req.body ? req.body : {}) as T;
}
