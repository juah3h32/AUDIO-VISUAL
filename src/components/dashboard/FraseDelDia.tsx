import { Clapperboard, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Tarjeta "Frase del día" en Inicio — banner ancho con pastilla oscura + texto grande, mismo
 * lenguaje de marca que el resto de la app (negro + verde lima). La frase en si rota sola segun
 * la fecha (`fraseDelDia()` en lib/frases.ts), esto solo es su presentacion visual. */
export function FraseDelDia({ frase }: { frase: string }) {
  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-accent-dato/15 via-accent-dato/5 to-transparent">
      {/* Clapperboard gigante y tenue a la derecha — mismo icono de marca que Sidebar/Header,
          puramente decorativo (oculto en movil para no competir con el texto en pantallas chicas). */}
      <Clapperboard
        className="pointer-events-none absolute -right-6 -top-6 hidden h-36 w-36 rotate-12 text-accent-dato/10 sm:block"
        strokeWidth={1}
      />
      <CardContent className="relative flex flex-col gap-3 p-5 sm:p-6">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-black">
          <Quote className="h-3.5 w-3.5 text-accent-dato" /> Frase del día
        </span>
        <p className="max-w-3xl text-lg font-bold leading-snug text-text-primary sm:text-xl">{frase}</p>
      </CardContent>
    </Card>
  );
}
