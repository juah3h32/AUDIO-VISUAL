/** El backend (`api/auth/*`) ya devuelve mensajes en español listos para mostrar — esto solo
 * cubre el caso de un error sin mensaje util (red caida, etc). */
export function mensajeErrorAuth(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Ocurrio un error inesperado.";
}
