import { apiFetch } from "@/lib/apiClient";
import { esModoDemo } from "@/lib/modoDemo";

export type ConfiguracionApp = Record<string, string>;

let demoConfig: ConfiguracionApp = {};

export async function obtenerConfiguracion(): Promise<ConfiguracionApp> {
  if (esModoDemo) return { ...demoConfig };
  return apiFetch<ConfiguracionApp>("/api/db/configuracion");
}

export async function actualizarConfiguracion(clave: string, valor: string): Promise<void> {
  if (esModoDemo) {
    demoConfig = { ...demoConfig, [clave]: valor };
    return;
  }
  await apiFetch("/api/db/configuracion", { method: "PATCH", body: JSON.stringify({ clave, valor }) });
}
