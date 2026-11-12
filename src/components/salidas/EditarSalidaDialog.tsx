import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { useActualizarSalida, useUsuarios } from "@/hooks/useCatalogos";
import { TIPO_ACTIVIDAD_SALIDA_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SalidaGrabacion, TipoActividadSalida } from "@/types";

const OPCIONES_TRANSPORTE = ["Uber", "Auto de empresa", "Autobus"] as const;

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
  transporte: z.string().optional(),
  observaciones: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Editar una salida ya creada — sobre todo para corregir fecha/hora cuando se capturo mal o
 * cambio de planes, sin tener que borrarla y crearla de nuevo (eso perdia quien ya la habia
 * autorizado). No toca personal adicional ni proyecto relacionado — eso se reasigna poco y no
 * vale la pena duplicar aqui toda la logica de catalogo de plantas de Nueva salida. */
export function EditarSalidaDialog({ salida }: { salida: SalidaGrabacion }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actualizar = useActualizarSalida();
  const { data: usuarios = [] } = useUsuarios();
  const equipo = usuarios.filter(
    (u) => u.rol === "colaborador_audiovisual" || u.rol === "lider_audiovisual" || u.rol === "superadmin"
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Repoblar el formulario cada vez que se abre (si se edita otra salida sin desmontar este
  // dialogo, o si la salida cambio por fuera mientras estaba cerrado).
  useEffect(() => {
    if (!open) return;
    reset({
      nombreJornada: salida.nombreJornada,
      tipoActividad: salida.tipoActividad,
      planta: salida.planta,
      direccion: salida.direccion ?? "",
      contactoPlanta: salida.contactoPlanta ?? "",
      telefonoContacto: salida.telefonoContacto ?? "",
      fecha: salida.fecha,
      horaSalida: salida.horaSalida,
      horaEstimadaLlegada: salida.horaEstimadaLlegada,
      responsableProduccionId: salida.responsableProduccionId,
      transporte: salida.transporte ?? "",
      observaciones: salida.observaciones ?? "",
    });
  }, [open, salida, reset]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await actualizar.mutateAsync({ id: salida.id, cambios: values });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cambio.");
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1 px-2.5 text-xs"
        title="Editar esta salida"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar salida</DialogTitle>
          <DialogDescription>{salida.folio} — {salida.nombreJornada}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-nombreJornada">Nombre de la jornada</Label>
            <Input id="e-nombreJornada" {...register("nombreJornada")} />
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
              <Label htmlFor="e-planta">Planta o locacion</Label>
              <Input id="e-planta" {...register("planta")} />
              {errors.planta && <p className="text-xs text-destructive">{errors.planta.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-direccion">Direccion</Label>
              <Input id="e-direccion" {...register("direccion")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-contactoPlanta">Contacto en planta</Label>
              <Input id="e-contactoPlanta" {...register("contactoPlanta")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-telefonoContacto">Telefono del contacto (opcional)</Label>
            <Input id="e-telefonoContacto" {...register("telefonoContacto")} />
          </div>

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-fecha">Fecha</Label>
              <Input id="e-fecha" type="date" {...register("fecha")} />
              {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-horaSalida">Hora de salida</Label>
              <Input id="e-horaSalida" type="time" {...register("horaSalida")} />
              {errors.horaSalida && <p className="text-xs text-destructive">{errors.horaSalida.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-horaEstimadaLlegada">Hora estimada llegada</Label>
              <Input id="e-horaEstimadaLlegada" type="time" {...register("horaEstimadaLlegada")} />
              {errors.horaEstimadaLlegada && (
                <p className="text-xs text-destructive">{errors.horaEstimadaLlegada.message}</p>
              )}
            </div>
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
            <Label htmlFor="e-observaciones">Observaciones / seguridad</Label>
            <Textarea id="e-observaciones" {...register("observaciones")} rows={2} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={actualizar.isPending}>
              {actualizar.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
