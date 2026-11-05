import { useRef, useState } from "react";
import { Camera, Loader2, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Foto de portada de fabrica (public/portada-inicio.jpg) — se ve hasta que superadmin suba una
 * propia a Drive (`fotoId`). */
const FOTO_PORTADA_DEFECTO = "/portada-inicio.jpg";

/**
 * Banner fijo de Inicio — foto a pantalla completa de la seccion (`object-cover`, se adapta a
 * cualquier proporcion sin deformarse) con el nombre + frase del dia (`fraseDelDia()` en
 * lib/frases.ts) encima, en blanco, sobre un degradado oscuro para que se lea con cualquier foto.
 * La foto es un fileId de Drive guardado en la tabla `configuracion` (clave `foto_frase_dia`) —
 * solo superadmin puede cambiarla (`puedeEditarFoto`), el resto solo la ve.
 */
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
  const [fotoPortadaCayo, setFotoPortadaCayo] = useState(false);
  const foto = fotoId ? `/api/drive-thumbnail?id=${encodeURIComponent(fotoId)}&size=1200` : FOTO_PORTADA_DEFECTO;

  return (
    <Card className="relative min-h-[14rem] overflow-hidden border-none bg-[#111827] shadow-[0_12px_20px_-10px_rgba(0,0,0,0.45)] sm:min-h-[17rem]">
      {!(!fotoId && fotoPortadaCayo) && (
        <img
          key={foto}
          src={foto}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => !fotoId && setFotoPortadaCayo(true)}
        />
      )}
      {/* Degradado oscuro encima de la foto — asegura que el texto blanco se lea sin importar
          que tan clara u ocupada venga la foto que suba superadmin. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

      <div className="relative flex min-h-[14rem] flex-col justify-end gap-3 p-5 sm:min-h-[17rem] sm:p-7">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <Quote className="h-3.5 w-3.5 text-accent-dato" /> Frase del día
        </span>
        <div>
          <p className="text-lg font-bold leading-snug text-white sm:text-2xl">Hola, {nombre}</p>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-snug text-white/85 sm:text-base">{frase}</p>
        </div>
        {errorFoto && <p className="text-xs font-medium text-red-300">{errorFoto}</p>}
      </div>

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
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:opacity-60"
          >
            {subiendoFoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {subiendoFoto ? "Subiendo..." : "Cambiar foto"}
          </button>
        </>
      )}
    </Card>
  );
}
