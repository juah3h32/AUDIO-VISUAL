import { useMemo, useState } from "react";
import { useEntregables } from "@/hooks/useCatalogos";
import { iniciales } from "@/lib/avatar";
import { CATEGORIA_CONTENIDO_LABELS, etiquetaEstadoEntregable, ESTADO_ENTREGABLE_BADGE } from "@/lib/labels";
import { aFecha } from "@/lib/periodo";
import { avanceDe, semana } from "@/lib/rendimiento";
import { formatFecha } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvanceEntregable } from "@/components/entregables/AvanceEntregable";

/** Lo que YO tengo asignado (colaboradores y tambien el lider: cambios web, diseño...) — abiertas y lo
 * cerrado esta semana, con el control para reportar mi avance real de cada una. Se muestra en Inicio
 * (todos) y en Rendimiento (lider); no aparece si la persona no tiene trabajos. */
export function MisAvances({
  usuarioId,
  nombre,
  puesto,
  compacto,
}: {
  usuarioId: string;
  nombre: string;
  puesto?: string;
  /** Para meterla junto a otras tarjetas en una fila de 3 (Inicio del colaborador) — menos filas
   * visibles, sin el texto de puesto y cada fila apilada en vez de en linea (el nombre + badge +
   * barra en una sola linea no cabe en un tercio del ancho). */
  compacto?: boolean;
}) {
  const { data: entregables = [] } = useEntregables();
  const hoyKey = new Date().toDateString();
  const estaSemana = useMemo(() => semana(0), [hoyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [verTodas, setVerTodas] = useState(false);

  const mias = useMemo(
    () =>
      entregables
        .filter((e) => e.responsableId === usuarioId)
        .filter((e) => {
          const cerrado = e.estado === "aprobado" || e.estado === "entregado";
          if (!cerrado) return true;
          const fecha = aFecha(e.fechaEntregado ?? e.fechaAprobado);
          return fecha >= estaSemana.inicio && fecha < estaSemana.fin;
        })
        // Por fecha compromiso (no por avance): si no, la fila "saltaba" de lugar al mover su barra.
        .sort((a, b) => (a.fechaCompromiso ?? "").localeCompare(b.fechaCompromiso ?? "")),
    [entregables, usuarioId, estaSemana]
  );

  if (mias.length === 0) return null;
  const promedio = Math.round(mias.reduce((s, e) => s + avanceDe(e), 0) / mias.length);

  const limite = compacto ? 4 : 6;

  return (
    <Card className="flex h-full flex-col border-accent/40">
      <CardHeader className={compacto ? "flex-row items-center justify-between gap-2 pb-2" : "flex-row items-center justify-between gap-3 pb-3"}>
        <div className="flex items-center gap-2.5">
          {!compacto && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              {iniciales(nombre)}
            </div>
          )}
          <div>
            <CardTitle className={compacto ? "text-sm" : undefined}>Mis avances</CardTitle>
            {!compacto && (
              <p className="text-xs text-muted-foreground">{puesto ?? "Tus trabajos"} · avance automatico segun el estado</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className={compacto ? "text-lg font-bold leading-none" : "text-2xl font-bold leading-none"}>{promedio}%</p>
          {!compacto && <p className="text-[11px] text-muted-foreground">avance promedio</p>}
        </div>
      </CardHeader>
      <CardContent className={compacto ? "flex-1 p-3 pt-0" : "p-3 pt-0 sm:p-5 sm:pt-0"}>
        <ul className="divide-y divide-border">
          {(verTodas ? mias : mias.slice(0, limite)).map((e) =>
            compacto ? (
              <li key={e.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{e.nombre}</p>
                  <Badge variant={ESTADO_ENTREGABLE_BADGE[e.estado]} className="w-fit shrink-0 text-[10px]">
                    {etiquetaEstadoEntregable(e)}
                  </Badge>
                </div>
                <AvanceEntregable entregable={e} />
              </li>
            ) : (
              <li key={e.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIA_CONTENIDO_LABELS[e.tipo]} · Compromiso {formatFecha(e.fechaCompromiso)}
                  </p>
                </div>
                <Badge variant={ESTADO_ENTREGABLE_BADGE[e.estado]} className="w-fit">
                  {etiquetaEstadoEntregable(e)}
                </Badge>
                <div className="sm:w-56">
                  <AvanceEntregable entregable={e} />
                </div>
              </li>
            )
          )}
        </ul>
        {mias.length > limite && (
          <Button variant="ghost" size="sm" className="mt-1 w-full text-xs" onClick={() => setVerTodas((v) => !v)}>
            {verTodas ? "Ver menos" : `Ver todas (${mias.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
