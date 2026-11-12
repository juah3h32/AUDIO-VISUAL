import { useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Marca, Proyecto } from "@/types";

/** `@font-face` necesita bytes crudos, no la pagina de vista de Drive — `/api/drive-video` ya
 * sirve eso mismo origen, autenticado por cookie de sesion (confirmado: lo usa el reproductor
 * de video y el boton de descarga de logos con el mismo endpoint). */
function formatoFuente(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase();
  if (ext === "otf") return "opentype";
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  return "truetype";
}

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

/**
 * "Pagina" completa de una marca: portada con su paleta/logo, y cada seccion del manual de
 * identidad bien separada (tipografia, colores, logos, manual, proyectos). Se usa tanto inline
 * en el panel de detalle de escritorio (MarcasPage.tsx) como dentro del dialogo en movil — mismo
 * contenido, solo cambia el contenedor que lo envuelve.
 */
export function MarcaDetalle({
  marca,
  proyectosAsociados,
  entregablesCount,
  puedeGestionar,
  onEditar,
  onEliminar,
  eliminarPending,
}: {
  marca: Marca;
  proyectosAsociados: Proyecto[];
  entregablesCount: number;
  puedeGestionar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  eliminarPending: boolean;
}) {
  const paleta = marca.colores.length > 0 ? marca.colores : ["#E5E7EB"];
  const logo = marca.assets.find((a) => a.tipo === "logo");
  const manualPdf = marca.assets.find((a) => a.tipo === "pdf");
  // Varias tipografias por marca (ej. una para titulos, otra para cuerpo de texto) — igual que
  // logos, se acumulan en vez de reemplazarse. Cada archivo necesita su propio nombre de familia
  // unico (no se puede reusar el mismo `font-family` para dos `src` distintos).
  const tipografiaAssets = marca.assets.filter((a) => a.tipo === "tipografia");
  const familiaDe = (i: number) => `marca-fuente-${marca.id}-${i}`;
  // Con archivo real: se ve exactamente como es, no una adivinanza de fuente de sistema por nombre.
  const familiaPrincipal = tipografiaAssets.length > 0 ? familiaDe(0) : marca.tipografia;

  return (
    <div>
      {/* `font-display: swap` — sin esto el navegador deja el texto INVISIBLE mientras baja el
          archivo de fuente (font-display default es "block", hasta ~3s) antes de mostrar algo,
          se sentia como que "tarda en verse la tipografia". Con swap se ve de inmediato con una
          fuente de reemplazo y cambia en cuanto el archivo real termina de cargar. */}
      {tipografiaAssets.map((a, i) => (
        <style key={a.id}>{`@font-face { font-family: '${familiaDe(i)}'; src: url(/api/drive-video?id=${encodeURIComponent(a.fileId ?? "")}) format('${formatoFuente(a.nombre)}'); font-display: swap; }`}</style>
      ))}
      <div
        className="relative flex h-32 items-end overflow-hidden rounded-t-lg p-4 sm:h-40"
        style={{
          background: paleta.length > 1 ? `linear-gradient(135deg, ${paleta.slice(0, 3).join(", ")})` : paleta[0],
        }}
      >
        <div className="absolute left-4 top-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md sm:h-28 sm:w-28">
          {logo ? (
            <img
              src={`/api/drive-thumbnail?id=${encodeURIComponent(logo.fileId ?? "")}&size=300`}
              alt={marca.nombre}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span className="text-xl font-semibold text-text-primary sm:text-2xl">
              {marca.nombre.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 border border-t-0 border-border rounded-b-lg p-4 text-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-3xl font-extrabold text-text-primary sm:text-4xl" style={familiaPrincipal ? { fontFamily: familiaPrincipal } : undefined}>
              {marca.nombre}
            </h2>
            {marca.descripcion && <p className="text-sm text-muted-foreground">{marca.descripcion}</p>}
          </div>
          {puedeGestionar && (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onEditar}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-red-50 dark:hover:bg-red-400/10"
                onClick={onEliminar}
                disabled={eliminarPending}
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            </div>
          )}
        </div>

        <section className="rounded-lg border border-border bg-bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tipografiaAssets.length > 1 ? "Tipografías" : "Tipografía"}
          </p>
          {tipografiaAssets.length > 0 ? (
            <div className="space-y-2">
              {tipografiaAssets.map((a, i) => (
                <div key={a.id} className="rounded-md border border-border bg-bg-primary p-3">
                  <p className="text-2xl" style={{ fontFamily: familiaDe(i) }}>
                    Aa Bb Cc
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{a.nombre}</p>
                    <a
                      href={`/api/drive-video?id=${encodeURIComponent(a.fileId ?? "")}&download=1&nombre=${encodeURIComponent(a.nombre)}`}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium hover:bg-bg-secondary"
                      title={`Descargar ${a.nombre}`}
                    >
                      <Download className="h-3 w-3" /> Descargar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : marca.tipografia ? (
            <div className="rounded-md border border-border bg-bg-primary p-3">
              <p className="text-2xl" style={{ fontFamily: marca.tipografia }}>
                Aa Bb Cc
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{marca.tipografia}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin tipografía registrada.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paleta de colores</p>
          <div className="flex flex-wrap gap-2">
            {marca.colores.map((c) => (
              <Swatch key={c} color={c} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logos</p>
          {marca.assets.filter((a) => a.tipo === "logo").length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin logos cargados.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {marca.assets
                .filter((a) => a.tipo === "logo")
                .map((a) => (
                  <div key={a.id} className="flex flex-col items-center gap-1 rounded-md border border-border bg-bg-primary p-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="rounded hover:opacity-80">
                      <img
                        src={`/api/drive-thumbnail?id=${encodeURIComponent(a.fileId ?? "")}&size=150`}
                        alt={a.nombre}
                        className="h-14 w-14 rounded border border-border object-contain"
                      />
                    </a>
                    <span className="max-w-[6rem] truncate text-[10px] text-muted-foreground">{a.nombre}</span>
                    <a
                      href={`/api/drive-video?id=${encodeURIComponent(a.fileId ?? "")}&download=1&nombre=${encodeURIComponent(a.nombre)}`}
                      className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium hover:bg-bg-secondary"
                      title={`Descargar ${a.nombre}`}
                    >
                      <Download className="h-3 w-3" /> Descargar
                    </a>
                  </div>
                ))}
            </div>
          )}
        </section>

        {marca.manualUrl && (
          <section className="rounded-lg border border-border bg-bg-secondary/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual de identidad</p>
            <a
              href={marca.manualUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md border border-border bg-bg-primary p-2.5 text-sm hover:bg-bg-secondary"
            >
              {manualPdf && (
                <img
                  src={`/api/drive-thumbnail?id=${encodeURIComponent(manualPdf.fileId ?? "")}&size=150`}
                  alt="Vista previa del manual"
                  className="h-14 w-11 shrink-0 rounded border border-border object-cover"
                />
              )}
              <FileText className="h-4 w-4 shrink-0" /> Ver manual de identidad completo (PDF)
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
            </a>
          </section>
        )}

        <section className="rounded-lg border border-border bg-bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proyectos asociados ({proyectosAsociados.length})
          </p>
          {proyectosAsociados.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ningun proyecto usa esta marca todavia.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proyectosAsociados.map((p) => (
                <span key={p.id} className="rounded-full bg-bg-primary px-2.5 py-1 text-xs">
                  {p.nombre}
                </span>
              ))}
            </div>
          )}
          {entregablesCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {entregablesCount} entregable(s) ligado(s) directamente a esta marca.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
