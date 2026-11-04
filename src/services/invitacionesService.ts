import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import type { Invitacion } from "@/types";

export async function crearInvitacion(data: Omit<Invitacion, "creadoEn"> & { creadoEn?: string }) {
  if (esModoDemo) return;
  await apiFetch("/api/db/usuarios?sub=invitaciones", { method: "POST", body: JSON.stringify(data) });
}

export async function eliminarInvitacion(correo: string) {
  if (esModoDemo) return;
  await apiFetch(`/api/db/usuarios?sub=invitaciones&correo=${encodeURIComponent(correo)}`, { method: "DELETE" });
}
