import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SignJWT, jwtVerify } from "jose";

export class ErrorAuth extends Error {
  constructor(
    readonly status: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

const COOKIE = "av_session";
const DURACION_SEGUNDOS = 30 * 24 * 60 * 60; // 30 dias — herramienta interna, prioriza comodidad.

function secreto(): Uint8Array {
  const valor = process.env.SESSION_SECRET;
  if (!valor) throw new ErrorAuth(500, "Falta la variable SESSION_SECRET en el servidor.");
  return new TextEncoder().encode(valor);
}

/** Firma una sesion nueva para este usuario (uid = id en la tabla `usuarios`). */
export async function firmarSesion(uid: string): Promise<string> {
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(secreto());
}

/** `Secure` solo fuera de `vercel dev` local (ahi la app corre en http plano y el navegador
 * descartaria una cookie `Secure` sin avisar — se quedaria "logueado" sin sesion real). */
function esProduccionOPreview(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
}

export function setCookieSesion(res: VercelResponse, token: string): void {
  const partes = [
    `${COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${DURACION_SEGUNDOS}`,
  ];
  if (esProduccionOPreview()) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

export function borrarCookieSesion(res: VercelResponse): void {
  const partes = [`${COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (esProduccionOPreview()) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

/** Verifica la cookie de sesion y devuelve el `uid`. Lanza ErrorAuth(401) si falta o no es valida. */
export async function requerirSesion(req: VercelRequest): Promise<string> {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new ErrorAuth(401, "Falta tu sesion de AV Control.");
  try {
    const { payload } = await jwtVerify(token, secreto());
    if (typeof payload.uid !== "string" || !payload.uid) throw new Error("payload invalido");
    return payload.uid;
  } catch {
    throw new ErrorAuth(401, "Tu sesion expiro o no es valida. Vuelve a iniciar sesion.");
  }
}
