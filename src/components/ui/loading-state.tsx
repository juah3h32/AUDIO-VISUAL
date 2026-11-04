import { Loader2 } from "lucide-react";

/** Spinner de carga unico para toda la app — reemplaza los "Cargando X…" de texto plano que
 * cada pagina escribia por su cuenta (y las que no mostraban nada mientras cargaban). */
export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
