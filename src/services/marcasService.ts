import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import { DEMO_MARCAS } from "@/data/demoData";
import type { Marca } from "@/types";

let demoStore: Marca[] = [...DEMO_MARCAS];

export async function listarMarcas(): Promise<Marca[]> {
  if (esModoDemo) {
    return [...demoStore].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }
  return apiFetch<Marca[]>("/api/db/marcas");
}

export async function crearMarca(
  data: Omit<Marca, "id" | "creadoEn" | "actualizadoEn">
): Promise<Marca> {
  if (esModoDemo) {
    const ahora = new Date().toISOString();
    const nueva: Marca = { ...data, id: `mrc-${Date.now()}`, creadoEn: ahora, actualizadoEn: ahora };
    demoStore = [nueva, ...demoStore];
    return nueva;
  }
  return apiFetch<Marca>("/api/db/marcas", { method: "POST", body: JSON.stringify(data) });
}

export async function actualizarMarca(id: string, cambios: Partial<Marca>): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((m) => (m.id === id ? { ...m, ...cambios } : m));
    return;
  }
  await apiFetch(`/api/db/marcas?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
}

export async function eliminarMarca(id: string): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.filter((m) => m.id !== id);
    return;
  }
  await apiFetch(`/api/db/marcas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
