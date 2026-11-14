import { useMemo, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layers, Minus, Plus, Star, Video } from "lucide-react";
import { useProyectos } from "@/hooks/useProyectos";
import { useEntregables, useUsuarios } from "@/hooks/useCatalogos";
import { useColaboradoresDelEquipo } from "@/hooks/useColaboradoresDelEquipo";
import { useGuiones } from "@/hooks/useGuiones";
import { especialidadesPara } from "@/lib/especialidades";
import { cargaDeTrabajo, entregablesPorResponsable } from "@/lib/rendimiento";
import { useCrearEntregable } from "@/hooks/useEntregables";
import { CATEGORIA_CONTENIDO_LABELS, esCategoriaFotografia, PRIORIDAD_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { CategoriaContenido, Prioridad } from "@/types";

/** Sentinel del Select — Radix no acepta value="" en un SelectItem. Se convierte a
 * `undefined` (sin proyecto/requisicion) justo antes de crear el entregable. */
const SIN_PROYECTO = "sin-proyecto";
const SIN_GUION = "sin-guion";

const schema = z
  .object({
    // El nombre se valida a mano en `onSubmit` (ver mas abajo): en modo capsula no existe un solo
    // campo "nombre" (es un nombre base + numero por video), asi que aqui queda sin requerir.
    proyectoId: z.string().min(1, "Elige un proyecto o “Sin proyecto”"),
    responsableId: z.string().min(1, "Elige a quién se asigna"),
    tipo: z.custom<CategoriaContenido>((v) => typeof v === "string" && v.length > 0, "Elige el tipo de trabajo"),
    fechaCompromiso: z.string().min(1, "Elige la fecha de entrega"),
    prioridad: z.custom<Prioridad>((v) => typeof v === "string" && v.length > 0, "Elige la prioridad"),
    guionId: z.string().optional(),
    urlPaginaWeb: z.string().optional(),
  })
  // Solo "Cambios en pagina web" pide el link — las demas categorias ni muestran el campo.
  .superRefine((values, ctx) => {
    if (values.tipo === "pagina_web" && !values.urlPaginaWeb?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["urlPaginaWeb"], message: "Pega el link de la página" });
    }
  });

type FormValues = z.infer<typeof schema>;

export function NuevoEntregableDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "uno" = flujo de siempre (un campo Nombre). "capsula" = varios videos de un jalon que
  // comparten proyecto/responsable/tipo/fecha/prioridad — solo cambia el nombre de cada uno
  // (base + numero automatico). Crea las tarjetas vacias nada mas; el video de cada una se sube
  // despues, individual, igual que siempre desde su propia tarjeta.
  const [modo, setModo] = useState<"uno" | "capsula">("uno");
  const [nombre, setNombre] = useState("");
  const [nombreBase, setNombreBase] = useState("");
  const [cantidadCapsula, setCantidadCapsula] = useState(3);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const { data: proyectos = [] } = useProyectos();
  const { data: usuarios = [] } = useUsuarios();
  const crear = useCrearEntregable();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { proyectoId: SIN_PROYECTO, guionId: SIN_GUION, prioridad: "media" },
  });

  const { data: equipo = [] } = useColaboradoresDelEquipo();
  const { data: entregables = [] } = useEntregables();
  const { data: guiones = [] } = useGuiones();
  const tipo = useWatch({ control, name: "tipo" });
  const proyectoId = useWatch({ control, name: "proyectoId" });

  // Solo tiene sentido en video (fotografia/diseño no llevan dialogo) — mismo criterio que
  // RevisarEntregableDialog.tsx. Un guion aprobado "suelto" (sin proyecto) solo aplica cuando
  // tampoco se eligio proyecto aqui.
  const puedeVincularGuion =
    Boolean(tipo) && tipo !== "diseno_grafico" && tipo !== "pagina_web" && !esCategoriaFotografia(tipo);
  const proyectoParaGuion = proyectoId && proyectoId !== SIN_PROYECTO ? proyectoId : undefined;
  const guionesAprobados = useMemo(
    () => guiones.filter((g) => g.estado === "aprobado" && g.proyectoId === proyectoParaGuion),
    [guiones, proyectoParaGuion]
  );

  // Primero quien tiene la especialidad para este tipo de trabajo; entre iguales, el menos cargado.
  const colaboradores = useMemo(() => {
    const porResponsable = entregablesPorResponsable(entregables);
    return usuarios
      .filter((u) => u.rol === "colaborador_audiovisual" || u.rol === "lider_audiovisual")
      .map((u) => {
        const perfil = equipo.find((c) => c.id === u.id);
        return {
          ...u,
          fuertes: especialidadesPara(tipo, perfil?.especialidades ?? u.especialidades),
          carga: cargaDeTrabajo(porResponsable.get(u.id) ?? []).activas,
        };
      })
      .sort((a, b) => Number(b.fuertes.length > 0) - Number(a.fuertes.length > 0) || a.carga - b.carga);
  }, [usuarios, equipo, entregables, tipo]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setErrorNombre(null);

    // Nombre(s): en "uno" es el campo de siempre; en "capsula" se generan a partir del nombre
    // base + numero (ej. "Capsula Semana 46" -> "Capsula Semana 46 - 1", "- 2", "- 3"...).
    const nombres =
      modo === "uno"
        ? [nombre.trim()]
        : Array.from({ length: cantidadCapsula }, (_, i) => `${nombreBase.trim()} - ${i + 1}`);
    if (modo === "uno" && nombre.trim().length < 3) {
      setErrorNombre("Escribe al menos 3 caracteres");
      return;
    }
    if (modo === "capsula" && nombreBase.trim().length < 3) {
      setErrorNombre("Escribe al menos 3 caracteres");
      return;
    }

    const compartido = {
      ...(values.proyectoId !== SIN_PROYECTO ? { proyectoId: values.proyectoId } : {}),
      responsableId: values.responsableId,
      tipo: values.tipo,
      fechaCompromiso: values.fechaCompromiso,
      prioridad: values.prioridad,
      ...(values.guionId && values.guionId !== SIN_GUION ? { guionId: values.guionId } : {}),
      ...(values.tipo === "pagina_web" && values.urlPaginaWeb ? { urlPaginaWeb: values.urlPaginaWeb.trim() } : {}),
    };

    let creados = 0;
    try {
      // Secuencial, no Promise.all — si una falla a medias de la capsula, se sabe exactamente
      // cuantas SI quedaron creadas (el mensaje de error de abajo lo dice) en vez de quedar en
      // un estado ambiguo por llamadas en paralelo.
      for (const n of nombres) {
        await crear.mutateAsync({ nombre: n, ...compartido });
        creados++;
      }
      reset({ proyectoId: SIN_PROYECTO, guionId: SIN_GUION, prioridad: "media" });
      setNombre("");
      setNombreBase("");
      setCantidadCapsula(3);
      setModo("uno");
      setOpen(false);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "error desconocido";
      setError(
        nombres.length > 1
          ? `Se crearon ${creados} de ${nombres.length} videos de la capsula; se detuvo por: ${motivo}`
          : motivo
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Nuevo entregable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo entregable</DialogTitle>
          <DialogDescription>Asigna el trabajo a un colaborador del equipo. Los campos con * son obligatorios.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* "Uno" = flujo de siempre. "Capsula" = varios videos de un jalon (ej. 3 entrevistas
              de la misma semana) que comparten todo lo demas del formulario — solo cambia el
              nombre, generado automatico a partir de una base. Crea solo las tarjetas; el video
              de cada una se sube despues, individual, igual que siempre. */}
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setModo("uno")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                modo === "uno" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-bg-secondary"
              )}
            >
              <Video className="h-3.5 w-3.5" /> Uno
            </button>
            <button
              type="button"
              onClick={() => setModo("capsula")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                modo === "capsula" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-bg-secondary"
              )}
            >
              <Layers className="h-3.5 w-3.5" /> Capsula (varios videos)
            </button>
          </div>

          {modo === "uno" ? (
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre del entregable *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Video institucional planta - corte 1"
              />
              {errorNombre && <p className="text-xs text-destructive">{errorNombre}</p>}
            </div>
          ) : (
            <div className="space-y-1.5 rounded-md border border-dashed border-border p-3">
              <Label htmlFor="nombreBase">Nombre base de la capsula *</Label>
              <Input
                id="nombreBase"
                value={nombreBase}
                onChange={(e) => setNombreBase(e.target.value)}
                placeholder="Ej. Testimonios Semana 46"
              />
              <div className="flex items-center gap-2 pt-1">
                <Label className="shrink-0">Cuantos videos</Label>
                <button
                  type="button"
                  onClick={() => setCantidadCapsula((n) => Math.max(2, n - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-bg-secondary"
                  aria-label="Quitar uno"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{cantidadCapsula}</span>
                <button
                  type="button"
                  onClick={() => setCantidadCapsula((n) => Math.min(20, n + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-bg-secondary"
                  aria-label="Agregar uno"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {errorNombre && <p className="text-xs text-destructive">{errorNombre}</p>}
              {nombreBase.trim() && (
                <p className="text-[11px] text-muted-foreground">
                  Se crean: {Array.from({ length: cantidadCapsula }, (_, i) => `"${nombreBase.trim()} - ${i + 1}"`).join(", ")}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Mismo proyecto, responsable, tipo, fecha y prioridad para los {cantidadCapsula}. El video de cada uno se
                sube despues, individual, desde su propia tarjeta.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Proyecto (opcional)</Label>
            <Controller
              control={control}
              name="proyectoId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_PROYECTO}>Sin proyecto (trabajo directo)</SelectItem>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.proyectoId && <p className="text-xs text-destructive">{errors.proyectoId.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* order-2: el Tipo va primero — de el depende el orden sugerido de responsables. */}
            <div className="order-2 space-y-1.5">
              <Label>Responsable *</Label>
              <Controller
                control={control}
                name="responsableId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar a" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {/* `min-w-0` + `truncate` en cada parte — nombre + carga + especialidades
                              en una sola linea desbordaba el popover en pantallas de 360-375px. */}
                          <span className="flex min-w-0 max-w-[min(70vw,22rem)] items-center gap-1.5">
                            {c.fuertes.length > 0 && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                            <span className="truncate">{c.nombre}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                              · {c.carga} {c.carga === 1 ? "tarea" : "tareas"}
                              {c.fuertes.length > 0 && ` · ${c.fuertes.join(", ")}`}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.responsableId && <p className="text-xs text-destructive">{errors.responsableId.message}</p>}
              {!tipo && <p className="text-[11px] text-muted-foreground">Elige primero el tipo de trabajo: marcamos con ★ a quien tiene esa especialidad.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de trabajo *</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIA_CONTENIDO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha compromiso *</Label>
              <Controller
                control={control}
                name="fechaCompromiso"
                render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
              />
              {errors.fechaCompromiso && <p className="text-xs text-destructive">{errors.fechaCompromiso.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad *</Label>
              <Controller
                control={control}
                name="prioridad"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORIDAD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.prioridad && <p className="text-xs text-destructive">{errors.prioridad.message}</p>}
            </div>
          </div>

          {tipo === "pagina_web" && (
            <div className="space-y-1.5">
              <Label htmlFor="urlPaginaWeb">Link de la página *</Label>
              <Input id="urlPaginaWeb" {...register("urlPaginaWeb")} placeholder="https://grupo-ortiz.com/..." />
              {errors.urlPaginaWeb && <p className="text-xs text-destructive">{errors.urlPaginaWeb.message}</p>}
            </div>
          )}

          {puedeVincularGuion && guionesAprobados.length > 0 && (
            <div className="space-y-1.5">
              <Label>Guion ya aprobado (opcional)</Label>
              <Controller
                control={control}
                name="guionId"
                render={({ field }) => (
                  <Select value={field.value ?? SIN_GUION} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin guion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_GUION}>Sin guion</SelectItem>
                      {guionesAprobados.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                Si ya tienes el guion listo, anexalo aqui para que quien lo revise lo vea y genere la voz.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending
                ? "Creando..."
                : modo === "capsula"
                  ? `Crear ${cantidadCapsula} videos`
                  : "Crear y asignar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
