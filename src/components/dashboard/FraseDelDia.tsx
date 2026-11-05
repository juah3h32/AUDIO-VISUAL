import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Tarjeta de "Frase del día" en Inicio — la frase en si rota sola segun la fecha
 * (`fraseDelDia()` en lib/frases.ts), esto solo es su presentacion visual. */
export function FraseDelDia({ frase }: { frase: string }) {
  return (
    <Card className="border-accent-dato/30 bg-accent-dato/5">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-dato/15">
          <Quote className="h-4 w-4 text-accent-dato" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Frase del día</p>
          <p className="mt-1 text-sm italic leading-relaxed text-text-primary">{frase}</p>
        </div>
      </CardContent>
    </Card>
  );
}
