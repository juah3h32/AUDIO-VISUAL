import type { VercelRequest } from "@vercel/node";
import { db, parseJsonObject } from "./turso.js";
import { ErrorAuth, requerirSesion } from "./session.js";

/** Mismo shape que `GestorRequisicionesPermisos` en `src/types/index.ts` — duplicado aqui
 * porque `api/` no importa de `src/` (son dos builds separados: Vite para el frontend, el
 * bundler de funciones de Vercel para `api/`). */
export interface GestorRequisicionesPermisos {
  activo: boolean;
  crearEnNombreDeTerceros: boolean;
  editarDespuesDeEnviar: boolean;
  adjuntarArchivos: boolean;
  verRequisicionesDeOtros: boolean;
  verInfoSolicitante: boolean;
  verInfoProyectoVinculado: boolean;
  verFechasYEstadosProduccion: boolean;
  notificacionesCorreo: boolean;
  notificacionesSistema: boolean;
}

export interface UsuarioFila {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  gestorRequisiciones?: GestorRequisicionesPermisos;
}

/** Carga el usuario autenticado desde Turso (equivalente a `datosUsuario()` en firestore.rules). */
export async function cargarUsuario(uid: string): Promise<UsuarioFila | null> {
  const res = await db().execute({ sql: "SELECT * FROM usuarios WHERE id = ?", args: [uid] });
  const fila = res.rows[0];
  if (!fila) return null;
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    correo: String(fila.correo),
    rol: String(fila.rol),
    gestorRequisiciones: parseJsonObject<GestorRequisicionesPermisos>(fila.gestor_requisiciones),
  };
}

/** Verifica la cookie de sesion Y carga el usuario de la tabla `usuarios`. Lanza ErrorAuth
 * 401/403 si falla. Usar al INICIO de cada endpoint de `api/db/*.ts` y `api/drive-*.ts` — es el
 * equivalente server-side de `usuarioAutenticado()` + `datosUsuario()` de las viejas
 * firestore.rules (ya no aplican, pero la logica de roles que sigue abajo se porto de ahi). */
export async function requerirUsuario(req: VercelRequest): Promise<UsuarioFila> {
  const uid = await requerirSesion(req);
  const usuario = await cargarUsuario(uid);
  if (!usuario) throw new ErrorAuth(403, "Tu cuenta no esta dada de alta en el sistema.");
  return usuario;
}

// --- Funciones de rol, portadas 1:1 de firestore.rules (NO de src/lib/roles.ts, que es mas
// permisivo porque solo decide que se MUESTRA en la UI, no control de acceso real). ---

export function esSuperadmin(u: UsuarioFila): boolean {
  return u.rol === "superadmin";
}

export function esLiderAudiovisual(u: UsuarioFila): boolean {
  return u.rol === "lider_audiovisual";
}

export function esAprobadorDepartamental(u: UsuarioFila): boolean {
  return u.rol === "aprobador_departamental";
}

/** "community" es un rol de verdad; el resto hereda el permiso solo si tiene
 * `gestorRequisiciones.activo === true`. */
export function esGestorRequisiciones(u: UsuarioFila): boolean {
  return u.rol === "community" || u.gestorRequisiciones?.activo === true;
}

export function esGestorDelegado(u: UsuarioFila): boolean {
  return u.gestorRequisiciones?.activo === true;
}

/** true = sin restriccion (no es delegado, o tiene ese permiso prendido). Solo tiene sentido
 * evaluarla DENTRO de una rama que ya sabe que `u` actua como gestor-responsable. */
export function gestorPuede(u: UsuarioFila, permiso: keyof Omit<GestorRequisicionesPermisos, "activo">): boolean {
  if (!esGestorDelegado(u)) return true;
  return u.gestorRequisiciones?.[permiso] === true;
}

export function puedeAprobar(u: UsuarioFila): boolean {
  return esSuperadmin(u) || esLiderAudiovisual(u) || esAprobadorDepartamental(u);
}

export function puedeGestionarUsuarios(u: UsuarioFila): boolean {
  return esSuperadmin(u) || esLiderAudiovisual(u);
}

export function puedeCrearProyectos(u: UsuarioFila): boolean {
  return esSuperadmin(u) || esLiderAudiovisual(u);
}

export function puedeAsignarEntregables(u: UsuarioFila): boolean {
  return esSuperadmin(u) || esLiderAudiovisual(u);
}
