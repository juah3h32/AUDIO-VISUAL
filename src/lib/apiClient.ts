/** Fetch autenticado contra `/api/db/*` y `/api/auth/*` — la cookie de sesion (httpOnly) viaja
 * sola con `credentials: "include"`, no hace falta armar ningun header a mano. */
export async function apiFetch<T>(path: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opciones,
    credentials: "include",
    headers: {
      ...(opciones.body ? { "Content-Type": "application/json" } : {}),
      ...opciones.headers,
    },
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
