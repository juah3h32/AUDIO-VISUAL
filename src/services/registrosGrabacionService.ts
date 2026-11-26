import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import type { RegistroGrabacion } from "@/types";

let demoRegistros: RegistroGrabacion[] = [];

export async function listarRegistrosGrabacion(): Promise<RegistroGrabacion[]> {
  if (esModoDemo) return [...demoRegistros].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return apiFetch<RegistroGrabacion[]>("/api/db/registros-grabacion");
}

export async function crearRegistroGrabacion(
  data: Omit<RegistroGrabacion, "id" | "creadoEn" | "creadoPorId">,
  creadoPorId: string
): Promise<RegistroGrabacion> {
  if (esModoDemo) {
    const nuevo: RegistroGrabacion = { ...data, id: `rg-${Date.now()}`, creadoPorId, creadoEn: new Date().toISOString() };
    demoRegistros = [nuevo, ...demoRegistros];
    return nuevo;
  }
  return apiFetch<RegistroGrabacion>("/api/db/registros-grabacion", { method: "POST", body: JSON.stringify(data) });
}

export async function eliminarRegistroGrabacion(id: string): Promise<void> {
  if (esModoDemo) {
    demoRegistros = demoRegistros.filter((r) => r.id !== id);
    return;
  }
  await apiFetch(`/api/db/registros-grabacion?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
