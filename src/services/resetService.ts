import { esModoDemo } from "@/lib/modoDemo";
import { apiFetch } from "@/lib/apiClient";

/** Boton de superadmin "vaciar toda la info" (Configuracion) — ver api/db/admin.ts para la lista
 * exacta de tablas y lo que a proposito NO se toca. */
export async function vaciarTodaLaInfo(): Promise<void> {
  if (esModoDemo) {
    throw new Error("Esto solo aplica con la base de datos real conectada (no en modo demo).");
  }
  await apiFetch("/api/db/admin?action=vaciar", { method: "POST" });
}
