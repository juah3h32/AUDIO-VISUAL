import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import { DEMO_ENTREGABLES } from "@/data/demoData";
import type { CategoriaContenido, Entregable, EstadoEntregable } from "@/types";

let demoStore: Entregable[] = [...DEMO_ENTREGABLES];
const demoComentarios: Record<string, ComentarioEntregable[]> = {};

export interface ComentarioEntregable {
  id: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  /** Marcador de tiempo en el video, ej. "0:45" — opcional. */
  momento?: string;
  creadoEn: string;
  /** El responsable ya subio una correccion desde que se dejo esta observacion — no significa
   * que el aprobador ya la revalido, solo que de su lado ya quedo atendida. Se marca solo al
   * subir material de nuevo (ver marcarComentariosCorregidos), nunca a mano. */
  corregido?: boolean;
}

/** Catalogosservice.listarEntregables() lee este mismo arreglo en modo demo — si no, lo creado
 * aqui (crearEntregable/crearEntregableHistorico) nunca aparecia en la lista (cada archivo tenia
 * su propia copia de DEMO_ENTREGABLES, desincronizadas). */
export function demoEntregablesActuales(): Entregable[] {
  return demoStore;
}

export async function crearEntregable(
  data: Omit<Entregable, "id" | "version" | "estado" | "creadoEn">
): Promise<Entregable> {
  if (esModoDemo) {
    const nuevo: Entregable = { ...data, id: `e-${Date.now()}`, version: "v1", estado: "pendiente", creadoEn: new Date().toISOString() };
    demoStore = [nuevo, ...demoStore];
    return nuevo;
  }
  return apiFetch<Entregable>("/api/db/entregables", { method: "POST", body: JSON.stringify(data) });
}

export async function actualizarEntregable(id: string, cambios: Partial<Entregable>): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, ...cambios } : e));
    return;
  }
  await apiFetch(`/api/db/entregables?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(cambios) });
}

export async function asignarProyectoEntregable(id: string, proyectoId: string | null): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, proyectoId: proyectoId ?? undefined } : e));
    return;
  }
  await actualizarEntregable(id, { proyectoId: proyectoId ?? null } as Partial<Entregable>);
}

export async function vincularGuionEntregable(id: string, guionId: string | null): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, guionId: guionId ?? undefined } : e));
    return;
  }
  await actualizarEntregable(id, { guionId: guionId ?? null } as Partial<Entregable>);
}

export async function renombrarEntregable(id: string, nombre: string): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, nombre } : e));
    return;
  }
  await actualizarEntregable(id, { nombre });
}

export async function cambiarTipoEntregable(id: string, tipo: CategoriaContenido): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, tipo } : e));
    return;
  }
  await actualizarEntregable(id, { tipo });
}

export async function eliminarMaterialEntregable(id: string): Promise<void> {
  const limpio = {
    estado: "pendiente" as EstadoEntregable,
    urlRevision: undefined, urlFinal: undefined, urlRevisionAlt: undefined, urlFinalAlt: undefined,
    orientacionVideo: undefined, orientacionVideoAlt: undefined, fotos: undefined,
    aprobadorId: undefined, fechaAprobado: undefined, fechaEntregado: undefined, fechaEnviado: undefined,
  };
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, ...limpio } : e));
    return;
  }
  // El servidor trata `null` como "borrar el campo" (equivalente a deleteField() de Firestore).
  const paraServidor = Object.fromEntries(Object.entries(limpio).map(([k, v]) => [k, v === undefined ? null : v]));
  await actualizarEntregable(id, paraServidor as Partial<Entregable>);
}

export async function eliminarEntregable(id: string): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.filter((e) => e.id !== id);
    delete demoComentarios[id];
    return;
  }
  await apiFetch(`/api/db/entregables?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function reasignarResponsableEntregable(id: string, responsableId: string): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, responsableId } : e));
    return;
  }
  await actualizarEntregable(id, { responsableId });
}

export async function crearEntregableHistorico(
  data: Omit<Entregable, "id" | "version" | "estado" | "creadoEn" | "urlFinal" | "aprobadorId" | "fechaAprobado" | "fechaEntregado">,
  opciones: { estadoFinal: "aprobado" | "entregado"; fecha: string; urlFinal: string; aprobadorId: string }
): Promise<Entregable> {
  if (esModoDemo) {
    const nuevo = await crearEntregable(data as Omit<Entregable, "id" | "version" | "estado" | "creadoEn">);
    const cambios: Partial<Entregable> = {
      estado: opciones.estadoFinal, urlFinal: opciones.urlFinal, aprobadorId: opciones.aprobadorId,
      fechaAprobado: opciones.fecha, creadoEn: opciones.fecha,
      ...(opciones.estadoFinal === "entregado" ? { fechaEntregado: opciones.fecha } : {}),
    };
    await actualizarEntregable(nuevo.id, cambios);
    return { ...nuevo, ...cambios };
  }
  return apiFetch<Entregable>("/api/db/entregables", { method: "POST", body: JSON.stringify({ ...data, opciones }) });
}

/** Solo la PRIMERA subida fija `fechaEnviado`: si luego hay correcciones, la entrega original
 * sigue contando con su fecha (no se vuelve "tarde" por la revision de community). */
export async function enviarARevision(id: string, urlRevision: string, orientacionVideo?: "vertical" | "horizontal"): Promise<void> {
  const yaEnviado = esModoDemo
    ? Boolean(demoStore.find((e) => e.id === id)?.fechaEnviado)
    : Boolean((await apiFetch<Entregable>(`/api/db/entregables?id=${encodeURIComponent(id)}`)).fechaEnviado);
  await actualizarEntregable(id, {
    urlRevision, estado: "en_revision",
    ...(yaEnviado ? {} : { fechaEnviado: new Date().toISOString() }),
    ...(orientacionVideo ? { orientacionVideo } : {}),
  });
}

export async function adjuntarMaterialHistorico(id: string, urlFinal: string, orientacionVideo?: "vertical" | "horizontal"): Promise<void> {
  await actualizarEntregable(id, { urlFinal, ...(orientacionVideo ? { orientacionVideo } : {}) });
}

export async function agregarVersionAlterna(
  id: string, url: string, orientacionVideoAlt: "vertical" | "horizontal", comoHistorico: boolean
): Promise<void> {
  await actualizarEntregable(id, {
    orientacionVideoAlt,
    ...(comoHistorico ? { urlFinalAlt: url } : { urlRevisionAlt: url }),
  });
}

export async function aprobarEntregable(id: string, aprobadorId: string, urlFinal: string, urlFinalAlt?: string): Promise<void> {
  await actualizarEntregable(id, {
    estado: "aprobado", aprobadorId, urlFinal,
    ...(urlFinalAlt ? { urlFinalAlt } : {}),
    fechaAprobado: new Date().toISOString(),
  });
}

export async function solicitarCorrecciones(id: string): Promise<void> {
  await actualizarEntregable(id, { estado: "correcciones" });
}

export async function marcarEntregado(id: string): Promise<void> {
  await actualizarEntregable(id, { estado: "entregado" as EstadoEntregable, fechaEntregado: new Date().toISOString() });
}

export async function cambiarEstadoEntregableDirecto(
  id: string, estado: EstadoEntregable, actual: Pick<Entregable, "fechaAprobado" | "fechaEntregado">
): Promise<void> {
  const cambios: Partial<Entregable> = { estado };
  if (estado === "aprobado" && !actual.fechaAprobado) cambios.fechaAprobado = new Date().toISOString();
  if (estado === "entregado" && !actual.fechaEntregado) cambios.fechaEntregado = new Date().toISOString();
  await actualizarEntregable(id, cambios);
}

export async function actualizarCarpetaFotos(id: string, carpetaFotosUrl: string): Promise<void> {
  await actualizarEntregable(id, { carpetaFotosUrl });
}

export async function marcarFotosParaBorrar(id: string, fotosParaBorrar: string[]): Promise<void> {
  if (esModoDemo) {
    demoStore = demoStore.map((e) => (e.id === id ? { ...e, fotosParaBorrar } : e));
    return;
  }
  await actualizarEntregable(id, { fotosParaBorrar: fotosParaBorrar.length > 0 ? fotosParaBorrar : undefined });
}

export async function guardarFotos(
  id: string, fotos: string[], opciones: { comoHistorico: boolean; carpetaFotosUrl?: string }
): Promise<void> {
  const campoCover = opciones.comoHistorico ? "urlFinal" : "urlRevision";
  if (esModoDemo) {
    demoStore = demoStore.map((e) =>
      e.id === id
        ? {
            ...e, fotos, [campoCover]: fotos[0],
            ...(opciones.carpetaFotosUrl ? { carpetaFotosUrl: opciones.carpetaFotosUrl } : {}),
            ...(opciones.comoHistorico ? {} : { estado: "en_revision" as EstadoEntregable }),
          }
        : e
    );
    return;
  }
  await actualizarEntregable(id, {
    fotos, [campoCover]: fotos[0],
    ...(opciones.carpetaFotosUrl ? { carpetaFotosUrl: opciones.carpetaFotosUrl } : {}),
    ...(opciones.comoHistorico ? {} : { estado: "en_revision" as EstadoEntregable }),
  } as Partial<Entregable>);
}

export async function etiquetarOrientacion(id: string, orientacionVideo: "vertical" | "horizontal"): Promise<void> {
  await actualizarEntregable(id, { orientacionVideo });
}

export async function etiquetarOrientacionAlt(id: string, orientacionVideoAlt: "vertical" | "horizontal"): Promise<void> {
  await actualizarEntregable(id, { orientacionVideoAlt });
}

export async function listarComentarios(entregableId: string): Promise<ComentarioEntregable[]> {
  if (esModoDemo) return demoComentarios[entregableId] ?? [];
  return apiFetch<ComentarioEntregable[]>(`/api/db/entregables?id=${encodeURIComponent(entregableId)}&sub=comentarios`);
}

export async function agregarComentario(
  entregableId: string, data: { autorId: string; autorNombre: string; texto: string; momento?: string }
): Promise<void> {
  if (esModoDemo) {
    const lista = demoComentarios[entregableId] ?? [];
    demoComentarios[entregableId] = [...lista, { id: `c-${Date.now()}`, ...data, creadoEn: new Date().toISOString() }];
    return;
  }
  await apiFetch(`/api/db/entregables?id=${encodeURIComponent(entregableId)}&sub=comentarios`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function marcarComentariosCorregidos(entregableId: string): Promise<void> {
  if (esModoDemo) {
    const lista = demoComentarios[entregableId] ?? [];
    demoComentarios[entregableId] = lista.map((c) => (c.corregido ? c : { ...c, corregido: true }));
    return;
  }
  await apiFetch(`/api/db/entregables?id=${encodeURIComponent(entregableId)}&sub=comentarios&action=marcar-corregidos`, {
    method: "PATCH",
  });
}

/** Convierte un link normal de Google Drive a su variante embebible (iframe). */
export function driveUrlAPreview(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}
