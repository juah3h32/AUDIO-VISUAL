import { useMemo, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Star } from "lucide-react";
import { useProyectos } from "@/hooks/useProyectos";
import { useEntregables, useUsuarios } from "@/hooks/useCatalogos";
import { useColaboradoresDelEquipo } from "@/hooks/useColaboradoresDelEquipo";
import { useGuiones } from "@/hooks/useGuiones";
import { especialidadesPara } from "@/lib/especialidades";
import { cargaDeTrabajo, entregablesPorResponsable } from "@/lib/rendimiento";
import { useCrearEntregable } from "@/hooks/useEntregables";
import { CATEGORIA_CONTENIDO_LABELS, esCategoriaFotografia } from "@/lib/labels";
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
import type { CategoriaContenido } from "@/types";

/** Sentinel del Select — Radix no acepta value="" en un SelectItem. Se convierte a
 * `undefined` (sin proyecto/requisicion) justo antes de crear el entregable. */
const SIN_PROYECTO = "sin-proyecto";
const SIN_GUION = "sin-guion";

const schema = z.object({
  nombre: z.string().min(3, "Escribe al menos 3 caracteres"),
  proyectoId: z.string().min(1, "Elige un proyecto o “Sin proyecto”"),
  responsableId: z.string().min(1, "Elige a quién se asigna"),
  tipo: z.custom<CategoriaContenido>((v) => typeof v === "string" && v.length > 0, "Elige el tipo de trabajo"),
  fechaCompromiso: z.string().min(1, "Elige la fecha de entrega"),
  guionId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NuevoEntregableDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: proyectos = [] } = useProyectos();
  const { data: usuarios = [] } = useUsuarios();
  const crear = useCrearEntregable();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { proyectoId: SIN_PROYECTO, guionId: SIN_GUION } });

  const { data: equipo = [] } = useColaboradoresDelEquipo();
  const { data: entregables = [] } = useEntregables();
  const { data: guiones = [] } = useGuiones();
  const tipo = useWatch({ control, name: "tipo" });
  const proyectoId = useWatch({ control, name: "proyectoId" });

  // Solo tiene sentido en video (fotografia/diseño no llevan dialogo) — mismo criterio que
  // RevisarEntregableDialog.tsx. Un guion aprobado "suelto" (sin proyecto) solo aplica cuando
  // tampoco se eligio proyecto aqui.
  const puedeVincularGuion = Boolean(tipo) && tipo !== "diseno_grafico" && !esCategoriaFotografia(tipo);
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
    try {
      await crear.mutateAsync({
        nombre: values.nombre,
        ...(values.proyectoId !== SIN_PROYECTO ? { proyectoId: values.proyectoId } : {}),
        responsableId: values.responsableId,
        tipo: values.tipo,
        fechaCompromiso: values.fechaCompromiso,
        ...(values.guionId && values.guionId !== SIN_GUION ? { guionId: values.guionId } : {}),
      });
      reset({ proyectoId: SIN_PROYECTO, guionId: SIN_GUION });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el entregable.");
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
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del entregable *</Label>
            <Input id="nombre" {...register("nombre")} placeholder="Ej. Video institucional planta - corte 1" />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

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
                          <span className="flex items-center gap-1.5">
                            {c.fuertes.length > 0 && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                            {c.nombre}
                            <span className="text-xs text-muted-foreground">
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

          <div className="space-y-1.5">
            <Label>Fecha compromiso *</Label>
            <Controller
              control={control}
              name="fechaCompromiso"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
            {errors.fechaCompromiso && <p className="text-xs text-destructive">{errors.fechaCompromiso.message}</p>}
          </div>

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
              {crear.isPending ? "Creando..." : "Crear y asignar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
