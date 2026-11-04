import { useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { useActualizarMarca } from "@/hooks/useMarcas";
import { subirArchivoCentralizado } from "@/services/driveService";
import { mensajeErrorAuth } from "@/lib/authErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetMarca, Marca } from "@/types";

const schema = z.object({
  nombre: z.string().min(2, "Minimo 2 caracteres"),
  descripcion: z.string().optional(),
  tipografia: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Edita una marca YA creada: nombre/descripcion/tipografia/colores, agregar o quitar logos, y
 * reemplazar el manual de identidad. Misma logica de subida que NuevaMarcaDialog.tsx (no se
 * comparte componente porque una parte de un lado solo tiene sentido al crear — nombre vacio
 * todavia — y del otro solo al editar — reemplazar un manual que ya existe).
 *
 * `key={marca.id}` en MarcasPage.tsx fuerza un remount al cambiar de marca seleccionada, asi el
 * estado local siempre arranca de los datos de ESA marca sin necesitar un useEffect de sincronizacion.
 */
export function EditarMarcaDialog({
  marca,
  open,
  onOpenChange,
}: {
  marca: Marca;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [colores, setColores] = useState<string[]>(marca.colores.length > 0 ? marca.colores : ["#C1EB1F"]);
  const [assets, setAssets] = useState<AssetMarca[]>(marca.assets);
  const [manualUrl, setManualUrl] = useState<string | undefined>(marca.manualUrl);
  const [subiendo, setSubiendo] = useState<"logo" | "manual" | "tipografia" | null>(null);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const inputManualRef = useRef<HTMLInputElement>(null);
  const inputTipografiaRef = useRef<HTMLInputElement>(null);
  const actualizar = useActualizarMarca();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: marca.nombre, descripcion: marca.descripcion, tipografia: marca.tipografia },
  });

  const onSubirLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSubiendo("logo");
    try {
      const subido = await subirArchivoCentralizado(file, {
        nombre: `${marca.nombre} - Logo`,
        nombreCarpeta: marca.nombre,
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
    setError(null);
    setSubiendo("manual");
    try {
      const subido = await subirArchivoCentralizado(file, {
        nombre: `${marca.nombre} - Manual de identidad`,
        nombreCarpeta: marca.nombre,
        subcarpeta: "Manual",
      });
      setManualUrl(subido.viewUrl);
      // Reemplaza el manual anterior (si habia) en vez de acumular varios — solo hay un
      // `manualUrl` por marca, asi que un segundo PDF cargado aqui sustituye al primero.
      setAssets((prev) => [
        ...prev.filter((a) => a.tipo !== "pdf"),
        { id: subido.id, tipo: "pdf", nombre: file.name, url: subido.viewUrl, fileId: subido.id },
      ]);
    } catch (err) {
      setError(mensajeErrorAuth(err));
    } finally {
      setSubiendo(null);
    }
  };

  const onSubirTipografia = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSubiendo("tipografia");
    try {
      const subido = await subirArchivoCentralizado(file, {
        nombre: `${marca.nombre} - Tipografia`,
        nombreCarpeta: marca.nombre,
        subcarpeta: "Tipografia",
      });
      setAssets((prev) => [
        ...prev,
        { id: subido.id, tipo: "tipografia", nombre: file.name, url: subido.viewUrl, fileId: subido.id },
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
      await actualizar.mutateAsync({
        id: marca.id,
        cambios: {
          nombre: values.nombre,
          descripcion: values.descripcion || undefined,
          tipografia: values.tipografia || undefined,
          colores: colores.filter(Boolean),
          assets,
          manualUrl,
        },
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la marca.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {marca.nombre}</DialogTitle>
          <DialogDescription>Actualiza datos, agrega logos o reemplaza el manual de identidad.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nombre">Nombre de la marca</Label>
            <Input id="edit-nombre" {...register("nombre")} placeholder="Ej. Grupo Ortiz" />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-descripcion">Descripcion (opcional)</Label>
            <Input id="edit-descripcion" {...register("descripcion")} placeholder="Ej. Linea institucional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tipografia">Tipografia principal (opcional)</Label>
            <Input id="edit-tipografia" {...register("tipografia")} placeholder="Ej. Montserrat, Helvetica Neue Bold" />
            <input
              ref={inputTipografiaRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              onChange={onSubirTipografia}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => inputTipografiaRef.current?.click()}
              disabled={subiendo !== null}
            >
              <Upload className="h-3.5 w-3.5" />
              {subiendo === "tipografia" ? "Subiendo..." : "Agregar archivo de fuente (.ttf/.otf/.woff)"}
            </Button>
            {assets
              .filter((a) => a.tipo === "tipografia")
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
            <Label>Paleta de colores</Label>
            <div className="flex flex-wrap gap-2">
              {colores.map((color, i) => (
                <div key={i} className="flex items-center gap-1 rounded-md border border-border p-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColores((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))}
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColores((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))}
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
              <Button type="button" variant="outline" size="sm" onClick={() => setColores((prev) => [...prev, "#000000"])}>
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
              <Upload className="h-4 w-4" /> {subiendo === "logo" ? "Subiendo..." : "Agregar logo a Drive"}
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
            <input ref={inputManualRef} type="file" accept="application/pdf" className="hidden" onChange={onSubirManual} />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => inputManualRef.current?.click()}
              disabled={subiendo !== null}
            >
              <Upload className="h-4 w-4" /> {subiendo === "manual" ? "Subiendo..." : manualUrl ? "Reemplazar manual (PDF)" : "Subir manual (PDF)"}
            </Button>
            {manualUrl && <p className="truncate text-xs text-muted-foreground">Cargado: {manualUrl}</p>}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={actualizar.isPending || subiendo !== null}>
              {actualizar.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
