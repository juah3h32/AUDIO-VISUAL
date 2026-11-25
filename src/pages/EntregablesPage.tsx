import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, EyeOff } from "lucide-react";
import { useEntregables } from "@/hooks/useCatalogos";
import { useProyectos } from "@/hooks/useProyectos";
import { useUsuarios } from "@/hooks/useCatalogos";
import { useGuiones } from "@/hooks/useGuiones";
import { useAuth } from "@/context/AuthContext";
import { puedeAprobarEntregables, puedeAsignarEntregables } from "@/lib/roles";
import { aFecha, inicioDeSemana } from "@/lib/periodo";
import {
  CATEGORIA_CONTENIDO_LABELS,
  ESTADO_ENTREGABLE_BADGE,
  ESTADO_ENTREGABLE_LABELS,
  ESTADO_GUION_LABELS,
  PRIORIDAD_BADGE,
  PRIORIDAD_LABELS,
  ULTIMA_ACTIVIDAD_BADGE,
  ULTIMA_ACTIVIDAD_LABELS,
  compararPorPrioridad,
} from "@/lib/labels";
import { cn, formatFecha } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoBadge } from "@/components/DemoBadge";
import { NuevoEntregableDialog } from "@/components/entregables/NuevoEntregableDialog";
import { CargarEntregableHistoricoDialog } from "@/components/entregables/CargarEntregableHistoricoDialog";
import { RevisarEntregableDialog } from "@/components/entregables/RevisarEntregableDialog";
import { NuevoGuionDialog } from "@/components/guiones/NuevoGuionDialog";
import { RevisarGuionDialog } from "@/components/guiones/RevisarGuionDialog";
import { MiniaturaVideo } from "@/components/entregables/MiniaturaVideo";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Entregable, EstadoEntregable, EstadoGuion } from "@/types";

/** Fecha real a usar para ordenar/agrupar un entregable — la de cuando paso lo que paso
 * (se entrego, se aprobo) y si no hay ninguna todavia, la de compromiso. */
function fechaDeOrden(e: Entregable): string {
  return e.fechaEntregado ?? e.fechaAprobado ?? e.fechaCompromiso;
}

function etiquetaSemana(inicio: Date): string {
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${fmt(inicio)} – ${fmt(fin)}`;
}

type FiltroPeriodoEntregables = "semana" | "semana_pasada" | "mes" | "mes_pasado" | "todos";

const FILTRO_PERIODO_LABELS: Record<FiltroPeriodoEntregables, string> = {
  semana: "Esta semana",
  semana_pasada: "Semana pasada",
  mes: "Este mes",
  mes_pasado: "Mes pasado",
  todos: "Todo",
};

function inicioSemanaConOffset(ahora: Date, semanasAtras: number): Date {
  const base = new Date(ahora);
  base.setDate(base.getDate() - semanasAtras * 7);
  return inicioDeSemana(base);
}

/** Lo aprobado/entregado se acumula mes tras mes (sobre todo con historico cargado) — sin esto
 * la vista siempre muestra TODO desde el inicio de los tiempos. Pendiente/en proceso/en
 * revision/correcciones nunca se filtran por fecha: es trabajo activo, nunca debe desaparecer
 * de la vista solo porque su fecha compromiso cae fuera de la semana/mes elegido. */
function coincideFiltroPeriodo(e: Entregable, filtro: FiltroPeriodoEntregables, ahora: Date): boolean {
  if (filtro === "todos") return true;
  const fecha = aFecha(fechaDeOrden(e));
  if (filtro === "semana" || filtro === "semana_pasada") {
    const inicio = inicioSemanaConOffset(ahora, filtro === "semana" ? 0 : 1);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    return fecha >= inicio && fecha < fin;
  }
  const mesesAtras = filtro === "mes" ? 0 : 1;
  const base = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1);
  return fecha.getFullYear() === base.getFullYear() && fecha.getMonth() === base.getMonth();
}

/** Con pocos entregables (pendiente/en proceso/revision) esto da un solo grupo — no estorba.
 * Con muchos (aprobado/entregado acumulado de meses) parte la columna en semanas, mas reciente
 * primero, para que no sea una sola lista larguisima de tarjetas minusculas. */
function agruparPorSemana(items: Entregable[]) {
  const grupos = new Map<number, Entregable[]>();
  items.forEach((e) => {
    const inicio = inicioDeSemana(aFecha(fechaDeOrden(e))).getTime();
    if (!grupos.has(inicio)) grupos.set(inicio, []);
    grupos.get(inicio)!.push(e);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => b - a)
    .map(([inicioMs, itemsSemana]) => ({ inicio: new Date(inicioMs), items: itemsSemana }));
}

const COLUMNAS: EstadoEntregable[] = [
  "pendiente",
  "en_proceso",
  "en_revision",
  "correcciones",
  "aprobado",
  "entregado",
];

const COLUMNAS_GUION: EstadoGuion[] = ["borrador", "en_revision", "correcciones", "aprobado"];

/** Sentinel del Select de proyecto — Radix no acepta value="" en un SelectItem. */
const SIN_PROYECTO_VALOR = "sin-proyecto";

/** Mismo color por estado que ya usa `ESTADO_ENTREGABLE_BADGE` (ver lib/labels.ts), pero como
 * punto solido + borde — para distinguir las 6 columnas de un vistazo en el submenu, sin tener
 * que leer la etiqueta de cada una. */
const ESTADO_COLOR: Record<EstadoEntregable, { punto: string; activo: string }> = {
  pendiente: { punto: "bg-muted-foreground/50", activo: "border-muted-foreground/50 bg-bg-secondary" },
  en_proceso: { punto: "bg-blue-500", activo: "border-blue-500 bg-blue-500/10" },
  en_revision: { punto: "bg-amber-500", activo: "border-amber-500 bg-amber-500/10" },
  correcciones: { punto: "bg-red-500", activo: "border-red-500 bg-red-500/10" },
  aprobado: { punto: "bg-green-500", activo: "border-green-500 bg-green-500/10" },
  entregado: { punto: "bg-accent-dato", activo: "border-accent-dato bg-accent-dato/10" },
};

export function EntregablesPage() {
  const { usuario } = useAuth();
  const { data: entregables = [], isLoading, isError, refetch } = useEntregables();
  const { data: guiones = [] } = useGuiones();
  const { data: proyectos = [] } = useProyectos();
  const { data: usuarios = [] } = useUsuarios();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [guionSeleccionadoId, setGuionSeleccionadoId] = useState<string | null>(null);
  // Que columna de estado se ve en el panel principal — antes eran 6 columnas angostas lado a
  // lado (cards minusculas con 20+ amontonadas, ej. "En revision"); ahora se ve UNA a la vez, a
  // todo el ancho, elegida en el submenu de la derecha (mismo lenguaje visual que el Sidebar
  // principal de la app).
  const [estadoActivo, setEstadoActivo] = useState<EstadoEntregable>("en_revision");
  // Al venir del link "Ver entregables" de Equipo (?responsable=<id>), arranca mostrando TODO
  // lo de esa persona (no solo esta semana) — para eso es el link, no para repetir el filtro
  // de siempre y que parezca que no trajo nada.
  const [searchParams, setSearchParams] = useSearchParams();
  const responsableDeLink = searchParams.get("responsable");
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodoEntregables>(responsableDeLink ? "todos" : "semana");
  const [filtroResponsable, setFiltroResponsable] = useState(responsableDeLink ?? "todos");
  const [filtroProyecto, setFiltroProyecto] = useState("todos");
  // Pruebas de edicion (esDemo) vienen aparte, OCULTAS por default — el backend ya solo las
  // manda a superadmin/community, pero aun entre esos dos se quedan fuera del Kanban normal a
  // menos que se pida verlas, para no confundirlas con la entrega real.
  const [mostrarDemo, setMostrarDemo] = useState(false);
  const ahora = new Date();
  const seleccionado = entregables.find((e) => e.id === seleccionadoId) ?? null;
  const guionSeleccionado = guiones.find((g) => g.id === guionSeleccionadoId) ?? null;

  // Al venir de una notificacion ("tu video se aprobo", etc.) con ?abrir=<id>, abre ese
  // entregable de una vez en vez de dejar que lo busque a mano en el Kanban.
  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (abrir && entregables.some((e) => e.id === abrir)) {
      setSeleccionadoId(abrir);
      setSearchParams((p) => {
        p.delete("abrir");
        return p;
      }, { replace: true });
    }
  }, [searchParams, entregables, setSearchParams]);

  const proyectoDe = (id: string | undefined) =>
    id ? proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto eliminado" : "Sin proyecto";
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.nombre ?? "Usuario eliminado";

  // Compartida entre el header y el submenu de estados — mismo filtro, mismo orden, una sola
  // fuente de verdad. El filtro de periodo aplica a TODAS las columnas por igual (ver selector
  // arriba: "Esta semana" solo muestra lo de esa semana, "Todo" lo muestra todo).
  const itemsDeColumna = (estado: EstadoEntregable) => {
    return entregables
      .filter(
        (e) =>
          e.estado === estado &&
          (mostrarDemo || !e.esDemo) &&
          coincideFiltroPeriodo(e, filtroPeriodo, ahora) &&
          (filtroResponsable === "todos" || e.responsableId === filtroResponsable) &&
          (filtroProyecto === "todos" ||
            (filtroProyecto === SIN_PROYECTO_VALOR ? !e.proyectoId : e.proyectoId === filtroProyecto))
      )
      .sort((a, b) => compararPorPrioridad(a.prioridad, b.prioridad));
  };

  // Solo quien ya aparece como responsable de algo — no tiene caso listar a todo el catalogo
  // de usuarios (invitados, gestores de venta, etc.) en un filtro pensado para ver trabajo hecho.
  const personasConEntregables = useMemo(() => {
    const ids = new Set(entregables.map((e) => e.responsableId));
    return [...ids]
      .map((id) => ({ id, nombre: nombreDe(id) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [entregables, usuarios]);

  return (
    <div className="space-y-6">
      <PageHeader title="Postproducción y entregables" description="Guiones y versionado de entregables por proyecto.">
        <DemoBadge />
      </PageHeader>

      <Tabs defaultValue="entregables">
        <TabsList>
          <TabsTrigger value="guiones">Guiones</TabsTrigger>
          <TabsTrigger value="entregables">Entregables</TabsTrigger>
        </TabsList>

        <TabsContent value="guiones" className="space-y-4">
          <div className="flex justify-end">{puedeAsignarEntregables(usuario) && <NuevoGuionDialog />}</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNAS_GUION.map((estado) => {
              const items = guiones.filter((g) => g.estado === estado);
              return (
                <Card key={estado} className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {ESTADO_GUION_LABELS[estado]}
                      <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {items.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGuionSeleccionadoId(g.id)}
                        className="w-full rounded-md border border-border bg-card p-2.5 text-left text-xs transition-colors hover:bg-bg-secondary"
                      >
                        <p className="font-medium text-text-primary">
                          <span className="text-muted-foreground">{g.folio}</span> {g.titulo}
                        </p>
                        <p className="truncate text-muted-foreground">{proyectoDe(g.proyectoId)}</p>
                        <p className="mt-1 text-muted-foreground">{nombreDe(g.responsableId)}</p>
                      </button>
                    ))}
                    {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin guiones en esta etapa.</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="entregables" className="space-y-4">
          {/* Toolbar unica (antes eran controles sueltos directo sobre el fondo de la pagina,
              sin agrupar — se veian pegados/descuadrados). Un solo contenedor con su propio
              fondo/borde: filtros a la izquierda, acciones a la derecha, incluso cuando el
              `justify-between` las separa mucho en pantallas anchas siguen leyendose como UNA
              barra. Todo a `h-10` (mismo alto que Select/Button por default) para que nada se
              vea mas chico o desalineado que el resto. */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as FiltroPeriodoEntregables)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FILTRO_PERIODO_LABELS).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroProyecto} onValueChange={setFiltroProyecto}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Todos los proyectos" className="min-w-0 flex-1 truncate whitespace-nowrap text-left" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los proyectos</SelectItem>
                  <SelectItem value={SIN_PROYECTO_VALOR}>Sin proyecto</SelectItem>
                  {proyectos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usuario?.rol === "superadmin" && (
                <Select
                  value={filtroResponsable}
                  onValueChange={(v) => {
                    setFiltroResponsable(v);
                    setSearchParams((p) => {
                      if (v === "todos") p.delete("responsable");
                      else p.set("responsable", v);
                      return p;
                    }, { replace: true });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Todos los responsables" className="min-w-0 flex-1 truncate whitespace-nowrap text-left" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los responsables</SelectItem>
                    {personasConEntregables.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* El backend ya solo manda "pruebas de edicion" (esDemo) a superadmin/community —
                  aun asi se quedan ocultas por default en el Kanban normal; este boton las trae
                  de vuelta cuando de verdad se quieren revisar. */}
              {puedeAprobarEntregables(usuario) && (
                <button
                  type="button"
                  onClick={() => setMostrarDemo((v) => !v)}
                  title="Las pruebas de edicion (Demo) estan ocultas por default — este boton las muestra"
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                    mostrarDemo
                      ? "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-400/30 dark:bg-purple-400/15 dark:text-purple-300"
                      : "border-border text-muted-foreground hover:bg-bg-secondary"
                  )}
                >
                  {mostrarDemo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Pruebas (Demo)
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {usuario?.rol === "superadmin" && <CargarEntregableHistoricoDialog />}
              {puedeAsignarEntregables(usuario) && <NuevoEntregableDialog />}
            </div>
            <p className="w-full text-[11px] text-muted-foreground">
              El periodo filtra todas las columnas por fecha compromiso/entrega — "Todo" para ver sin filtro.
            </p>
          </div>
          {isLoading ? (
            <LoadingState label="Cargando entregables…" />
          ) : isError ? (
            <ErrorState label="No se pudieron cargar los entregables." onRetry={() => refetch()} />
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {/* Panel principal: UNA columna de estado a la vez, a todo el ancho — cards grandes
                  con mas aire, en vez del grid de 6 columnas angostas de antes. */}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ESTADO_COLOR[estadoActivo].punto)} />
                  <h3 className="text-sm font-semibold text-text-primary">{ESTADO_ENTREGABLE_LABELS[estadoActivo]}</h3>
                  <Badge variant={ESTADO_ENTREGABLE_BADGE[estadoActivo]} className="text-[10px]">
                    {itemsDeColumna(estadoActivo).length}
                  </Badge>
                </div>
                <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 scrollbar-thin">
                  {agruparPorSemana(itemsDeColumna(estadoActivo)).map(({ inicio, items: itemsSemana }) => (
                    <div key={inicio.getTime()}>
                      <p className="sticky top-0 z-10 bg-bg-app py-1 text-xs font-semibold text-muted-foreground">
                        {etiquetaSemana(inicio)} · {itemsSemana.length}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {itemsSemana.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSeleccionadoId(e.id)}
                            className="flex items-center gap-3 rounded-md border border-border bg-card p-2.5 text-left text-sm transition-colors hover:bg-bg-secondary"
                          >
                            <MiniaturaVideo
                              url={e.urlRevision || e.urlFinal}
                              orientacion={e.orientacionVideo}
                              llenarAlto
                              className="h-24 w-24 shrink-0 rounded-md"
                            />
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={PRIORIDAD_BADGE[e.prioridad ?? "media"]} className="shrink-0 text-[10px]">
                                  {PRIORIDAD_LABELS[e.prioridad ?? "media"]}
                                </Badge>
                                {e.esDemo && (
                                  <Badge className="shrink-0 bg-purple-100 text-[10px] text-purple-800 dark:bg-purple-400/15 dark:text-purple-300">
                                    Demo
                                  </Badge>
                                )}
                                <p className="truncate font-medium text-text-primary">{e.nombre}</p>
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{proyectoDe(e.proyectoId)}</p>
                              {e.ultimaActividad && (
                                <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                                  <Badge variant={ULTIMA_ACTIVIDAD_BADGE[e.ultimaActividad.tipo]} className="shrink-0 text-[10px]">
                                    {ULTIMA_ACTIVIDAD_LABELS[e.ultimaActividad.tipo]}
                                  </Badge>
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {nombreDe(e.ultimaActividad.porId)} ·{" "}
                                    {formatDistanceToNow(new Date(e.ultimaActividad.en), { addSuffix: true, locale: es })}
                                  </span>
                                </div>
                              )}
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="truncate text-xs text-muted-foreground">{nombreDe(e.responsableId)}</span>
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  {formatFecha(fechaDeOrden(e))}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {itemsDeColumna(estadoActivo).length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nada en esta columna.</p>
                  )}
                </div>
              </div>

              {/* Submenu de estados, lado derecho — mismo lenguaje visual que el Sidebar
                  principal de la app (ver src/components/layout/Sidebar.tsx). */}
              <nav className="w-full shrink-0 space-y-1 rounded-lg border border-border bg-card p-2 lg:w-56">
                {COLUMNAS.map((estado) => {
                  const cantidad = itemsDeColumna(estado).length;
                  const activo = estado === estadoActivo;
                  const color = ESTADO_COLOR[estado];
                  return (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => setEstadoActivo(estado)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md border-l-4 border-transparent px-2.5 py-2.5 text-sm font-medium text-text-primary/80 transition-colors hover:bg-bg-secondary",
                        activo && cn(color.activo, "text-text-primary font-semibold")
                      )}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", color.punto)} />
                      <span className="flex-1 text-left">{ESTADO_ENTREGABLE_LABELS[estado]}</span>
                      <Badge variant={ESTADO_ENTREGABLE_BADGE[estado]} className="shrink-0 text-[10px]">
                        {cantidad}
                      </Badge>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RevisarEntregableDialog
        entregable={seleccionado}
        open={Boolean(seleccionadoId)}
        onOpenChange={(open) => !open && setSeleccionadoId(null)}
        nombreResponsable={seleccionado ? nombreDe(seleccionado.responsableId) : ""}
        nombreProyecto={seleccionado ? proyectoDe(seleccionado.proyectoId) : undefined}
        nombreAprobador={seleccionado?.aprobadorId ? nombreDe(seleccionado.aprobadorId) : undefined}
      />
      <RevisarGuionDialog
        guion={guionSeleccionado}
        open={Boolean(guionSeleccionadoId)}
        onOpenChange={(open) => !open && setGuionSeleccionadoId(null)}
        nombreResponsable={guionSeleccionado ? nombreDe(guionSeleccionado.responsableId) : ""}
        nombreProyecto={guionSeleccionado ? proyectoDe(guionSeleccionado.proyectoId) : undefined}
      />
    </div>
  );
}
