import { useState } from "react";
import { Check, Copy, ExternalLink, FileText, Trash2 } from "lucide-react";
import { useMarcas, useEliminarMarca } from "@/hooks/useMarcas";
import { useProyectos } from "@/hooks/useProyectos";
import { useEntregables } from "@/hooks/useCatalogos";
import { useAuth } from "@/context/AuthContext";
import { puedeCrearProyectos } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoBadge } from "@/components/DemoBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { NuevaMarcaDialog } from "@/components/marcas/NuevaMarcaDialog";
import type { Marca } from "@/types";

function Swatch({ color }: { color: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(color);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      title={`Copiar ${color}`}
      className="group flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
    >
      <span className="h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: color }} />
      <span className="font-mono">{color}</span>
      {copiado ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60" />}
    </button>
  );
}

export function MarcasPage() {
  const { usuario } = useAuth();
  const { data: marcas = [], isLoading } = useMarcas();
  const { data: proyectos = [] } = useProyectos();
  const { data: entregables = [] } = useEntregables();
  const [seleccionada, setSeleccionada] = useState<Marca | null>(null);
  const [aEliminar, setAEliminar] = useState<Marca | null>(null);
  const eliminar = useEliminarMarca();
  const puedeGestionar = puedeCrearProyectos(usuario);

  const logoDe = (marca: Marca) => marca.assets.find((a) => a.tipo === "logo");
  const manualPdfDe = (marca: Marca) => marca.assets.find((a) => a.tipo === "pdf");
  const proyectosDe = (marcaId: string) => proyectos.filter((p) => p.marcaId === marcaId);
  const entregablesDe = (marcaId: string) => entregables.filter((e) => e.marcaId === marcaId);

  const confirmarEliminar = () => {
    if (!aEliminar) return;
    eliminar.mutate(aEliminar.id);
    setAEliminar(null);
    setSeleccionada(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Marcas" description="Manuales de identidad: logos, colores y assets por marca.">
        <DemoBadge />
        {puedeGestionar && <NuevaMarcaDialog />}
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando marcas…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {marcas.map((m) => {
            const logo = logoDe(m);
            const paleta = m.colores.length > 0 ? m.colores : ["#E5E7EB"];
            return (
              <Card
                key={m.id}
                className="cursor-pointer overflow-hidden p-0 hover:shadow-md"
                onClick={() => setSeleccionada(m)}
              >
                <div
                  className="relative flex h-28 items-end p-4"
                  style={{
                    background:
                      paleta.length > 1
                        ? `linear-gradient(135deg, ${paleta.slice(0, 3).join(", ")})`
                        : paleta[0],
                  }}
                >
                  <div className="absolute left-4 top-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
                    {logo ? (
                      <img
                        src={`/api/drive-thumbnail?id=${encodeURIComponent(logo.fileId ?? "")}&size=120`}
                        alt={m.nombre}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-text-primary">
                        {m.nombre.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <CardContent className="space-y-3 pt-3">
                  <div className="min-w-0">
                    <CardTitle
                      className="truncate text-lg"
                      style={m.tipografia ? { fontFamily: m.tipografia } : undefined}
                    >
                      {m.nombre}
                    </CardTitle>
                    {m.descripcion && <p className="truncate text-xs text-muted-foreground">{m.descripcion}</p>}
                    {m.tipografia && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" style={{ fontFamily: m.tipografia }}>
                        Aa — {m.tipografia}
                      </p>
                    )}
                  </div>
                  <div className="flex overflow-hidden rounded-md border border-border">
                    {m.colores.slice(0, 6).map((c) => (
                      <span key={c} className="h-6 flex-1" style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{proyectosDe(m.id).length} proyecto(s) asociado(s)</span>
                    {m.manualUrl && <Badge variant="accent">Manual PDF</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {marcas.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Aún no hay marcas registradas.
            </p>
          )}
        </div>
      )}

      <Dialog open={!!seleccionada} onOpenChange={(v) => !v && setSeleccionada(null)}>
        <DialogContent className="max-w-xl">
          {seleccionada && (
            <>
              {(() => {
                const paleta = seleccionada.colores.length > 0 ? seleccionada.colores : ["#E5E7EB"];
                const logoSeleccionada = logoDe(seleccionada);
                return (
                  <div
                    className="relative mb-4 flex h-24 items-end overflow-hidden rounded-lg p-4"
                    style={{
                      background:
                        paleta.length > 1
                          ? `linear-gradient(135deg, ${paleta.slice(0, 3).join(", ")})`
                          : paleta[0],
                    }}
                  >
                    <div className="absolute left-4 top-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
                      {logoSeleccionada ? (
                        <img
                          src={`/api/drive-thumbnail?id=${encodeURIComponent(logoSeleccionada.fileId ?? "")}&size=150`}
                          alt={seleccionada.nombre}
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <span className="text-base font-semibold text-text-primary">
                          {seleccionada.nombre.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <DialogTitle
                      className="text-xl"
                      style={seleccionada.tipografia ? { fontFamily: seleccionada.tipografia } : undefined}
                    >
                      {seleccionada.nombre}
                    </DialogTitle>
                    {seleccionada.descripcion && (
                      <p className="text-sm text-muted-foreground">{seleccionada.descripcion}</p>
                    )}
                  </div>
                  {puedeGestionar && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start text-destructive hover:bg-red-50 dark:hover:bg-red-400/10"
                      onClick={() => setAEliminar(seleccionada)}
                      disabled={eliminar.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-5 text-sm">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipografía</p>
                  {seleccionada.tipografia ? (
                    <div className="rounded-md border border-border p-3">
                      <p className="text-2xl" style={{ fontFamily: seleccionada.tipografia }}>
                        Aa Bb Cc
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{seleccionada.tipografia}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin tipografía registrada.</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Paleta de colores
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {seleccionada.colores.map((c) => (
                      <Swatch key={c} color={c} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logos</p>
                  {seleccionada.assets.filter((a) => a.tipo === "logo").length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin logos cargados.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {seleccionada.assets
                        .filter((a) => a.tipo === "logo")
                        .map((a) => (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:bg-bg-secondary"
                          >
                            <img
                              src={`/api/drive-thumbnail?id=${encodeURIComponent(a.fileId ?? "")}&size=150`}
                              alt={a.nombre}
                              className="h-14 w-14 rounded border border-border object-contain"
                            />
                            <span className="max-w-[6rem] truncate text-[10px] text-muted-foreground">{a.nombre}</span>
                          </a>
                        ))}
                    </div>
                  )}
                </div>

                {seleccionada.manualUrl && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Manual de identidad
                    </p>
                    <a
                      href={seleccionada.manualUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm hover:bg-bg-secondary"
                    >
                      {manualPdfDe(seleccionada) && (
                        <img
                          src={`/api/drive-thumbnail?id=${encodeURIComponent(manualPdfDe(seleccionada)!.fileId ?? "")}&size=150`}
                          alt="Vista previa del manual"
                          className="h-14 w-11 shrink-0 rounded border border-border object-cover"
                        />
                      )}
                      <FileText className="h-4 w-4 shrink-0" /> Ver manual de identidad completo (PDF)
                      <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
                    </a>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proyectos asociados ({proyectosDe(seleccionada.id).length})
                  </p>
                  {proyectosDe(seleccionada.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ningun proyecto usa esta marca todavia.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {proyectosDe(seleccionada.id).map((p) => (
                        <span key={p.id} className="rounded-full bg-bg-secondary px-2.5 py-1 text-xs">
                          {p.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {entregablesDe(seleccionada.id).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {entregablesDe(seleccionada.id).length} entregable(s) ligado(s) directamente a esta marca.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
