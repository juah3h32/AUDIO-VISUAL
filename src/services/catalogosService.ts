import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";
import { DEMO_COLABORADORES, DEMO_EQUIPO_AV, DEMO_SALIDAS, DEMO_USUARIOS } from "@/data/demoData";
import { demoEntregablesActuales } from "@/services/entregablesService";
import type {
  Colaborador,
  Entregable,
  EquipoAV,
  EstadoAutorizacionSalida,
  SalidaGrabacion,
  Usuario,
} from "@/types";

/** Una salida solo se resuelve hacia autorizada o rechazada — nunca "de vuelta a pendiente". */
export type DecisionSalida = Exclude<EstadoAutorizacionSalida, "pendiente">;

export async function listarEntregables(): Promise<Entregable[]> {
  if (esModoDemo) return [...demoEntregablesActuales()];
  return apiFetch<Entregable[]>("/api/db/entregables");
}

let demoSalidas: SalidaGrabacion[] = [...DEMO_SALIDAS];

export const listarSalidas = async (): Promise<SalidaGrabacion[]> => {
  if (esModoDemo) {
    return [...demoSalidas].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }
  return apiFetch<SalidaGrabacion[]>("/api/db/salidas");
};

function siguienteFolioSalidaDemo(): string {
  const nums = demoSalidas.map((s) => parseInt(s.folio.replace("SAL-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 100;
  return `SAL-${max + 1}`;
}

export async function crearSalida(
  data: Omit<SalidaGrabacion, "id" | "folio" | "estadoAutorizacion" | "creadoEn">
): Promise<SalidaGrabacion> {
  if (esModoDemo) {
    const nueva: SalidaGrabacion = {
      ...data,
      id: `s-${Date.now()}`,
      folio: siguienteFolioSalidaDemo(),
      estadoAutorizacion: "pendiente",
      creadoEn: new Date().toISOString(),
    };
    demoSalidas = [nueva, ...demoSalidas];
    return nueva;
  }
  return apiFetch<SalidaGrabacion>("/api/db/salidas", { method: "POST", body: JSON.stringify(data) });
}

export async function autorizarSalida(id: string, estadoAutorizacion: DecisionSalida): Promise<void> {
  if (esModoDemo) {
    demoSalidas = demoSalidas.map((s) => (s.id === id ? { ...s, estadoAutorizacion } : s));
    return;
  }
  await apiFetch(`/api/db/salidas?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ estadoAutorizacion }),
  });
}

export const listarEquipoAV = async (): Promise<EquipoAV[]> => {
  if (esModoDemo) return [...DEMO_EQUIPO_AV];
  return apiFetch<EquipoAV[]>("/api/db/equipo?tipo=equipo_av");
};

export const listarUsuarios = async (): Promise<Usuario[]> => {
  if (esModoDemo) return [...DEMO_USUARIOS];
  return apiFetch<Usuario[]>("/api/db/usuarios");
};

let demoColaboradores: Colaborador[] = [...DEMO_COLABORADORES];

export const listarColaboradores = async (): Promise<Colaborador[]> => {
  if (esModoDemo) return [...demoColaboradores];
  return apiFetch<Colaborador[]>("/api/db/equipo");
};

/** No existia ninguna forma de dar de alta un colaborador — por eso la carga del equipo en
 * Inicio/Equipo se quedaba siempre en 0 en cuentas reales (la coleccion "colaboradores" nunca
 * se llenaba, a diferencia de modo demo que trae datos de muestra fijos). */
export async function crearColaborador(
  data: Omit<Colaborador, "id" | "tareasPendientes" | "cargaEstimada" | "cargaReal" | "proyectosAsignados">
): Promise<Colaborador> {
  const nuevo = { ...data, tareasPendientes: 0, cargaEstimada: 0, cargaReal: 0, proyectosAsignados: [] };
  if (esModoDemo) {
    const conId: Colaborador = { ...nuevo, id: `col-${Date.now()}` };
    demoColaboradores = [conId, ...demoColaboradores];
    return conId;
  }
  return apiFetch<Colaborador>("/api/db/equipo", { method: "POST", body: JSON.stringify(nuevo) });
}

export async function actualizarGestorRequisiciones(
  usuarioId: string,
  gestorRequisiciones: Usuario["gestorRequisiciones"]
) {
  if (esModoDemo) return;
  await apiFetch(`/api/db/usuarios?id=${encodeURIComponent(usuarioId)}`, {
    method: "PATCH",
    body: JSON.stringify({ gestorRequisiciones }),
  });
}

/** Especialidades/puesto que el lider asigna en Equipo. Cuenta real -> "usuarios" (lo que lee
 * todo el sistema); externo sin cuenta -> su registro en "colaboradores". */
export async function actualizarPerfilColaborador(
  colaborador: Pick<Colaborador, "id" | "tieneCuenta">,
  cambios: { especialidades: string[]; puesto: string }
) {
  if (esModoDemo) {
    if (colaborador.tieneCuenta) {
      const i = DEMO_USUARIOS.findIndex((u) => u.id === colaborador.id);
      if (i >= 0) DEMO_USUARIOS[i] = { ...DEMO_USUARIOS[i], ...cambios };
    } else {
      demoColaboradores = demoColaboradores.map((c) => (c.id === colaborador.id ? { ...c, ...cambios } : c));
    }
    return;
  }
  const params = new URLSearchParams({ tipo: "perfil", id: colaborador.id, tieneCuenta: colaborador.tieneCuenta ? "1" : "0" });
  await apiFetch(`/api/db/equipo?${params.toString()}`, { method: "PATCH", body: JSON.stringify(cambios) });
}

export async function actualizarRolUsuario(usuarioId: string, rol: Usuario["rol"]) {
  if (esModoDemo) return;
  await apiFetch(`/api/db/usuarios?id=${encodeURIComponent(usuarioId)}`, {
    method: "PATCH",
    body: JSON.stringify({ rol }),
  });
}

/** No hay "olvide mi contraseña" con correo (no hay servicio de envio configurado) — en su lugar
 * un admin reinicia la cuenta a "pendiente de activar", igual que una invitacion nueva: la
 * persona entra a login con su correo y crea una contraseña de nuevo, sin perder rol ni historial. */
export async function reiniciarPasswordUsuario(usuarioId: string): Promise<void> {
  if (esModoDemo) return;
  await apiFetch(`/api/db/usuarios?id=${encodeURIComponent(usuarioId)}&action=reiniciar-password`, {
    method: "PATCH",
  });
}
