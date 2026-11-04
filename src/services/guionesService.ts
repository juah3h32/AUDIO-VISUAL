import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import type { Guion } from "@/types";

let demoStore: Guion[] = [];
const demoComentarios: Record<string, ComentarioGuion[]> = {};

export interface ComentarioGuion {
  id: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  creadoEn: string;
}

export async function listarGuiones(): Promise<Guion[]> {
  if (esModoDemo) {
    return [...demoStore].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }
  return apiFetch<Guion[]>("/api/db/guiones");
}

export async function crearGuion(data: Omit<Guion, "id" | "folio" | "estado" | "creadoEn">): Promise<Guion> {
  if (esModoDemo) {
    const nuevo: Guion = { ...data, id: `g-${Date.now()}`, folio: `GN-${101 + demoStore.length}`, estado: "borrador", creadoEn: new Date().toISOString() };
    demoStore = [nuevo, ...demoStore];
    return nuevo;
  }
  return apiFetch<Guion>("/api/db/guiones", { method: "POST", body: JSON.stringify(data) });
}

async function actualizarGuion(id: string, cambios: Partial<Guion>): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((g) => (g.id === id ? { ...g, ...cambios } : g));
    return;
  }
  await apiFetch(`/api/db/guiones?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(cambios) });
}

export const enviarGuionARevision = (id: string) => actualizarGuion(id, { estado: "en_revision" });
export const aprobarGuion = (id: string, aprobadorId: string) => actualizarGuion(id, { estado: "aprobado", aprobadorId });
export const solicitarCorreccionesGuion = (id: string) => actualizarGuion(id, { estado: "correcciones" });

export async function listarComentariosGuion(guionId: string): Promise<ComentarioGuion[]> {
  if (esModoDemo) return demoComentarios[guionId] ?? [];
  return apiFetch<ComentarioGuion[]>(`/api/db/guiones?id=${encodeURIComponent(guionId)}&sub=comentarios`);
}

export async function agregarComentarioGuion(
  guionId: string,
  data: { autorId: string; autorNombre: string; texto: string }
): Promise<void> {
  if (esModoDemo) {
    const lista = demoComentarios[guionId] ?? [];
    demoComentarios[guionId] = [...lista, { id: `c-${Date.now()}`, ...data, creadoEn: new Date().toISOString() }];
    return;
  }
  await apiFetch(`/api/db/guiones?id=${encodeURIComponent(guionId)}&sub=comentarios`, { method: "POST", body: JSON.stringify(data) });
}
