import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mensaje de error unico cuando una lista no pudo cargar de Firestore — antes esto quedaba
 * silencioso (lista vacia, sin explicacion de que algo fallo). */
export function ErrorState({
  label = "No se pudo cargar la informacion.",
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
