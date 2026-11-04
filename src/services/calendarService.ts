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

/** `2026-03-05T09:00:00` -> `2026-03-06T09:00:00` (misma hora, dia siguiente). */
function sumarUnDia(fechaHoraIso: string): string {
  const [fecha, hora] = fechaHoraIso.split("T");
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const siguiente = new Date(anio, mes - 1, dia + 1);
  const mesStr = String(siguiente.getMonth() + 1).padStart(2, "0");
  const diaStr = String(siguiente.getDate()).padStart(2, "0");
  return `${siguiente.getFullYear()}-${mesStr}-${diaStr}T${hora}`;
}

/** `2026-03-05T09:00:00` -> `20260305T090000` (formato que exige el parametro `dates`). */
function aFormatoCalendar(fechaHoraIso: string): string {
  return fechaHoraIso.replace(/[-:]/g, "");
}

export function linkAgregarEventoCalendar(salida: SalidaGrabacion): string {
  const inicio = horaCombinada(salida.fecha, salida.horaSalida) ?? `${salida.fecha}T09:00:00`;
  const finHora = salida.horaRegreso ?? salida.horaEstimadaFinalizacion ?? salida.horaEstimadaLlegada;
  let fin = horaCombinada(salida.fecha, finHora) ?? `${salida.fecha}T18:00:00`;
  // Jornada que cruza medianoche (ej. sale 22:00, llega 01:00): la hora de fin queda en el MISMO
  // "fecha" de la salida, antes que el inicio — sin esto el evento quedaba con fin < inicio.
  if (fin <= inicio) fin = sumarUnDia(fin);

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
