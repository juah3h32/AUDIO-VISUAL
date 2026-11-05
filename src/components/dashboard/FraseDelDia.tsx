import { useRef } from "react";
import { Camera, Clapperboard, Loader2, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Banner fijo de Inicio — nombre + frase del dia (`fraseDelDia()` en lib/frases.ts) + foto a la
 * derecha. La foto es un fileId de Drive guardado en la tabla `configuracion` (clave
 * `foto_frase_dia`) — solo superadmin puede cambiarla (`puedeEditarFoto`), el resto solo la ve. */
export function FraseDelDia({
  frase,
  nombre,
  fotoId,
  puedeEditarFoto,
  onCambiarFoto,
  subiendoFoto,
  errorFoto,
}: {
  frase: string;
  nombre: string;
  fotoId?: string;
  puedeEditarFoto?: boolean;
  onCambiarFoto?: (file: File) => void;
  subiendoFoto?: boolean;
  errorFoto?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-accent-dato/15 via-accent-dato/5 to-transparent">
      <CardContent className="relative flex min-h-[11rem] flex-col gap-4 p-5 sm:min-h-[13rem] sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-black">
            <Quote className="h-3.5 w-3.5 text-accent-dato" /> Frase del día
          </span>
          <div>
            <p className="text-lg font-bold leading-snug text-text-primary sm:text-xl">Hola, {nombre}</p>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-snug text-muted-foreground sm:text-base">
              {frase}
            </p>
          </div>
        </div>

        <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-accent-dato/10 sm:h-full sm:w-56">
          {fotoId ? (
            <img
              src={`/api/drive-thumbnail?id=${encodeURIComponent(fotoId)}&size=600`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Clapperboard className="h-14 w-14 rotate-12 text-accent-dato/30" strokeWidth={1} />
            </div>
          )}

          {puedeEditarFoto && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onCambiarFoto?.(file);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={subiendoFoto}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/85 disabled:opacity-60"
              >
                {subiendoFoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {subiendoFoto ? "Subiendo..." : "Cambiar foto"}
              </button>
            </>
          )}
        </div>
      </CardContent>
      {errorFoto && (
        <p className="relative px-5 pb-4 text-xs font-medium text-destructive sm:px-6">{errorFoto}</p>
      )}
    </Card>
  );
}
