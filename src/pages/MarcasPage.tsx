import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useMarcas, useEliminarMarca } from "@/hooks/useMarcas";
import { useProyectos } from "@/hooks/useProyectos";
import { useEntregables } from "@/hooks/useCatalogos";
import { useAuth } from "@/context/AuthContext";
import { puedeCrearProyectos } from "@/lib/roles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoBadge } from "@/components/DemoBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { NuevaMarcaDialog } from "@/components/marcas/NuevaMarcaDialog";
import { EditarMarcaDialog } from "@/components/marcas/EditarMarcaDialog";
import { MarcaDetalle } from "@/components/marcas/MarcaDetalle";
import { cn } from "@/lib/utils";
import type { Marca } from "@/types";

export function MarcasPage() {
  const { usuario } = useAuth();
  const { data: marcas = [], isLoading } = useMarcas();
  const { data: proyectos = [] } = useProyectos();
  const { data: entregables = [] } = useEntregables();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [aEliminar, setAEliminar] = useState<Marca | null>(null);
  const eliminar = useEliminarMarca();
  const puedeGestionar = puedeCrearProyectos(usuario);

  const logoDe = (marca: Marca) => marca.assets.find((a) => a.tipo === "logo");

  // Se busca por id en vez de guardar el objeto completo: tras editar, `marcas` se refresca con
  // los datos nuevos (invalidateQueries de useActualizarMarca) y el panel ya abierto los refleja
  // solo, sin quedarse con la foto vieja de cuando se abrio.
  const seleccionada = marcas.find((m) => m.id === seleccionadaId) ?? null;

  const confirmarEliminar = () => {
    if (!aEliminar) return;
    eliminar.mutate(aEliminar.id);
    setAEliminar(null);
    setSeleccionadaId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Marcas" description="Manuales de identidad: logos, colores y assets por marca.">
        <DemoBadge />
        {puedeGestionar && <NuevaMarcaDialog />}
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando marcas…</p>
      ) : marcas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay marcas registradas.</p>
      ) : (
        // Lista a la izquierda, detalle completo a la derecha — en movil no caben las dos
        // columnas: se muestra una u otra (la lista, o el detalle con un boton de "Volver").
        <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
          <div className={cn("space-y-2", seleccionada && "hidden lg:block")}>
            {marcas.map((m) => {
              const logo = logoDe(m);
              const activa = m.id === seleccionadaId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSeleccionadaId(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    activa
                      ? "border-accent bg-bg-secondary"
                      : "border-border hover:bg-bg-secondary"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                    {logo ? (
                      <img
                        src={`/api/drive-thumbnail?id=${encodeURIComponent(logo.fileId ?? "")}&size=100`}
                        alt={m.nombre}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-text-primary">{m.nombre.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{m.nombre}</p>
                    <div className="mt-1 flex gap-1">
                      {m.colores.slice(0, 5).map((c) => (
                        <span key={c} className="h-2.5 w-2.5 rounded-full border border-border" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={cn(!seleccionada && "hidden lg:flex lg:min-h-[320px] lg:items-center lg:justify-center lg:rounded-lg lg:border lg:border-dashed lg:border-border")}>
            {seleccionada ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSeleccionadaId(null)}
                  className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-text-primary lg:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Todas las marcas
                </button>
                <MarcaDetalle
                  marca={seleccionada}
                  proyectosAsociados={proyectos.filter((p) => p.marcaId === seleccionada.id)}
                  entregablesCount={entregables.filter((e) => e.marcaId === seleccionada.id).length}
                  puedeGestionar={puedeGestionar}
                  onEditar={() => setEditando(true)}
                  onEliminar={() => setAEliminar(seleccionada)}
                  eliminarPending={eliminar.isPending}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Elige una marca de la lista para ver su detalle.</p>
            )}
          </div>
        </div>
      )}

      {seleccionada && (
        <EditarMarcaDialog key={seleccionada.id} marca={seleccionada} open={editando} onOpenChange={setEditando} />
      )}

      <ConfirmDialog
        open={Boolean(aEliminar)}
        onOpenChange={(v) => !v && setAEliminar(null)}
        title={`¿Eliminar la marca "${aEliminar?.nombre}"?`}
        description="Los proyectos y entregables que la tenian asociada se quedan sin marca asignada. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}
