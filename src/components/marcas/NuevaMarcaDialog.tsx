import { useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { useCrearMarca } from "@/hooks/useMarcas";
import { subirArchivoCentralizado } from "@/services/driveService";
import { mensajeErrorAuth } from "@/lib/authErrors";
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
import type { AssetMarca } from "@/types";

const schema = z.object({
  nombre: z.string().min(2, "Minimo 2 caracteres"),
  descripcion: z.string().optional(),
  tipografia: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NuevaMarcaDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colores, setColores] = useState<string[]>(["#C1EB1F"]);
  const [assets, setAssets] = useState<AssetMarca[]>([]);
  const [manualUrl, setManualUrl] = useState<string | undefined>(undefined);
  const [subiendo, setSubiendo] = useState<"logo" | "manual" | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const inputManualRef = useRef<HTMLInputElement>(null);
  const crear = useCrearMarca();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const nombreMarca = watch("nombre");

  const limpiarTodo = () => {
    reset();
    setColores(["#C1EB1F"]);
    setAssets([]);
    setManualUrl(undefined);
    setError(null);
  };

  const onSubirLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!nombreMarca) {
      setError("Escribe el nombre de la marca antes de subir archivos.");
      return;
    }
    setError(null);
    setSubiendo("logo");
    try {
      const subido = await subirArchivoCentralizado(file, {
        nombre: `${nombreMarca} - Logo`,
        nombreCarpeta: nombreMarca,
        subcarpeta: "Logos",
      });
      setAssets((prev) => [
        ...prev,
        { id: subido.id, tipo: "logo", nombre: file.name, url: subido.viewUrl, fileId: subido.id },
      ]);
    } catch (err) {
      setError(mensajeErrorAuth(err));
    } finally {
      setSubiendo(null);
    }
  };

  const onSubirManual = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!nombreMarca) {
      setError("Escribe el nombre de la marca antes de subir archivos.");
      return;
    }
    setError(null);
    setSubiendo("manual");
    try {
      const subido = await subirArchivoCentralizado(file, {
        nombre: `${nombreMarca} - Manual de identidad`,
        nombreCarpeta: nombreMarca,
        subcarpeta: "Manual",
      });
      setManualUrl(subido.viewUrl);
      setAssets((prev) => [
        ...prev,
        { id: subido.id, tipo: "pdf", nombre: file.name, url: subido.viewUrl, fileId: subido.id },
      ]);
    } catch (err) {
      setError(mensajeErrorAuth(err));
    } finally {
      setSubiendo(null);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await crear.mutateAsync({
        nombre: values.nombre,
        ...(values.descripcion ? { descripcion: values.descripcion } : {}),
        ...(values.tipografia ? { tipografia: values.tipografia } : {}),
        colores: colores.filter(Boolean),
        assets,
        ...(manualUrl ? { manualUrl } : {}),
      });
      limpiarTodo();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la marca.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) limpiarTodo();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Nueva marca
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva marca</DialogTitle>
          <DialogDescription>
            Registra el manual de identidad: colores, logos y, si lo tienes, el PDF completo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la marca</Label>
            <Input id="nombre" {...register("nombre")} placeholder="Ej. Grupo Ortiz" />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripcion (opcional)</Label>
            <Input id="descripcion" {...register("descripcion")} placeholder="Ej. Linea institucional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipografia">Tipografia principal (opcional)</Label>
            <Input id="tipografia" {...register("tipografia")} placeholder="Ej. Montserrat, Helvetica Neue Bold" />
          </div>

          <div className="space-y-1.5">
            <Label>Paleta de colores</Label>
            <div className="flex flex-wrap gap-2">
              {colores.map((color, i) => (
                <div key={i} className="flex items-center gap-1 rounded-md border border-border p-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) =>
                      setColores((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))
                    }
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <Input
                    value={color}
                    onChange={(e) =>
                      setColores((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))
                    }
                    className="h-8 w-24 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setColores((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColores((prev) => [...prev, "#000000"])}
              >
                <Plus className="h-3.5 w-3.5" /> Color
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Logos</Label>
            <input ref={inputLogoRef} type="file" accept="image/*" className="hidden" onChange={onSubirLogo} />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => inputLogoRef.current?.click()}
              disabled={subiendo !== null}
            >
              <Upload className="h-4 w-4" /> {subiendo === "logo" ? "Subiendo..." : "Subir logo a Drive"}
            </Button>
            {assets
              .filter((a) => a.tipo === "logo")
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md bg-bg-secondary px-2 py-1 text-xs">
                  <span className="truncate">{a.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>

          <div className="space-y-1.5">
            <Label>Manual de identidad (PDF, opcional)</Label>
            <input
              ref={inputManualRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onSubirManual}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => inputManualRef.current?.click()}
              disabled={subiendo !== null}
            >
              <Upload className="h-4 w-4" /> {subiendo === "manual" ? "Subiendo..." : "Subir manual (PDF)"}
            </Button>
            {manualUrl && <p className="truncate text-xs text-muted-foreground">Cargado: {manualUrl}</p>}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending || subiendo !== null}>
              {crear.isPending ? "Creando..." : "Crear marca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
