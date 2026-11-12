import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCrearPlanta, useCrearSalida, usePlantas, useUsuarios } from "@/hooks/useCatalogos";
import { useProyectos } from "@/hooks/useProyectos";
import { TIPO_ACTIVIDAD_SALIDA_LABELS } from "@/lib/labels";
import { aFecha } from "@/lib/periodo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import type { TipoActividadSalida } from "@/types";

/** Las salidas casi siempre son en Uber o en auto de empresa — autobus queda de ultimo recurso
 * (viajes grandes/grupales). Antes era texto libre y cada quien ponia algo distinto. */
const OPCIONES_TRANSPORTE = ["Uber", "Auto de empresa", "Autobus"] as const;

const SIN_PROYECTO_SALIDA = "sin-proyecto-salida";
const NUEVA_PLANTA = "nueva-planta";

/** Recorridos de reconocimiento, entrevistas recurrentes, etc. — en vez de crear cada semana
 * la misma salida a mano, se eligen cuantas semanas seguidas repetirla y se crean todas de una
 * vez (cada una es independiente despues: se puede editar o borrar una sin afectar al resto). */
const OPCIONES_REPETICION = [
  { valor: 0, etiqueta: "No se repite" },
  { valor: 3, etiqueta: "4 semanas seguidas" },
  { valor: 7, etiqueta: "8 semanas seguidas" },
  { valor: 11, etiqueta: "12 semanas seguidas" },
  { valor: 25, etiqueta: "26 semanas seguidas" },
  { valor: 51, etiqueta: "52 semanas seguidas" },
] as const;

function sumarSemanas(fechaIso: string, semanas: number): string {
  const d = aFecha(fechaIso);
  d.setDate(d.getDate() + semanas * 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const schema = z.object({
  nombreJornada: z.string().min(3, "Requerido"),
  tipoActividad: z.custom<TipoActividadSalida>((v) => typeof v === "string" && v.length > 0, "Requerido"),
  planta: z.string().min(2, "Requerido"),
  direccion: z.string().optional(),
  contactoPlanta: z.string().optional(),
  telefonoContacto: z.string().optional(),
  fecha: z.string().min(1, "Requerido"),
  horaSalida: z.string().min(1, "Requerido"),
  horaEstimadaLlegada: z.string().min(1, "Requerido"),
  responsableProduccionId: z.string().min(1, "Requerido"),
  proyectoId: z.string().optional(),
  transporte: z.string().optional(),
  observaciones: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NuevaSalidaDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creandoSerie, setCreandoSerie] = useState(false);
  const { usuario } = useAuth();
  const crear = useCrearSalida();
  const { data: usuarios = [] } = useUsuarios();
  const { data: proyectos = [] } = useProyectos();
  const { data: plantas = [] } = usePlantas();
  const crearPlantaMut = useCrearPlanta();
  // Quien va a la planta — antes se asignaba siempre al que crea la salida, sin forma de
  // mandar a otro colaborador. Arranca con el responsable de produccion ya elegido (se agrega
  // solo cuando se selecciona ese campo, ver mas abajo), y se puede sumar a mas gente.
  const [personalAsignado, setPersonalAsignado] = useState<string[]>([]);
  // "" = nada elegido todavia. Al elegir una planta del catalogo se autollena direccion/contacto/
  // telefono (siguen editables). Al elegir NUEVA_PLANTA se limpian para capturar una desde cero,
  // y esa planta se guarda en el catalogo al enviar el formulario (ver onSubmit).
  const [plantaId, setPlantaId] = useState<string>("");
  // Semanas ADICIONALES a crear ademas de la fecha capturada (0 = solo esta). Independiente del
  // formulario de react-hook-form porque no es un campo de la salida en si, solo controla cuantas
  // copias se generan al enviar.
  const [repetirSemanas, setRepetirSemanas] = useState(0);

  const equipo = usuarios.filter(
    (u) => u.rol === "colaborador_audiovisual" || u.rol === "lider_audiovisual" || u.rol === "superadmin"
  );
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.nombre ?? id;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const responsableElegido = watch("responsableProduccionId");
  const fechaElegida = watch("fecha");
  // El dia de la semana sale solo de la fecha elegida (si se pone un martes, se repite cada
  // martes) — no hace falta un selector aparte de dia, solo mostrarlo para que quede claro.
  const diaSemanaElegido = fechaElegida ? aFecha(fechaElegida).toLocaleDateString("es-MX", { weekday: "long" }) : "";

  const onElegirPlanta = (value: string) => {
    setPlantaId(value);
    if (value === NUEVA_PLANTA) {
      setValue("planta", "");
      setValue("direccion", "");
      setValue("contactoPlanta", "");
      setValue("telefonoContacto", "");
      return;
    }
    const p = plantas.find((x) => x.id === value);
    if (!p) return;
    setValue("planta", p.nombre, { shouldValidate: true });
    setValue("direccion", p.direccion ?? "");
    setValue("contactoPlanta", p.contactoPlanta ?? "");
    setValue("telefonoContacto", p.telefonoContacto ?? "");
  };

  const onSubmit = async (values: FormValues) => {
    if (!usuario) return;
    setError(null);
    // El responsable de produccion siempre va incluido en el personal asignado, aunque no se
    // haya agregado a mano a la lista de abajo — no tendria sentido que "vaya" sin estar en ella.
    const personal = Array.from(new Set([values.responsableProduccionId, ...personalAsignado]));
    if (plantaId === NUEVA_PLANTA && values.planta) {
      try {
        await crearPlantaMut.mutateAsync({
          nombre: values.planta,
          direccion: values.direccion,
          contactoPlanta: values.contactoPlanta,
          telefonoContacto: values.telefonoContacto,
        });
      } catch {
        // No bloquea la creacion de la salida — si falla, la planta nueva simplemente no queda
        // guardada en el catalogo esta vez (se puede volver a capturar despues).
      }
    }
    try {
      const base = {
        nombreJornada: values.nombreJornada,
        proyectosRelacionados:
          values.proyectoId && values.proyectoId !== SIN_PROYECTO_SALIDA ? [values.proyectoId] : [],
        tipoActividad: values.tipoActividad,
        planta: values.planta,
        direccion: values.direccion,
        contactoPlanta: values.contactoPlanta,
        telefonoContacto: values.telefonoContacto,
        horaSalida: values.horaSalida,
        horaEstimadaLlegada: values.horaEstimadaLlegada,
        personalAsignado: personal,
        responsableProduccionId: values.responsableProduccionId,
        equipoRequerido: [],
        transporte: values.transporte,
        observaciones: values.observaciones,
      };
      // Secuencial (no Promise.all): cada una pide su propio folio consecutivo — mandarlas
      // todas a la vez no rompe el conteo (es transaccional), pero sí se ve raro si una falla
      // a medias; uno por uno es mas facil de seguir si algo truena.
      setCreandoSerie(true);
      for (let i = 0; i <= repetirSemanas; i++) {
        await crear.mutateAsync({ ...base, fecha: sumarSemanas(values.fecha, i) });
      }
      reset();
      setPersonalAsignado([]);
      setPlantaId("");
      setRepetirSemanas(0);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la salida.");
    } finally {
      setCreandoSerie(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Nueva salida
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva salida de grabacion</DialogTitle>
          <DialogDescription>
            Queda en estado "pendiente" hasta que el lider audiovisual la autorice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombreJornada">Nombre de la jornada</Label>
            <Input id="nombreJornada" {...register("nombreJornada")} placeholder="Ej. Visita Planta Stretch Film" />
            {errors.nombreJornada && <p className="text-xs text-destructive">{errors.nombreJornada.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de actividad</Label>
              <Controller
                control={control}
                name="tipoActividad"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_ACTIVIDAD_SALIDA_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipoActividad && <p className="text-xs text-destructive">{errors.tipoActividad.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Planta o locacion</Label>
              <Select value={plantaId} onValueChange={onElegirPlanta}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige la planta" />
                </SelectTrigger>
                <SelectContent>
                  {plantas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value={NUEVA_PLANTA}>+ Nueva planta</SelectItem>
                </SelectContent>
              </Select>
              {errors.planta && <p className="text-xs text-destructive">{errors.planta.message}</p>}
            </div>
          </div>

          {plantaId === NUEVA_PLANTA && (
            <div className="space-y-1.5">
              <Label htmlFor="planta">Nombre de la nueva planta</Label>
              <Input id="planta" {...register("planta")} placeholder="Ej. Sacos 2 (Sucursal)" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Direccion</Label>
              <Input id="direccion" {...register("direccion")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactoPlanta">Contacto en planta</Label>
              <Input id="contactoPlanta" {...register("contactoPlanta")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefonoContacto">Telefono del contacto (opcional)</Label>
            <Input id="telefonoContacto" {...register("telefonoContacto")} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsable de produccion (va a la planta)</Label>
              <Controller
                control={control}
                name="responsableProduccionId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quien va" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipo.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.responsableProduccionId && (
                <p className="text-xs text-destructive">{errors.responsableProduccionId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Proyecto relacionado (opcional)</Label>
              <Controller
                control={control}
                name="proyectoId"
                render={({ field }) => (
                  <Select value={field.value ?? SIN_PROYECTO_SALIDA} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_PROYECTO_SALIDA}>Sin proyecto</SelectItem>
                      {proyectos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Personal adicional (opcional)</Label>
            <Select
              value=""
              onValueChange={(v) => setPersonalAsignado((actual) => (actual.includes(v) ? actual : [...actual, v]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Agregar a alguien mas" />
              </SelectTrigger>
              <SelectContent>
                {equipo
                  .filter((u) => u.id !== responsableElegido && !personalAsignado.includes(u.id))
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {personalAsignado.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {personalAsignado.map((id) => (
                  <Badge key={id} variant="default" className={cn("gap-1 pr-1")}>
                    {nombreDe(id)}
                    <button
                      type="button"
                      onClick={() => setPersonalAsignado((actual) => actual.filter((x) => x !== id))}
                      className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label={`Quitar a ${nombreDe(id)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              El responsable de produccion ya va incluido — agrega aqui solo a quien mas lo acompaña.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" {...register("fecha")} />
              {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horaSalida">Hora de salida</Label>
              <Input id="horaSalida" type="time" {...register("horaSalida")} />
              {errors.horaSalida && <p className="text-xs text-destructive">{errors.horaSalida.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horaEstimadaLlegada">Hora estimada llegada</Label>
              <Input id="horaEstimadaLlegada" type="time" {...register("horaEstimadaLlegada")} />
              {errors.horaEstimadaLlegada && (
                <p className="text-xs text-destructive">{errors.horaEstimadaLlegada.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Se repite</Label>
            <Select value={String(repetirSemanas)} onValueChange={(v) => setRepetirSemanas(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_REPETICION.map((op) => (
                  <SelectItem key={op.valor} value={String(op.valor)}>
                    {op.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {repetirSemanas > 0 && (
              <p className="text-xs text-muted-foreground">
                Se crean {repetirSemanas + 1} salidas, cada{" "}
                {diaSemanaElegido ? <span className="font-medium text-text-primary">{diaSemanaElegido}</span> : "semana"}{" "}
                a partir de la fecha de arriba — cada una se puede editar o borrar despues por separado.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Transporte</Label>
            <Controller
              control={control}
              name="transporte"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_TRANSPORTE.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observaciones">Observaciones / seguridad</Label>
            <Textarea id="observaciones" {...register("observaciones")} rows={2} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creandoSerie}>
              {creandoSerie
                ? repetirSemanas > 0
                  ? "Creando serie..."
                  : "Guardando..."
                : repetirSemanas > 0
                  ? `Crear ${repetirSemanas + 1} salidas`
                  : "Crear salida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
