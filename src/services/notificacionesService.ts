import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import type { Notificacion } from "@/types";

const INTERVALO_POLL_MS = 15_000;

export async function crearNotificacion(data: Omit<Notificacion, "id" | "leida" | "creadoEn">): Promise<void> {
  if (esModoDemo) return;
  await apiFetch("/api/db/notificaciones", { method: "POST", body: JSON.stringify(data) });
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  if (esModoDemo) return;
  await apiFetch(`/api/db/notificaciones?id=${encodeURIComponent(id)}`, { method: "PATCH" });
}

/** Antes escuchaba en vivo (onSnapshot) — Turso no tiene listeners nativos, asi que esto hace
 * polling cada 15s. Misma firma (devuelve la funcion para cancelar) para que nadie mas se entere
 * del cambio. */
export function escucharNotificaciones(
  usuarioId: string,
  onCambio: (notificaciones: Notificacion[]) => void
): () => void {
  if (esModoDemo) return () => {};

  let vivo = true;
  const consultar = async () => {
    try {
      const notificaciones = await apiFetch<Notificacion[]>(`/api/db/notificaciones?paraUsuarioId=${encodeURIComponent(usuarioId)}`);
      if (vivo) onCambio(notificaciones);
    } catch {
      // Fallo transitorio — el siguiente tick lo reintenta solo.
    }
  };

  consultar();
  const intervalo = setInterval(consultar, INTERVALO_POLL_MS);
  return () => {
    vivo = false;
    clearInterval(intervalo);
  };
}
