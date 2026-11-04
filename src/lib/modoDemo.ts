/**
 * Antes el modo demo se activaba solo (sin API key real de Firebase configurada). Ahora que el
 * backend es Turso detras de `/api/db/*` (siempre disponible si el servidor esta configurado),
 * ya no hay una forma automatica de detectarlo desde el navegador — es una bandera explicita
 * para quien quiera correr la app sin backend real (demo/offline), por defecto apagada.
 */
export const esModoDemo = import.meta.env.VITE_DEMO_MODE === "true";
