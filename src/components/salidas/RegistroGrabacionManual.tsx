import { useState } from "react";
import { Image as ImageIcon, Plus, Trash2, Video } from "lucide-react";
import { useCrearRegistroGrabacion, useEliminarRegistroGrabacion, useRegistrosGrabacion } from "@/hooks/useCatalogos";
import { partesFecha } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoRegistroGrabacion } from "@/types";

const TIPO_LABELS: Record<TipoRegistroGrabacion, string> = {
  grabacion: "Grabación",
  fotografia: "Sesión de fotos",
};

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Bitacora manual: SOLO superadmin la ve y la captura (gate real esta en el backend, ver
 * puedeVer/api/db/registros-grabacion.ts) — a diferencia de SalidasPage (logistica formal de una
 * jornada completa), esto es nomas anotar "hoy se grabaron 2 videos" sin crear una salida. */
export function RegistroGrabacionManual({ usuarioId }: { usuarioId: string }) {
  const { data: registros = [], isLoading } = useRegistrosGrabacion();
  const crear = useCrearRegistroGrabacion();
  const eliminar = useEliminarRegistroGrabacion();
  const [fecha, setFecha] = useState(hoyIso());
  const [cantidad, setCantidad] = useState("1");
  const [tipo, setTipo] = useState<TipoRegistroGrabacion>("grabacion");
  const [nota, setNota] = useState("");

  const onAgregar = async () => {
    const cantidadNum = parseInt(cantidad, 10);
    if (!fecha || !cantidadNum || cantidadNum < 1) return;
    await crear.mutateAsync({
      data: { fecha, cantidad: cantidadNum, tipo, nota: nota.trim() || undefined },
      creadoPorId: usuarioId,
    });
    setCantidad("1");
    setNota("");
  };

  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-3">
        <Label className="text-xs font-semibold text-muted-foreground">
          Bitacora manual (solo tu la ves)
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="rg-fecha" className="text-xs">Fecha</Label>
            <Input id="rg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rg-cantidad" className="text-xs">Cantidad</Label>
            <Input
              id="rg-cantidad"
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRegistroGrabacion)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as TipoRegistroGrabacion[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label htmlFor="rg-nota" className="text-xs">Nota (opcional)</Label>
            <Input id="rg-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. producto X" className="h-9" />
          </div>
          <Button type="button" size="sm" className="h-9" onClick={onAgregar} disabled={crear.isPending}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {!isLoading && registros.length > 0 && (
          <div className="space-y-1 pt-1">
            {registros.map((r) => {
              const { dia, diaSemana, mes } = partesFecha(r.fecha);
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-md bg-bg-secondary px-2.5 py-1.5 text-xs">
                  {r.tipo === "fotografia" ? (
                    <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Video className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="w-28 shrink-0 capitalize text-muted-foreground">
                    {diaSemana} {dia} {mes}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {r.cantidad} {TIPO_LABELS[r.tipo as TipoRegistroGrabacion].toLowerCase()}
                    {r.cantidad > 1 ? "es" : ""}
                  </span>
                  {r.nota && <span className="truncate text-muted-foreground">— {r.nota}</span>}
                  <button
                    type="button"
                    onClick={() => eliminar.mutate(r.id)}
                    className="ml-auto shrink-0 p-1 text-muted-foreground hover:text-destructive"
                    title="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
