import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { esModoDemo } from "@/lib/modoDemo";
import {
  actualizarGestorRequisiciones,
  actualizarPerfilColaborador,
  actualizarRolUsuario,
  actualizarSalida,
  autorizarSalida,
  crearColaborador,
  crearPlanta,
  crearSalida,
  eliminarSalida,
  eliminarUsuario,
  listarColaboradores,
  listarEntregables,
  listarEquipoAV,
  listarPlantas,
  listarSalidas,
  listarUsuarios,
  reiniciarPasswordUsuario,
  type DecisionSalida,
} from "@/services/catalogosService";
import { crearInvitacion } from "@/services/invitacionesService";
import type { Colaborador, Entregable, Invitacion, Planta, SalidaGrabacion, Usuario } from "@/types";

/**
 * Un solo polling por coleccion para TODA la app, con conteo de referencias — reemplaza el
 * `onSnapshot` en vivo que tenia Firestore (Turso no tiene listeners nativos). Antes cada
 * componente que llamaba useEntregables()/useUsuarios() (paginas, cada dialogo abierto...) abria
 * su PROPIO listener a la coleccion completa; ahora el primero que se monta arranca el poll y el
 * ultimo que se desmonta lo detiene, igual que antes con el conteo de referencias.
 */
const INTERVALO_POLL_MS = 20_000;
const suscripcionesEnVivo = new Map<string, { usuarios: number; cerrar: () => void }>();

function useColeccionEnVivo<T>(nombre: string, queryFn: () => Promise<T[]>) {
  const qc = useQueryClient();
  useEffect(() => {
    if (esModoDemo) return;
    const actual = suscripcionesEnVivo.get(nombre);
    if (actual) {
      actual.usuarios++;
    } else {
      suscripcionesEnVivo.set(nombre, { usuarios: 1, cerrar: abrirPolling<T>(qc, nombre, queryFn) });
    }
    return () => {
      const s = suscripcionesEnVivo.get(nombre);
      if (!s) return;
      if (--s.usuarios === 0) {
        s.cerrar();
        suscripcionesEnVivo.delete(nombre);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, nombre]);
}

function abrirPolling<T>(qc: QueryClient, nombre: string, queryFn: () => Promise<T[]>): () => void {
  const intervalo = setInterval(async () => {
    try {
      qc.setQueryData([nombre], await queryFn());
    } catch {
      // Fallo transitorio — el siguiente tick lo reintenta solo, no hace falta avisar aqui.
    }
  }, INTERVALO_POLL_MS);
  return () => clearInterval(intervalo);
}

export const useSalidas = () => useQuery({ queryKey: ["salidas"], queryFn: listarSalidas });
export const usePlantas = () => useQuery({ queryKey: ["plantas"], queryFn: listarPlantas });

export function useCrearPlanta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Planta, "id" | "creadoEn">) => crearPlanta(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantas"] }),
  });
}

export function useCrearSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SalidaGrabacion, "id" | "folio" | "estadoAutorizacion" | "creadoEn">) =>
      crearSalida(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salidas"] }),
  });
}

export function useAutorizarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estadoAutorizacion }: { id: string; estadoAutorizacion: DecisionSalida }) =>
      autorizarSalida(id, estadoAutorizacion),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salidas"] }),
  });
}

export function useActualizarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<Omit<SalidaGrabacion, "id" | "folio" | "creadoEn">> }) =>
      actualizarSalida(id, cambios),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salidas"] }),
  });
}

export function useEliminarSalida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarSalida(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salidas"] }),
  });
}
/**
 * En vivo (onSnapshot) por la misma razon que useUsuarios(): subir/corregir/aprobar un video
 * pasa en la sesion de quien lo hace, no en la de quien esta viendo el Dashboard en ese momento
 * — con un fetch normal, Inicio se quedaba con numeros viejos hasta refrescar la pagina.
 */
export function useEntregables() {
  useColeccionEnVivo<Entregable>("entregables", listarEntregables);
  return useQuery({ queryKey: ["entregables"], queryFn: listarEntregables });
}
export const useEquipoAV = () => useQuery({ queryKey: ["equipo_av"], queryFn: listarEquipoAV });
export const useColaboradores = () => useQuery({ queryKey: ["colaboradores"], queryFn: listarColaboradores });

export function useCrearColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Omit<Colaborador, "id" | "tareasPendientes" | "cargaEstimada" | "cargaReal" | "proyectosAsignados">
    ) => crearColaborador(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });
}
/**
 * En vivo (onSnapshot), no solo al montar — cuando alguien invitado inicia sesion por primera
 * vez, su doc en "usuarios" se crea en ESE momento (AuthContext.tsx) en la sesion de ESA
 * persona, no en la del admin. Con un fetch normal (`listarUsuarios`/getDocs) el admin se
 * quedaba viendo la lista vieja hasta refrescar o que venciera el staleTime — por eso un
 * colaborador recien invitado "no salia solo" en Equipo/Inicio. El onSnapshot empuja el cambio
 * al cache de react-query al instante, sin que nadie tenga que hacer nada manual.
 */
export function useUsuarios() {
  useColeccionEnVivo<Usuario>("usuarios", listarUsuarios);
  return useQuery({ queryKey: ["usuarios"], queryFn: listarUsuarios });
}

export function useInvitarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Invitacion, "creadoEn">) => crearInvitacion(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useActualizarGestorRequisiciones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, gestorRequisiciones }: { id: string; gestorRequisiciones: Usuario["gestorRequisiciones"] }) =>
      actualizarGestorRequisiciones(id, gestorRequisiciones),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useActualizarPerfilColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ colaborador, cambios }: { colaborador: Colaborador; cambios: { especialidades: string[]; puesto: string } }) =>
      actualizarPerfilColaborador(colaborador, cambios),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
  });
}

export function useActualizarRolUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rol }: { id: string; rol: Usuario["rol"] }) => actualizarRolUsuario(id, rol),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useReiniciarPasswordUsuario() {
  return useMutation({ mutationFn: (usuarioId: string) => reiniciarPasswordUsuario(usuarioId) });
}

export function useEliminarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => eliminarUsuario(usuarioId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}
