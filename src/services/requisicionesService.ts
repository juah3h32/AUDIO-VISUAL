import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import { DEMO_REQUISICIONES } from "@/data/demoData";
import type { EstadoRequisicion, Requisicion } from "@/types";

/** En modo demo opera sobre un arreglo en memoria — se reinicia al recargar la pagina. */
let demoStore: Requisicion[] = [...DEMO_REQUISICIONES];

const masNuevaPrimero = (a: Requisicion, b: Requisicion) => (a.creadoEn < b.creadoEn ? 1 : -1);

/** En real: el SERVIDOR decide el alcance segun el token (ver api/db/requisiciones.ts) — este
 * parametro solo importa en modo demo, donde no hay backend que lo infiera por si solo. */
export type AlcanceRequisiciones = { uid: string } | null;

export async function listarRequisiciones(alcance: AlcanceRequisiciones = null): Promise<Requisicion[]> {
  if (esModoDemo) {
    const visibles = alcance
      ? demoStore.filter((r) => r.solicitanteId === alcance.uid || r.responsableVentaId === alcance.uid)
      : demoStore;
    return [...visibles].sort(masNuevaPrimero);
  }
  return apiFetch<Requisicion[]>("/api/db/requisiciones");
}

function siguienteFolioDemo(): string {
  const nums = demoStore.map((r) => parseInt(r.folio.replace("AV-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `AV-${max + 1}`;
}

export async function crearRequisicion(
  data: Omit<Requisicion, "id" | "folio" | "estado" | "creadoEn" | "actualizadoEn">
): Promise<Requisicion> {
  if (esModoDemo) {
    const ahora = new Date().toISOString();
    const nueva: Requisicion = { ...data, id: `r-${Date.now()}`, folio: siguienteFolioDemo(), estado: "enviada", creadoEn: ahora, actualizadoEn: ahora };
    demoStore = [nueva, ...demoStore];
    return nueva;
  }
  return apiFetch<Requisicion>("/api/db/requisiciones", { method: "POST", body: JSON.stringify(data) });
}

export async function cambiarEstadoRequisicion(id: string, estado: EstadoRequisicion): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((r) =>
      r.id === id
        ? { ...r, estado, actualizadoEn: new Date().toISOString(), ...(estado === "aprobada" ? { aprobadoEn: new Date().toISOString() } : {}) }
        : r
    );
    return;
  }
  await apiFetch(`/api/db/requisiciones?id=${encodeURIComponent(id)}&action=estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
}

/** Solo el lider audiovisual asigna/retira al gestor de requisiciones de una solicitud (ver SECURITY.md). */
export async function asignarGestorRequisicion(id: string, gestor: { id: string; correo: string } | null): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((r) =>
      r.id === id ? { ...r, responsableVentaId: gestor?.id, responsableVentaCorreo: gestor?.correo, actualizadoEn: new Date().toISOString() } : r
    );
    return;
  }
  await apiFetch(`/api/db/requisiciones?id=${encodeURIComponent(id)}&action=gestor`, { method: "PATCH", body: JSON.stringify({ gestor }) });
}
