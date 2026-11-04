import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFecha(iso?: string) {
  if (!iso) return "—";
  // Parsear como fecha local (no UTC) para evitar que "2026-10-17" se muestre como 16 oct
  // en zonas horarias detras de UTC (new Date("YYYY-MM-DD") interpreta medianoche UTC).
  const [anio, mes, dia] = iso.split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return "—";
  const d = new Date(anio, mes - 1, dia);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Dia/mes en español para la franja de fecha estilo "calendario de visitas a planta" (misma
 * tarjeta en SalidasPage.tsx y CalendarioPage.tsx) — mismo parseo "fecha local" que formatFecha(). */
export function partesFecha(iso: string) {
  const [anio, mes, dia] = iso.split("T")[0].split("-").map(Number);
  const d = new Date(anio, mes - 1, dia);
  return {
    dia: String(dia).padStart(2, "0"),
    diaSemana: d.toLocaleDateString("es-MX", { weekday: "long" }),
    mes: d.toLocaleDateString("es-MX", { month: "long" }),
  };
}
