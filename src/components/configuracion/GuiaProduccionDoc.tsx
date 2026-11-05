import { forwardRef } from "react";
import { Captions, CheckCircle2, Clapperboard, Mic, ScrollText } from "lucide-react";

/**
 * Documento "Guia del proceso de produccion — Capsulas Grupo Ortiz" — fondo blanco ejecutivo,
 * UN solo PDF que explica cada etapa (de ahi "capsulas"): guion, aprobacion, voz/musica,
 * montaje/subtitulos y cierre/entrega. Pensado para onboarding de gente nueva al equipo.
 *
 * Tamaño FIJO (no responsive) — igual que SlideRendimiento, se captura a PNG para el PDF y en
 * pantalla se muestra escalado (ver VistaPreviaDoc). Alto mayor que ancho (vertical, tipo
 * documento) a diferencia del slide 16:9 de Reportes.
 */
export const DOC_W = 1000;
export const DOC_H = 1540;

const C = {
  fondo: "#FFFFFF",
  texto: "#111827",
  suave: "#6B7280",
  borde: "#E5E7EB",
  fondoSuave: "#F6F8FB",
  marca: "#FB670B",
  marcaSuave: "#FFF1E7",
  marcaTexto: "#C2410C",
};

function Capsula({
  numero,
  icono: Icono,
  titulo,
  children,
}: {
  numero: number;
  icono: typeof ScrollText;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ border: `1px solid ${C.borde}` }}>
      <div className="mb-2 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: C.marcaSuave, color: C.marcaTexto }}
        >
          {numero}
        </span>
        <Icono className="h-5 w-5 shrink-0" style={{ color: C.marca }} />
        <h3 className="text-[15px] font-bold leading-tight">{titulo}</h3>
      </div>
      <div className="space-y-1.5 pl-[42px] text-[12.5px] leading-snug" style={{ color: C.texto }}>
        {children}
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p>
      <span className="font-semibold">{label}:</span> {valor}
    </p>
  );
}

function Link({ children }: { children: string }) {
  return (
    <p className="break-all rounded-md px-2 py-1 text-[11px]" style={{ backgroundColor: C.fondoSuave, color: C.marcaTexto }}>
      {children}
    </p>
  );
}

export const GuiaProduccionDoc = forwardRef<HTMLDivElement, { generado: string }>(({ generado }, ref) => {
  return (
    <div
      ref={ref}
      className="flex flex-col gap-4 p-9"
      style={{ width: DOC_W, height: DOC_H, backgroundColor: C.fondo, color: C.texto, fontFamily: "Inter, sans-serif" }}
    >
      {/* Encabezado — mismo lenguaje que los reportes (logo GO + linea de acento de marca). */}
      <div className="relative flex items-center justify-between pb-3" style={{ borderBottom: `1px solid ${C.borde}` }}>
        <div className="flex items-center gap-4">
          <img src="/logo-go.png" alt="GO" className="h-12 w-12 object-contain" />
          <div className="h-10 w-px" style={{ backgroundColor: C.borde }} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.suave }}>
              Grupo Ortiz · Departamento Audiovisual
            </p>
            <h2 className="text-[24px] font-bold leading-tight tracking-tight">Guía del proceso de producción — Cápsulas</h2>
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px]" style={{ color: C.suave }}>
          <p>Generado {generado}</p>
          <p className="text-[9px] uppercase tracking-widest">Documento interno</p>
        </div>
        <div className="absolute -bottom-px left-0 h-[3px] w-24 rounded-full" style={{ backgroundColor: C.marca }} />
      </div>

      <p className="text-[12px]" style={{ color: C.suave }}>
        Guía de referencia para quien se incorpora al equipo audiovisual — explica, paso a paso, cómo se produce una
        cápsula de video en Grupo Ortiz, desde el guion hasta la entrega final.
      </p>

      <Capsula numero={1} icono={ScrollText} titulo="Guion y tono">
        <p>
          Antes de escribir el guion es importante conocer la estructura de los videos. El tono del diálogo (el
          estilo que usamos para Grupo Ortiz) está definido en el prompt maestro del proyecto:
        </p>
        <Link>Prompt_Maestro_Guiones_Grupo_Ortiz.md (carpeta public/ del proyecto)</Link>
        <p>
          Resumen: voz en off tipo documental industrial premium, corporativa y cinematográfica. Estructura del guion:
          apertura → desarrollo → demostración → conexión → cierre. El entregable es el diálogo completo, listo para
          grabarse en ElevenLabs.
        </p>
      </Capsula>

      <Capsula numero={2} icono={CheckCircle2} titulo="Aprobación">
        <p>
          El guion se manda a aprobación de <b>Community</b>, quien lo revisa y deja comentarios. Una vez aprobado,
          se pasa a la etapa de generación.
        </p>
      </Capsula>

      <Capsula numero={3} icono={Mic} titulo="Voz y música">
        <Dato label="Texto a voz" valor="ElevenLabs" />
        <Dato label="Voz" valor="El Faraón" />
        <Dato label="Música" valor="3 tipos, todas clásicas, seleccionadas por el dueño" />
        <p className="pt-0.5">Carpeta de música (Drive):</p>
        <Link>https://drive.google.com/drive/folders/1uu6aOnx4cWc6d6SN7woTF-ytHwPkt3J5</Link>
      </Capsula>

      <Capsula numero={4} icono={Captions} titulo="Montaje y subtítulos">
        <Dato label="Fuente" valor="Morganite Medium, tamaño 82" />
        <Dato label="Posición" valor="X 550.000 · Y 525.000 · Interlineado 0" />
        <Dato label="Subtítulo principal (español)" valor="SIEMPRE EN MAYÚSCULAS — color dorado o blanco según la marca/identidad" />
        <Dato label="Subtítulo en inglés (debajo)" valor="siempre en minúsculas — color dorado o naranja según la marca/identidad" />
      </Capsula>

      <Capsula numero={5} icono={Clapperboard} titulo="Cierre y entrega">
        <p>Logo de cierre (cortinilla) al final de cada video. Carpeta del logo (Drive):</p>
        <Link>https://drive.google.com/drive/folders/1Ch4GikaERtHlDquAc_n3C2A70eYkOlhs</Link>
        <p className="pt-0.5">Al terminar el montaje, se manda a Community para su uso/publicación.</p>
      </Capsula>
    </div>
  );
});
GuiaProduccionDoc.displayName = "GuiaProduccionDoc";
