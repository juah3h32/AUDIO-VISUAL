import { useNavigate } from "react-router-dom";
import { MisAvances } from "@/components/entregables/MisAvances";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Camera,
  Users,
  AlertTriangle,
  Film,
  ScrollText,
  Wrench,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import { esGestorRequisiciones, puedeVerMetricasGlobales } from "@/lib/roles";
import { useRequisiciones } from "@/hooks/useRequisiciones";
import { useProyectos } from "@/hooks/useProyectos";
import { useEntregables, useSalidas, useUsuarios } from "@/hooks/useCatalogos";
import { useColaboradoresDelEquipo } from "@/hooks/useColaboradoresDelEquipo";
import { useGuiones } from "@/hooks/useGuiones";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DemoBadge } from "@/components/DemoBadge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/layout/PageHeader";
import { NuevaRequisicionDialog } from "@/components/requisiciones/NuevaRequisicionDialog";
import {
  ESTADO_REQUISICION_BADGE,
  ESTADO_REQUISICION_LABELS,
  CATEGORIA_CONTENIDO_LABELS,
  ACCION_ENTREGA_LABELS,
} from "@/lib/labels";
import { formatFecha } from "@/lib/utils";
import { aFecha, inicioDeSemana } from "@/lib/periodo";
import {
  cumplidosPorMes,
  estaAtrasado,
  mesesVacios,
  produccionSemanal as calcularProduccionSemanal,
  yaEntregoMaterial,
} from "@/lib/metricas";
import { cargaDeTrabajo, entregablesPorResponsable } from "@/lib/rendimiento";
import { COLORES_TIPO, useTemaGrafica } from "@/lib/chartTheme";
import type { Entregable } from "@/types";

/** Top 5 tipos + "Otros" para que la dona no se deforme con 14 categorias posibles — compartido
 * entre la vista completa (todo el equipo) y la vista de colaborador (solo lo suyo). */
function tipoEntregablesDelMes(
  lista: Entregable[],
  ahora: Date,
  g: ReturnType<typeof useTemaGrafica>
) {
  const porTipoMap = new Map<Entregable["tipo"], number>();
  lista
    .filter((e) => {
      const creado = aFecha(e.creadoEn);
      return creado.getFullYear() === ahora.getFullYear() && creado.getMonth() === ahora.getMonth();
    })
    .forEach((e) => porTipoMap.set(e.tipo, (porTipoMap.get(e.tipo) ?? 0) + 1));
  const totalTipoMes = [...porTipoMap.values()].reduce((a, b) => a + b, 0);
  const TOP_TIPOS = 5;
  const ordenTipos = [...porTipoMap.entries()].sort((a, b) => b[1] - a[1]);
  const restoTipos = ordenTipos.slice(TOP_TIPOS);
  if (totalTipoMes === 0) return [{ name: "Sin datos este mes", cantidad: 0, value: 100, color: g.vacio }];
  return [
    ...ordenTipos.slice(0, TOP_TIPOS).map(([tipo, cantidad], i) => ({
      name: CATEGORIA_CONTENIDO_LABELS[tipo],
      cantidad,
      value: Math.round((cantidad / totalTipoMes) * 100),
      color: COLORES_TIPO[i],
    })),
    ...(restoTipos.length
      ? [
          (() => {
            const cantidad = restoTipos.reduce((a, [, c]) => a + c, 0);
            return {
              name: `Otros ${restoTipos.length} tipos`,
              cantidad,
              value: Math.round((cantidad / totalTipoMes) * 100),
              color: g.barraNeutra,
            };
          })(),
        ]
      : []),
  ];
}

function DonaTipoEntregables({ datos, g }: { datos: ReturnType<typeof tipoEntregablesDelMes>; g: ReturnType<typeof useTemaGrafica> }) {
  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {datos.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip {...g.tooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1">
        {datos.map((t) => (
          <div key={t.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="truncate">{t.name}</span>
            </span>
            <span className="shrink-0 font-medium">
              {t.value}%{t.cantidad > 0 && <span className="ml-1 font-normal text-muted-foreground">({t.cantidad})</span>}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function DashboardPage() {
  const g = useTemaGrafica();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const {
    data: requisiciones = [],
    isLoading: cargandoRequisiciones,
    isError: errorRequisiciones,
    refetch: refetchRequisiciones,
  } = useRequisiciones();
  const {
    data: proyectos = [],
    isLoading: cargandoProyectos,
    isError: errorProyectos,
    refetch: refetchProyectos,
  } = useProyectos();
  const { data: colaboradores = [] } = useColaboradoresDelEquipo();
  const {
    data: entregables = [],
    isLoading: cargandoEntregables,
    isError: errorEntregables,
    refetch: refetchEntregables,
  } = useEntregables();
  const { data: salidas = [] } = useSalidas();
  const { data: usuarios = [] } = useUsuarios();

  // "community" revisa guiones ademas de requisiciones/videos (aprobador_departamental solo
  // requisiciones) — por eso se pide aparte y solo se usa en la vista de aprobador.
  const esAprobador = usuario?.rol === "community" || usuario?.rol === "aprobador_departamental";
  const { data: guiones = [] } = useGuiones();

  const cargandoDashboard = cargandoRequisiciones || cargandoProyectos || cargandoEntregables;
  const errorDashboard = errorRequisiciones || errorProyectos || errorEntregables;
  const reintentarDashboard = () => {
    refetchRequisiciones();
    refetchProyectos();
    refetchEntregables();
  };

  const ahora = new Date();
  const hoyIso = ahora.toISOString().slice(0, 10);
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.nombre ?? "Usuario eliminado";
  const proyectoDe = (id: string | undefined) => (id ? proyectos.find((p) => p.id === id)?.nombre : undefined);

  // ---------------------------------------------------------------------------------------
  // Solicitante: persona de OTRO departamento, sin acceso a nada del trabajo interno del
  // equipo audiovisual (ver RUTA_ROLES en lib/roles.ts) — mostrarle "Carga del equipo",
  // "Producción semanal" etc. exponia metricas internas ajenas a alguien externo. Su Inicio es
  // solo el estado de SUS PROPIAS requisiciones.
  // ---------------------------------------------------------------------------------------
  if (usuario?.rol === "solicitante") {
    const misRequisiciones = requisiciones.filter((r) => r.solicitanteId === usuario.id);
    const pendientes = misRequisiciones.filter((r) =>
      ["enviada", "en_evaluacion", "requiere_informacion"].includes(r.estado)
    ).length;
    const aprobadas = misRequisiciones.filter((r) => r.estado === "aprobada" || r.estado === "en_planeacion").length;
    const rechazadas = misRequisiciones.filter((r) => r.estado === "rechazada").length;

    return (
      <div className="space-y-6">
        <PageHeader
          title={`¡Hola, ${usuario?.nombre?.split(" ")[0] ?? "de nuevo"}!`}
          description="Aquí tienes el estado de tus requisiciones."
        >
          <DemoBadge />
          <NuevaRequisicionDialog />
        </PageHeader>

        {cargandoRequisiciones ? (
          <LoadingState label="Cargando tus requisiciones…" />
        ) : errorRequisiciones ? (
          <ErrorState label="No se pudieron cargar tus requisiciones." onRetry={() => refetchRequisiciones()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={FileText} label="Mis requisiciones" value={misRequisiciones.length} hint="En total" />
              <StatCard icon={Clock} label="Pendientes" value={pendientes} hint="En revisión" />
              <StatCard icon={CheckCircle2} label="Aprobadas" value={aprobadas} hint="En producción o entregadas" />
              <StatCard icon={AlertTriangle} label="Rechazadas" value={rechazadas} hint="Requieren ajuste" iconBg="bg-red-100 dark:bg-red-400/20" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Mis requisiciones</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {misRequisiciones.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aún no has enviado ninguna requisición.
                  </p>
                ) : (
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 font-medium">Folio</th>
                        <th className="py-2 font-medium">Título</th>
                        <th className="py-2 font-medium">Tipo</th>
                        <th className="py-2 font-medium">Fecha requerida</th>
                        <th className="py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misRequisiciones
                        .slice()
                        .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
                        .map((r) => (
                          <tr key={r.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 font-medium">{r.folio}</td>
                            <td className="py-2.5">{r.titulo}</td>
                            <td className="py-2.5">{CATEGORIA_CONTENIDO_LABELS[r.tipoContenido]}</td>
                            <td className="py-2.5 text-muted-foreground">{formatFecha(r.fechaRequerida)}</td>
                            <td className="py-2.5">
                              <Badge variant={ESTADO_REQUISICION_BADGE[r.estado]}>{ESTADO_REQUISICION_LABELS[r.estado]}</Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------
  // Aprobador (community / aprobador_departamental): su trabajo es decidir sobre requisiciones
  // (y, solo community, tambien sobre guiones/videos) — no produce contenido ni gestiona al
  // equipo, asi que las metricas de produccion (carga, avance propio, graficas de produccion)
  // no le sirven y solo generaban ruido.
  // ---------------------------------------------------------------------------------------
  if (esAprobador) {
    const esCommunity = esGestorRequisiciones(usuario);
    const requisicionesPendientes = requisiciones.filter(
      (r) => r.estado === "enviada" || r.estado === "en_evaluacion"
    );
    const guionesPorRevisar = guiones.filter((gn) => gn.estado === "en_revision").length;
    const entregablesEnRevision = entregables.filter((e) => e.estado === "en_revision");
    const aMostrar = requisicionesPendientes.length > 0 ? requisicionesPendientes : requisiciones.slice(0, 5);

    return (
      <div className="space-y-6">
        <PageHeader
          title={`¡Hola, ${usuario?.nombre?.split(" ")[0] ?? "de nuevo"}!`}
          description="Tu cola de aprobaciones de hoy."
        >
          <DemoBadge />
        </PageHeader>

        {cargandoDashboard ? (
          <LoadingState label="Cargando panel…" />
        ) : errorDashboard ? (
          <ErrorState label="No se pudo cargar el panel." onRetry={reintentarDashboard} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={FileText} label="Requisiciones" value={requisiciones.length} hint="En total" />
              <StatCard icon={Clock} label="Por aprobar" value={requisicionesPendientes.length} hint="Esperando tu decisión" />
              {esCommunity && (
                <>
                  <StatCard icon={ScrollText} label="Guiones por revisar" value={guionesPorRevisar} hint="Esperando tu aprobación" />
                  <StatCard icon={Film} label="Videos en revisión" value={entregablesEnRevision.length} hint="Listos para aprobar o corregir" />
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{requisicionesPendientes.length > 0 ? "Requisiciones por aprobar" : "Requisiciones recientes"}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {aMostrar.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin requisiciones registradas.</p>
                ) : (
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 font-medium">Folio</th>
                        <th className="py-2 font-medium">Título</th>
                        <th className="py-2 font-medium">Solicitante</th>
                        <th className="py-2 font-medium">Fecha requerida</th>
                        <th className="py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aMostrar.slice(0, 8).map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-2.5 font-medium">{r.folio}</td>
                          <td className="py-2.5">{r.titulo}</td>
                          <td className="py-2.5 text-muted-foreground">{r.nombreSolicitante}</td>
                          <td className="py-2.5 text-muted-foreground">{formatFecha(r.fechaRequerida)}</td>
                          <td className="py-2.5">
                            <Badge variant={ESTADO_REQUISICION_BADGE[r.estado]}>{ESTADO_REQUISICION_LABELS[r.estado]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {esCommunity && entregablesEnRevision.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Videos listos para tu aprobación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entregablesEnRevision.slice(0, 6).map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {CATEGORIA_CONTENIDO_LABELS[e.tipo]}
                          {proyectoDe(e.proyectoId) ? ` · ${proyectoDe(e.proyectoId)}` : ""} · {nombreDe(e.responsableId)}
                        </p>
                      </div>
                      <Badge variant="warning" className="shrink-0 text-[10px]">
                        En revisión
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  const pendientesAprobacion = requisiciones.filter(
    (r) => r.estado === "enviada" || r.estado === "en_evaluacion"
  ).length;
  const enPostproduccion = proyectos.filter((p) =>
    ["edicion", "animacion_acabados", "revision", "correcciones"].includes(p.etapaActual)
  ).length;
  // "Entregado" para estos stats = el colaborador ya subio el video (en_revision, aprobado o
  // entregado) — aunque falte el visto bueno de community, su parte ya esta hecha y debe
  // sumar. "Correcciones" no cuenta: ahi community ya lo reviso y lo regreso.
  const entregablesFinalizados = entregables.filter(yaEntregoMaterial).length;
  // El stat "Entregados" dice "Este mes" pero sumaba TODO el historico — se nota en cuanto hay
  // carga historica de meses pasados. Filtrado al mes en curso, igual que "Tipo de entregables".
  const entregadosEsteMes = entregables.filter((e) => {
    if (!yaEntregoMaterial(e)) return false;
    const fecha = aFecha(e.fechaEntregado ?? e.fechaAprobado ?? e.creadoEn);
    return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
  }).length;
  // Lista completa (no solo el conteo) para el widget "Tareas atrasadas" del lider — ordenada
  // por la mas vieja primero (la que lleva mas tiempo atrasada es la mas urgente). `estaAtrasado`
  // (no comparar la fecha directo) evita marcar como atrasada una tarea con compromiso HOY mismo
  // antes de que el dia termine.
  const tareasAtrasadas = entregables
    .filter((e) => estaAtrasado(e, ahora))
    .sort((a, b) => aFecha(a.fechaCompromiso).getTime() - aFecha(b.fechaCompromiso).getTime());
  const entregasAtrasadas = tareasAtrasadas.length;
  // "Colaboradores" se cuenta de las cuentas reales (usuarios) por rol — la coleccion aparte
  // "colaboradores" (carga de trabajo/disponibilidad en Equipo) casi nunca esta poblada todavía.
  const colaboradoresDelEquipo = usuarios.filter((u) => u.rol === "colaborador_audiovisual");
  // Carga REAL por persona, calculada en vivo de los entregables activos — antes esta tarjeta
  // leia `colaboradores.cargaReal`, un campo manual de la coleccion legacy "colaboradores" que
  // casi nunca se actualiza (por eso se veia siempre en 0%). `cargaDeTrabajo()` es el mismo
  // calculo que ya usa EquipoPage.tsx: activas/atrasadas/% segun el trabajo de verdad asignado.
  const porResponsable = entregablesPorResponsable(entregables);
  const cargaPorColaborador = colaboradoresDelEquipo
    .map((u) => ({ id: u.id, nombre: u.nombre, carga: cargaDeTrabajo(porResponsable.get(u.id) ?? [], ahora) }))
    .sort((a, b) => b.carga.porcentaje - a.carga.porcentaje);
  const proyectosAtencion = proyectos.filter(
    (p) => (p.prioridad === "critica" || p.prioridad === "alta") && !["entregado", "cerrado"].includes(p.etapaActual)
  ).length;
  const cumplimiento = entregables.length
    ? Math.round((entregablesFinalizados / entregables.length) * 100)
    : 0;

  // Cumplimiento semanal: aqui se trabaja Lunes a Sabado (no Lun-Dom) — el corte real es el
  // viernes, pero lo que se sube el sabado sigue contando para esa misma semana. Se mide contra
  // lo que tenia fecha compromiso esta semana, no contra todo el historico — por eso puede dar
  // 100% una semana y bajar la siguiente, a diferencia de "Cumplimiento" (ese es acumulado).
  const inicioSemanaActual = inicioDeSemana(ahora);
  const inicioDomingo = new Date(inicioSemanaActual);
  inicioDomingo.setDate(inicioDomingo.getDate() + 6);
  const entregablesDeEstaSemana = entregables.filter((e) => {
    const fecha = aFecha(e.fechaCompromiso);
    return fecha >= inicioSemanaActual && fecha < inicioDomingo;
  });
  const cumplidosEstaSemana = entregablesDeEstaSemana.filter(yaEntregoMaterial).length;
  const cumplimientoSemanal = entregablesDeEstaSemana.length
    ? Math.round((cumplidosEstaSemana / entregablesDeEstaSemana.length) * 100)
    : 100;

  // Produccion real de la semana en curso (ya no datos de ejemplo fijos).
  const produccionSemanal = calcularProduccionSemanal(entregables, requisiciones, ahora);
  const tipoEntregables = tipoEntregablesDelMes(entregables, ahora, g);

  // Solo para lider/superadmin (`puedeVerMetricasGlobales`).
  const entregadosPorMesReal = cumplidosPorMes(entregables);
  const entregadosPorMes = entregadosPorMesReal.length > 0 ? entregadosPorMesReal : mesesVacios(6, ahora);

  // Actividad real (ya no nombres de ejemplo fijos) — un renglon por cada cambio de estado con
  // fecha conocida (creado/aprobado/entregado), el mas reciente de cada entregable primero.
  const actividadReciente = entregables
    .flatMap((e) => {
      const eventos: { icono: typeof Film; texto: string; cuando: Date }[] = [];
      if (e.fechaEntregado) {
        eventos.push({
          icono: CheckCircle2,
          texto: `${nombreDe(e.responsableId)} marcó "${e.nombre}" como ${ACCION_ENTREGA_LABELS[e.tipo]}`,
          cuando: aFecha(e.fechaEntregado),
        });
      }
      if (e.fechaAprobado) {
        eventos.push({ icono: CheckCircle2, texto: `Se aprobó "${e.nombre}"`, cuando: aFecha(e.fechaAprobado) });
      }
      if (e.creadoEn) {
        eventos.push({ icono: Upload, texto: `${nombreDe(e.responsableId)} creó el entregable "${e.nombre}"`, cuando: aFecha(e.creadoEn) });
      }
      const proyecto = proyectoDe(e.proyectoId);
      return eventos.map((ev) => ({ ...ev, detalle: `${CATEGORIA_CONTENIDO_LABELS[e.tipo]}${proyecto ? ` · ${proyecto}` : ""}` }));
    })
    .sort((a, b) => b.cuando.getTime() - a.cuando.getTime())
    .slice(0, 5);

  // ---------------------------------------------------------------------------------------
  // Colaborador: produce contenido, no tiene acceso a Requisiciones ni a Equipo (ver
  // RUTA_ROLES) — mostrarle esas metricas globales era puro ruido. Su Inicio se escala a SU
  // propio trabajo: lo que trae en proceso, lo que le regresaron con correcciones, y a donde le
  // toca ir (salidas asignadas).
  // ---------------------------------------------------------------------------------------
  if (usuario?.rol === "colaborador_audiovisual") {
    const misEntregables = entregables.filter((e) => e.responsableId === usuario.id);
    const misEnProceso = misEntregables.filter((e) => e.estado === "en_proceso" || e.estado === "en_revision").length;
    const misCorrecciones = misEntregables.filter((e) => e.estado === "correcciones");
    const misEntregadosEsteMes = misEntregables.filter((e) => {
      if (!yaEntregoMaterial(e)) return false;
      const fecha = aFecha(e.fechaEntregado ?? e.fechaAprobado ?? e.creadoEn);
      return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    }).length;
    const misAtrasados = misEntregables.filter((e) => estaAtrasado(e, ahora)).length;
    const miCumplimiento = misEntregables.length
      ? Math.round((misEntregables.filter(yaEntregoMaterial).length / misEntregables.length) * 100)
      : 0;
    const misProduccionSemanal = calcularProduccionSemanal(misEntregables, [], ahora);
    const miTipoEntregables = tipoEntregablesDelMes(misEntregables, ahora, g);
    const misProximasSalidas = salidas
      .filter((s) => s.personalAsignado.includes(usuario.id) && s.fecha >= hoyIso)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .slice(0, 5);

    return (
      <div className="space-y-6">
        <PageHeader
          title={`¡Hola, ${usuario?.nombre?.split(" ")[0] ?? "de nuevo"}!`}
          description="Tu trabajo de hoy: grabaciones, ediciones y correcciones pendientes."
        >
          <DemoBadge />
        </PageHeader>

        {cargandoDashboard ? (
          <LoadingState label="Cargando panel…" />
        ) : errorDashboard ? (
          <ErrorState label="No se pudo cargar el panel." onRetry={reintentarDashboard} />
        ) : (
          <>
            <MisAvances usuarioId={usuario.id} nombre={usuario.nombre} puesto={usuario.puesto} />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={Film} label="En proceso" value={misEnProceso} hint="Mis entregables activos" />
              <StatCard icon={Wrench} label="Correcciones" value={misCorrecciones.length} hint="Pendientes de resubir" iconBg="bg-amber-100 dark:bg-amber-400/20" />
              <StatCard icon={CheckCircle2} label="Entregados" value={misEntregadosEsteMes} hint="Este mes" />
              <StatCard icon={AlertTriangle} label="Atrasados" value={misAtrasados} hint="Requieren atención" iconBg="bg-red-100 dark:bg-red-400/20" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {misCorrecciones.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Correcciones pendientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {misCorrecciones.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {CATEGORIA_CONTENIDO_LABELS[e.tipo]}
                            {proyectoDe(e.proyectoId) ? ` · ${proyectoDe(e.proyectoId)}` : ""}
                          </p>
                        </div>
                        <Badge variant="warning" className="shrink-0 text-[10px]">
                          Corregir
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className={misCorrecciones.length > 0 ? undefined : "lg:col-span-3"}>
                <CardHeader>
                  <CardTitle>Mis próximas salidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {misProximasSalidas.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sin salidas próximas asignadas.</p>
                  )}
                  {misProximasSalidas.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.planta}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFecha(s.fecha)} · {s.horaSalida}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="flex flex-col lg:col-span-2">
                <CardHeader>
                  <CardTitle>Mi producción semanal</CardTitle>
                </CardHeader>
                <CardContent className="min-h-56 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={misProduccionSemanal}>
                      <CartesianGrid strokeDasharray="3 3" stroke={g.grid} vertical={false} />
                      <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} tick={g.tick} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} tick={g.tick} />
                      <Tooltip cursor={g.cursor} {...g.tooltip} />
                      <Bar dataKey="entregados" name="Entregados" fill="rgb(var(--av-accent-dato))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mis entregables (mes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonaTipoEntregables datos={miTipoEntregables} g={g} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Mi carga de trabajo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {colaboradores
                  .filter((c) => c.id === usuario.id)
                  .map((c) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{c.nombre}</span>
                        <span className="text-muted-foreground">{c.cargaReal}%</span>
                      </div>
                      <Progress value={c.cargaReal} />
                    </div>
                  ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------
  // Produccion (superadmin / lider_audiovisual): vista completa, igual que antes, mas dos
  // colas accionables que antes no existian en Inicio (autorizar salidas, asignar proyectos).
  // ---------------------------------------------------------------------------------------
  const salidasPorAutorizar = salidas.filter((s) => s.estadoAutorizacion === "pendiente");
  const proyectosSinAsignar = proyectos.filter(
    (p) => p.colaboradoresIds.length === 0 && !["entregado", "cerrado"].includes(p.etapaActual)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`¡Hola, ${usuario?.nombre?.split(" ")[0] ?? "de nuevo"}!`}
        description="Aquí tienes el resumen del departamento audiovisual."
      >
        <DemoBadge />
      </PageHeader>

      {cargandoDashboard ? (
        <LoadingState label="Cargando panel…" />
      ) : errorDashboard ? (
        <ErrorState label="No se pudo cargar el panel." onRetry={reintentarDashboard} />
      ) : (
        <>
          {/* Cada quien reporta aqui su % de avance (antes solo existia en Rendimiento, que es solo del
              lider — los colaboradores no tenian donde actualizarlo). */}
          {usuario && <MisAvances usuarioId={usuario.id} nombre={usuario.nombre} puesto={usuario.puesto} />}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={FileText} label="Requisiciones" value={requisiciones.length} hint="En total" />
            <StatCard icon={Clock} label="Por aprobar" value={pendientesAprobacion} hint="Requieren revisión" />
            <StatCard icon={Film} label="En postproducción" value={enPostproduccion} hint="Proyectos activos" />
            <StatCard icon={CheckCircle2} label="Entregados" value={entregadosEsteMes} hint="Este mes" />
            <StatCard icon={AlertTriangle} label="Entregas atrasadas" value={entregasAtrasadas} hint="Requieren atención" iconBg="bg-red-100 dark:bg-red-400/20" />
            <StatCard icon={Clock} label="Cumplimiento" value={`${cumplimiento}%`} hint="A tiempo" />
            <StatCard icon={Camera} label="Salidas programadas" value={salidas.length} hint="Registradas" />
            <StatCard icon={Users} label="Colaboradores" value={colaboradoresDelEquipo.length} hint="Audiovisuales en el equipo" />
          </div>

          {(salidasPorAutorizar.length > 0 || proyectosSinAsignar.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {salidasPorAutorizar.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Salidas por autorizar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {salidasPorAutorizar.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.nombreJornada}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.planta} · {formatFecha(s.fecha)} · {nombreDe(s.responsableProduccionId)}
                          </p>
                        </div>
                        <Badge variant="warning" className="shrink-0 text-[10px]">
                          Pendiente
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {proyectosSinAsignar.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Proyectos sin colaborador asignado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {proyectosSinAsignar.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.folio} · {p.departamentoSolicitante}</p>
                        </div>
                        <Badge variant="accent" className="shrink-0 text-[10px]">
                          Sin asignar
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Cumplimiento semanal</p>
                <p className="text-xs text-muted-foreground">
                  Lunes a sábado · {cumplidosEstaSemana} de {entregablesDeEstaSemana.length || 0} con fecha compromiso
                  esta semana
                </p>
              </div>
              <div className="flex items-center gap-3 sm:w-64">
                <Progress value={cumplimientoSemanal} className="h-2.5" />
                <span className="w-12 shrink-0 text-right text-lg font-bold">{cumplimientoSemanal}%</span>
              </div>
            </CardContent>
          </Card>

          {proyectosAtencion > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  {proyectosAtencion === 1
                    ? "1 proyecto de prioridad alta o crítica requiere atención."
                    : `${proyectosAtencion} proyectos de prioridad alta o crítica requieren atención.`}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* flex-col + flex-1: la grafica llena la altura de la fila en vez de dejar hueco abajo. */}
            <Card className="flex flex-col lg:col-span-2">
              <CardHeader>
                <CardTitle>Producción semanal</CardTitle>
              </CardHeader>
              <CardContent className="min-h-56 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={produccionSemanal}>
                    <CartesianGrid strokeDasharray="3 3" stroke={g.grid} vertical={false} />
                    <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} tick={g.tick} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tick={g.tick} />
                    <Tooltip cursor={g.cursor} {...g.tooltip} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entregados" name="Entregados" fill="rgb(var(--av-accent-dato))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="solicitudes" name="Solicitudes" fill={g.barraNeutra} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tipo de entregables (mes)</CardTitle>
              </CardHeader>
              <CardContent>
                <DonaTipoEntregables datos={tipoEntregables} g={g} />
              </CardContent>
            </Card>
          </div>

          {puedeVerMetricasGlobales(usuario) && (
            <Card>
              <CardHeader>
                <CardTitle>Trabajos cumplidos por mes</CardTitle>
              </CardHeader>
              <CardContent className="h-48">
                {entregadosPorMes.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Aún no hay entregables marcados como entregados.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entregadosPorMes}>
                      <CartesianGrid strokeDasharray="3 3" stroke={g.grid} vertical={false} />
                      <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} tick={g.tick} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} tick={g.tick} />
                      <Tooltip cursor={g.cursor} {...g.tooltip} />
                      <Bar dataKey="total" name="Cumplidos" fill="rgb(var(--av-accent-dato))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Requisiciones recientes</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 font-medium">Folio</th>
                      <th className="py-2 font-medium">Título</th>
                      <th className="py-2 font-medium">Tipo</th>
                      <th className="py-2 font-medium">Fecha requerida</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisiciones.slice(0, 5).map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-medium">{r.folio}</td>
                        <td className="py-2.5">{r.titulo}</td>
                        <td className="py-2.5">{CATEGORIA_CONTENIDO_LABELS[r.tipoContenido]}</td>
                        <td className="py-2.5 text-muted-foreground">{formatFecha(r.fechaRequerida)}</td>
                        <td className="py-2.5">
                          <Badge variant={ESTADO_REQUISICION_BADGE[r.estado]}>
                            {ESTADO_REQUISICION_LABELS[r.estado]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carga de trabajo del equipo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cargaPorColaborador.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Sin colaboradores registrados todavía.
                  </p>
                )}
                {cargaPorColaborador.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-muted-foreground">
                        {c.carga.activas} {c.carga.activas === 1 ? "tarea" : "tareas"}
                        {c.carga.atrasadas > 0 && (
                          <span className="ml-1 font-medium text-destructive">· {c.carga.atrasadas} atrasada{c.carga.atrasadas === 1 ? "" : "s"}</span>
                        )}
                        {" · "}
                        {c.carga.porcentaje}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(c.carga.porcentaje, 100)}
                      indicadorClassName={
                        c.carga.nivel === "saturado" ? "bg-red-500" : c.carga.nivel === "ocupado" ? "bg-amber-500" : "bg-green-500"
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {tareasAtrasadas.length > 0 && (
            <Card className="border-red-300 bg-red-50 dark:border-red-400/30 dark:bg-red-400/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-200">
                  <AlertTriangle className="h-4.5 w-4.5" /> Tareas atrasadas ({tareasAtrasadas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tareasAtrasadas.slice(0, 8).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => navigate(`/entregables?abrir=${e.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-md bg-card/70 px-3 py-2 text-left text-sm hover:bg-card"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {nombreDe(e.responsableId)}
                        {proyectoDe(e.proyectoId) ? ` · ${proyectoDe(e.proyectoId)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-red-700 dark:text-red-300">
                      Vencio {formatFecha(e.fechaCompromiso)}
                    </span>
                  </button>
                ))}
                {tareasAtrasadas.length > 8 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    +{tareasAtrasadas.length - 8} más
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {actividadReciente.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
              )}
              {actividadReciente.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-secondary">
                    <a.icono className="h-3.5 w-3.5 text-text-primary/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.texto}</p>
                    <p className="text-xs text-muted-foreground">{a.detalle}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {formatDistanceToNow(a.cuando, { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {formatDistanceToNow(a.cuando, { addSuffix: true, locale: es })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
