import type { SalidaGrabacion } from "@/types";

/**
 * Link a Google Calendar con el evento pre-llenado para UNA salida — quien le de click en
 * "Agregar a mi Google Calendar" (`SalidasPage.tsx`) lo abre en pestaña nueva y le da "Guardar"
 * el mismo, ya en su propia cuenta. Sin OAuth: es el link publico de plantilla de evento
 * (`calendar.google.com/calendar/render?action=TEMPLATE`), nadie decide por nadie ni se agrega
 * nada de forma automatica.
 */

const ZONA_HORARIA = "America/Mexico_City";

function horaCombinada(fecha: string, hora?: string): string | null {
  if (!hora) return null;
  const horaNormalizada = hora.length === 5 ? `${hora}:00` : hora;
  return `${fecha}T${horaNormalizada}`;
}

/** `2026-03-05T09:00:00` -> `20260305T090000` (formato que exige el parametro `dates`). */
function aFormatoCalendar(fechaHoraIso: string): string {
  return fechaHoraIso.replace(/[-:]/g, "");
}

export function linkAgregarEventoCalendar(salida: SalidaGrabacion): string {
  const inicio = horaCombinada(salida.fecha, salida.horaSalida) ?? `${salida.fecha}T09:00:00`;
  const finHora = salida.horaRegreso ?? salida.horaEstimadaFinalizacion ?? salida.horaEstimadaLlegada;
  const fin = horaCombinada(salida.fecha, finHora) ?? `${salida.fecha}T18:00:00`;

  const detalles = [
    salida.folio,
    salida.contactoPlanta ? `Contacto: ${salida.contactoPlanta}` : null,
    salida.telefonoContacto ? `Tel: ${salida.telefonoContacto}` : null,
    salida.observaciones ?? null,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: salida.nombreJornada,
    dates: `${aFormatoCalendar(inicio)}/${aFormatoCalendar(fin)}`,
    ctz: ZONA_HORARIA,
  });
  if (detalles) params.set("details", detalles);
  const ubicacion = [salida.planta, salida.direccion].filter(Boolean).join(" — ");
  if (ubicacion) params.set("location", ubicacion);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
