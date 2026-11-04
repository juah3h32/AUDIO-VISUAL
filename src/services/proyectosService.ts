import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import { DEMO_PROYECTOS } from "@/data/demoData";
import type { Proyecto } from "@/types";

let demoStore: Proyecto[] = [...DEMO_PROYECTOS];

export async function listarProyectos(): Promise<Proyecto[]> {
  if (esModoDemo) {
    return [...demoStore].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }
  return apiFetch<Proyecto[]>("/api/db/proyectos");
}

function siguienteFolioDemo(): string {
  const nums = demoStore.map((p) => parseInt(p.folio.replace("PRY-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 100;
  return `PRY-${max + 1}`;
}

export async function crearProyecto(
  data: Omit<Proyecto, "id" | "folio" | "etapaActual" | "porcentajeAvance" | "creadoEn" | "actualizadoEn">
): Promise<Proyecto> {
  if (esModoDemo) {
    const ahora = new Date().toISOString();
    const nuevo: Proyecto = {
      ...data, id: `p-${Date.now()}`, folio: siguienteFolioDemo(), etapaActual: "planeacion",
      porcentajeAvance: 0, creadoEn: ahora, actualizadoEn: ahora,
    };
    demoStore = [nuevo, ...demoStore];
    return nuevo;
  }
  return apiFetch<Proyecto>("/api/db/proyectos", { method: "POST", body: JSON.stringify(data) });
}

export async function actualizarProyecto(id: string, cambios: Partial<Proyecto>): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((p) => (p.id === id ? { ...p, ...cambios } : p));
    return;
  }
  await apiFetch(`/api/db/proyectos?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(cambios) });
}

export async function eliminarProyecto(id: string): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.filter((p) => p.id !== id);
    return;
  }
  await apiFetch(`/api/db/proyectos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
