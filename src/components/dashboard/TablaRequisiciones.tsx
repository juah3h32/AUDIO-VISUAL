import { Badge } from "@/components/ui/badge";
import { ESTADO_REQUISICION_BADGE, ESTADO_REQUISICION_LABELS, CATEGORIA_CONTENIDO_LABELS } from "@/lib/labels";
import { formatFecha } from "@/lib/utils";
import type { Requisicion } from "@/types";

/**
 * Tabla de requisiciones compartida por las 3 vistas de Inicio (solicitante, aprobador,
 * lider/superadmin) — antes cada una tenia su propia copia casi identica del `<table>`, solo
 * cambiaba la 3ra columna (Tipo de contenido vs. nombre del Solicitante).
 *
 * En `sm:` y mas ancho se ve igual que antes (tabla). Debajo de `sm:` (celular, ~375px) se
 * reemplaza por una tarjeta apilada por fila — mismo lenguaje visual que ya usan las tarjetas de
 * Proyectos/Salidas — en vez de obligar a deslizar de lado para ver la tabla completa.
 */
export function TablaRequisiciones({
  requisiciones,
  terceraColumna,
  mensajeVacio,
}: {
  requisiciones: Requisicion[];
  /** "tipo" = categoria de contenido (vista lider/solicitante). "solicitante" = quien la mando
   * (vista aprobador, donde ya se sabe el tipo por el contexto de su propia cola). */
  terceraColumna: "tipo" | "solicitante";
  mensajeVacio: string;
}) {
  if (requisiciones.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{mensajeVacio}</p>;
  }

  const tituloTercera = terceraColumna === "tipo" ? "Tipo" : "Solicitante";
  const valorTercera = (r: Requisicion) =>
    terceraColumna === "tipo" ? CATEGORIA_CONTENIDO_LABELS[r.tipoContenido] : r.nombreSolicitante;

  return (
    <>
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Folio</th>
            <th className="py-2 font-medium">Título</th>
            <th className="py-2 font-medium">{tituloTercera}</th>
            <th className="py-2 font-medium">Fecha requerida</th>
            <th className="py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {requisiciones.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="py-2.5 font-medium">{r.folio}</td>
              <td className="py-2.5">{r.titulo}</td>
              <td className="py-2.5 text-muted-foreground">{valorTercera(r)}</td>
              <td className="py-2.5 text-muted-foreground">{formatFecha(r.fechaRequerida)}</td>
              <td className="py-2.5">
                <Badge variant={ESTADO_REQUISICION_BADGE[r.estado]}>{ESTADO_REQUISICION_LABELS[r.estado]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-2 sm:hidden">
        {requisiciones.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{r.titulo}</p>
              <Badge variant={ESTADO_REQUISICION_BADGE[r.estado]} className="shrink-0 text-[10px]">
                {ESTADO_REQUISICION_LABELS[r.estado]}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {r.folio} · {valorTercera(r)} · {formatFecha(r.fechaRequerida)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
