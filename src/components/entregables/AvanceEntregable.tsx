import { avanceDe } from "@/lib/rendimiento";
import { Progress } from "@/components/ui/progress";
import type { Entregable } from "@/types";

function colorAvance(p: number) {
  return p >= 80 ? "bg-green-500" : p >= 40 ? "bg-amber-500" : "bg-red-500";
}

/** Barra de avance de un entregable — automatica segun su estado, nadie la captura a mano. */
export function AvanceEntregable({ entregable }: { entregable: Entregable }) {
  const valor = avanceDe(entregable);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Progress value={valor} indicadorClassName={colorAvance(valor)} className="h-2 min-w-24" />
      <span className="w-10 shrink-0 text-right text-xs font-bold">{valor}%</span>
    </div>
  );
}
