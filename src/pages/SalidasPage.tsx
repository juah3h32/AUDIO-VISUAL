import { useState } from "react";
import {
  MapPin,
  Phone,
  Truck,
  ShieldCheck,
  Clock,
  CalendarPlus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAutorizarSalida, useSalidas } from "@/hooks/useCatalogos";
import { useUsuarios } from "@/hooks/useCatalogos";
import { useProyectos } from "@/hooks/useProyectos";
import { useAuth } from "@/context/AuthContext";
import { puedeAsignarEntregables } from "@/lib/roles";
import {
  BADGE_AUTORIZACION_SALIDA,
  ETIQUETA_AUTORIZACION_SALIDA,
  TIPO_ACTIVIDAD_SALIDA_LABELS,
} from "@/lib/labels";
import { cn, formatFecha } from "@/lib/utils";
import { linkAgregarEventoCalendar } from "@/services/calendarService";
import { crearNotificacion } from "@/services/notificacionesService";
import type { DecisionSalida } from "@/services/catalogosService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NuevaSalidaDialog } from "@/components/salidas/NuevaSalidaDialog";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/layout/PageHeader";
import { DemoBadge } from "@/components/DemoBadge";
import type { SalidaGrabacion } from "@/types";

/** Abre Google Calendar con el evento de ESTA salida ya pre-llenado, en pestaña nueva — cada
 * quien decide si lo guarda en su propia agenda (ver `calendarService.ts`). Sin OAuth: es un link
 * publico, no una integracion que agregue nada por si sola. */
function BotonAgregarCalendar({ salida }: { salida: SalidaGrabacion }) {
  return (
    <a
      href={linkAgregarEventoCalendar(salida)}
      target="_blank"
      rel="noopener noreferrer"
      title="Agregar a mi Google Calendar"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 gap-1 px-2 text-xs")}
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      Google Calendar
    </a>
  );
}

export function SalidasPage() {
  const { usuario } = useAuth();
  const { data: salidas = [], isLoading, isError, refetch } = useSalidas();
  const { data: usuarios = [] } = useUsuarios();
  const { data: proyectos = [] } = useProyectos();
  const autorizar = useAutorizarSalida();
  const nombreProyectoDe = (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto eliminado";
  const [decidiendo, setDecidiendo] = useState<string | null>(null);
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.nombre ?? "Usuario eliminado";
  // Mismo criterio que crear la salida (lider/superadmin): quien la programa es quien la
  // autoriza. El responsable de produccion nunca se autoriza su propia jornada.
  const puedeAutorizar = puedeAsignarEntregables(usuario);

  const decidir = async (salida: SalidaGrabacion, estadoAutorizacion: DecisionSalida) => {
    setDecidiendo(salida.id);
    try {
      await autorizar.mutateAsync({ id: salida.id, estadoAutorizacion });
      if (usuario && salida.responsableProduccionId !== usuario.id) {
        crearNotificacion({
          paraUsuarioId: salida.responsableProduccionId,
          texto: `La salida "${salida.nombreJornada}" (${salida.folio}) fue ${estadoAutorizacion} por ${usuario.nombre}.`,
        });
      }
    } finally {
      setDecidiendo(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Grabaciones y salidas a fabricas" description="Planeacion de jornadas en planta y locaciones externas.">
        <DemoBadge />
        {puedeAsignarEntregables(usuario) && <NuevaSalidaDialog />}
      </PageHeader>

      <Card className="border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10">
        <CardContent className="flex items-center gap-2.5 px-4 py-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            El checklist de seguridad de esta plataforma no sustituye los permisos y procedimientos
            oficiales de cada instalacion. Confirmar siempre con el responsable de planta.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState label="Cargando salidas…" />
      ) : isError ? (
        <ErrorState label="No se pudieron cargar las salidas." onRetry={() => refetch()} />
      ) : (
        // Tarjetas compactas: 3 columnas en pantallas anchas (antes 2 columnas con texto grande
        // dejaban cada tarjeta de media pantalla).
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {salidas.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 p-4 pb-0">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground">{s.folio}</p>
                  <CardTitle className="truncate" title={s.nombreJornada}>
                    {s.nombreJornada}
                  </CardTitle>
                </div>
                <Badge variant={BADGE_AUTORIZACION_SALIDA[s.estadoAutorizacion]} className="shrink-0">
                  {ETIQUETA_AUTORIZACION_SALIDA[s.estadoAutorizacion]}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-1.5 p-4 pt-2 text-xs">
                <p className="truncate text-muted-foreground">
                  {TIPO_ACTIVIDAD_SALIDA_LABELS[s.tipoActividad]}
                  {s.proyectosRelacionados.length > 0 && ` · ${nombreProyectoDe(s.proyectosRelacionados[0])}`}
                </p>

                <div className="flex min-w-0 items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">
                    {formatFecha(s.fecha)} · Salida {s.horaSalida} · Llegada {s.horaEstimadaLlegada}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-1.5" title={s.direccion}>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {s.planta}
                    {s.direccion && <span className="text-muted-foreground"> — {s.direccion}</span>}
                  </span>
                </div>

                {s.contactoPlanta && (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {s.contactoPlanta}
                      {s.telefonoContacto && <span className="text-muted-foreground"> {s.telefonoContacto}</span>}
                    </span>
                  </div>
                )}

                {s.transporte && (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.transporte}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-0.5 text-muted-foreground">Personal:</span>
                  {s.personalAsignado.map((id) => (
                    <Badge key={id} variant="default" className="px-2 py-0 text-[11px]">
                      {nombreDe(id)}
                    </Badge>
                  ))}
                </div>

                {s.observaciones && (
                  <p className="line-clamp-2 rounded-md bg-bg-secondary px-2 py-1 text-muted-foreground" title={s.observaciones}>
                    {s.observaciones}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                  <BotonAgregarCalendar salida={s} />
                  {puedeAutorizar && s.estadoAutorizacion === "pendiente" && (
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => decidir(s, "rechazada")}
                        disabled={decidiendo === s.id}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => decidir(s, "autorizada")}
                        disabled={decidiendo === s.id}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {decidiendo === s.id ? "Guardando..." : "Autorizar"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {salidas.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Sin salidas programadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
