const RE_ESCENA = /^(ESCENA|ESC\.?|CORTE A|TOMA)\b/i;
const RE_TIEMPO = /^\[.+\]/;
const RE_ACOTACION = /^\(.*\)$/;
/** Nombre en mayusculas (con acentos/parentesis, ej. "LOCUTOR (OFF)") seguido de ":" — la
 * convencion de quien escribe guion comercial para marcar quien habla. */
const RE_PERSONAJE = /^([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ()./_-]{1,28}):\s*(.*)$/;

/** Da estructura visual a un guion/dialogo pegado como texto plano — para que quien edita el
 * video distinga de un vistazo escena, quien habla y la acotacion, en vez de un bloque de texto
 * corrido. No reescribe el contenido, solo reconoce las convenciones mas comunes al escribirlo. */
export function DialogoFormateado({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lineas.map((linea, i) => {
        const limpia = linea.trim();
        if (!limpia) return <div key={i} className="h-2" />;

        if (RE_ESCENA.test(limpia)) {
          return (
            <p key={i} className="mt-3 text-xs font-bold uppercase tracking-wide text-orange-600 first:mt-0">
              {limpia}
            </p>
          );
        }

        const personaje = RE_PERSONAJE.exec(limpia);
        if (personaje) {
          const [, nombre, resto] = personaje;
          return (
            <p key={i} className="pl-1">
              <span className="font-bold text-orange-600">{nombre}:</span>{resto ? ` ${resto}` : ""}
            </p>
          );
        }

        if (RE_ACOTACION.test(limpia)) {
          return (
            <p key={i} className="pl-4 text-xs italic text-muted-foreground">
              {limpia}
            </p>
          );
        }

        if (RE_TIEMPO.test(limpia)) {
          return (
            <span key={i} className="mb-1 inline-block rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {limpia}
            </span>
          );
        }

        return (
          <p key={i} className="pl-4">
            {limpia}
          </p>
        );
      })}
    </div>
  );
}
