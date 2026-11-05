import { forwardRef } from "react";
import { Captions, CheckCircle2, Clapperboard, Mic, ScrollText } from "lucide-react";

/**
 * Presentacion "Guia del proceso de produccion — Capsulas Grupo Ortiz": UNA diapositiva 16:9 por
 * paso (igual formato horizontal que el slide de Reportes) en vez de un documento vertical largo
 * — mas facil de explicar y de leer para quien se incorpora al equipo. `export const PASOS` trae
 * los datos; `SlidePortada`/`SlideCapsula` son los dos tipos de diapositiva.
 */
export const SLIDE_GUIA_W = 1280;
export const SLIDE_GUIA_H = 720;

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

/** Encabezado ejecutivo compartido por toda la presentacion — mismo lenguaje que SlideRendimiento
 * (logo GO, linea de acento de marca) para que se sienta de la misma familia de documentos. */
function Encabezado({ kicker, titulo, generado }: { kicker: string; titulo: string; generado: string }) {
  return (
    <div className="relative flex items-center justify-between pb-4" style={{ borderBottom: `1px solid ${C.borde}` }}>
      <div className="flex items-center gap-4">
        <img src="/logo-go.png" alt="GO" className="h-14 w-14 object-contain" />
        <div className="h-12 w-px" style={{ backgroundColor: C.borde }} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.suave }}>
            {kicker}
          </p>
          <h2 className="text-[30px] font-bold leading-tight tracking-tight">{titulo}</h2>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs" style={{ color: C.suave }}>
        <p>Generado {generado}</p>
        <p className="text-[10px] uppercase tracking-widest">Documento interno</p>
      </div>
      <div className="absolute -bottom-px left-0 h-[3px] w-28 rounded-full" style={{ backgroundColor: C.marca }} />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: C.fondoSuave }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.suave }}>
        {label}
      </p>
      <p className="text-[14px] font-semibold leading-snug">{valor}</p>
    </div>
  );
}

/** Link en texto grande para que, aunque el PDF no tenga hipervinculo real (es una imagen
 * rasterizada), la persona pueda copiarlo o escribirlo sin esfuerzo. */
function LinkDestacado({ etiqueta, url }: { etiqueta: string; url: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: C.marcaSuave, border: `1px solid ${C.marca}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.marcaTexto }}>
        {etiqueta}
      </p>
      <p className="break-all text-[13px] font-medium" style={{ color: C.marcaTexto }}>
        {url}
      </p>
    </div>
  );
}

export const SlidePortada = forwardRef<HTMLDivElement, { generado: string }>(({ generado }, ref) => (
  <div
    ref={ref}
    className="relative flex flex-col items-center justify-center gap-6 p-10 text-center"
    style={{ width: SLIDE_GUIA_W, height: SLIDE_GUIA_H, backgroundColor: C.fondo, color: C.texto, fontFamily: "Inter, sans-serif" }}
  >
    <img src="/logo-go.png" alt="GO" className="h-20 w-20 object-contain" />
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.3em]" style={{ color: C.marca }}>
        Grupo Ortiz · Departamento Audiovisual
      </p>
      <h1 className="mt-3 text-[46px] font-bold leading-tight tracking-tight">Guía del proceso de producción</h1>
      <p className="mt-1 text-[22px] font-medium" style={{ color: C.suave }}>
        Cápsulas — de la idea al video terminado
      </p>
    </div>
    <p className="max-w-xl text-[13px]" style={{ color: C.suave }}>
      Referencia para quien se incorpora al equipo: guion y tono, aprobación, voz y música, montaje y
      subtítulos, y cierre/entrega.
    </p>
    <p className="absolute bottom-8 text-[11px] uppercase tracking-widest" style={{ color: C.suave }}>
      Generado {generado} · Documento interno
    </p>
    <div className="absolute bottom-0 left-0 h-[6px] w-full" style={{ backgroundColor: C.marca }} />
  </div>
));
SlidePortada.displayName = "SlidePortada";

export interface PasoGuia {
  numero: number;
  icono: typeof ScrollText;
  titulo: string;
  contenido: (props: { urlMd: string }) => React.ReactNode;
}

export const PASOS_GUIA: PasoGuia[] = [
  {
    numero: 1,
    icono: ScrollText,
    titulo: "Guion y tono",
    contenido: ({ urlMd }) => (
      <>
        <p className="text-[15px] leading-relaxed">
          Antes de escribir cualquier guion es importante conocer la <b>estructura de los videos</b>. El tono de
          diálogo que usamos para Grupo Ortiz está definido en un documento maestro — se puede abrir directo
          desde este link:
        </p>
        <LinkDestacado etiqueta="Prompt maestro de guiones (tono Grupo Ortiz)" url={urlMd} />
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Estructura del guion" valor="Apertura → Desarrollo → Demostración → Conexión → Cierre" />
          <Dato label="Duración" valor="30–40s producto · 60–90s institucional" />
          <Dato label="Voz en off" valor="Documental industrial premium, corporativa y cinematográfica" />
          <Dato label="Entregable de esta etapa" valor="Diálogo completo, listo para ElevenLabs" />
        </div>
      </>
    ),
  },
  {
    numero: 2,
    icono: CheckCircle2,
    titulo: "Aprobación",
    contenido: () => (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed">
          El guion terminado se manda a <b>Community</b>, quien lo revisa y deja comentarios directamente sobre
          el texto.
        </p>
        <p className="text-[15px] leading-relaxed">
          Si hay observaciones, el responsable ajusta el guion según esos comentarios.
        </p>
        <p className="text-[15px] leading-relaxed">
          Una vez <b>aprobado</b>, el guion pasa a la etapa de generación de voz y música.
        </p>
      </div>
    ),
  },
  {
    numero: 3,
    icono: Mic,
    titulo: "Voz y música",
    contenido: () => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Texto a voz" valor="ElevenLabs" />
          <Dato label="Voz oficial" valor="El Faraón" />
        </div>
        <p className="text-[15px] leading-relaxed">
          Se usan <b>3 tipos de música</b>, todas clásicas, seleccionadas por el dueño — no se cambian sin
          autorización.
        </p>
        <LinkDestacado etiqueta="Carpeta de música (Drive)" url="https://drive.google.com/drive/folders/1uu6aOnx4cWc6d6SN7woTF-ytHwPkt3J5" />
      </>
    ),
  },
  {
    numero: 4,
    icono: Captions,
    titulo: "Montaje y subtítulos",
    contenido: () => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Fuente" valor="Morganite Medium, tamaño 82" />
          <Dato label="Posición" valor="X 550.000 · Y 525.000 · Interlineado 0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Subtítulo principal (español)" valor="SIEMPRE EN MAYÚSCULAS — dorado o blanco según la marca/identidad" />
          <Dato label="Subtítulo en inglés (debajo)" valor="siempre en minúsculas — dorado o naranja según la marca/identidad" />
        </div>
        <p className="text-[12px]" style={{ color: C.suave }}>
          Estos ajustes son fijos — no varían entre proyectos salvo instrucción expresa.
        </p>
      </>
    ),
  },
  {
    numero: 5,
    icono: Clapperboard,
    titulo: "Cierre y entrega",
    contenido: () => (
      <>
        <p className="text-[15px] leading-relaxed">
          Cada video cierra con el <b>logo institucional (cortinilla)</b>, siempre al final.
        </p>
        <LinkDestacado etiqueta="Carpeta del logo de cierre (Drive)" url="https://drive.google.com/drive/folders/1Ch4GikaERtHlDquAc_n3C2A70eYkOlhs" />
        <p className="text-[15px] leading-relaxed">
          Terminado el montaje, el video se entrega a <b>Community</b> para su publicación/uso.
        </p>
      </>
    ),
  },
];

export const SlideCapsula = forwardRef<HTMLDivElement, { paso: PasoGuia; generado: string; urlMd: string }>(
  ({ paso, generado, urlMd }, ref) => {
    const Icono = paso.icono;
    return (
      <div
        ref={ref}
        className="flex flex-col gap-6 p-10"
        style={{ width: SLIDE_GUIA_W, height: SLIDE_GUIA_H, backgroundColor: C.fondo, color: C.texto, fontFamily: "Inter, sans-serif" }}
      >
        <Encabezado kicker="Guía del proceso de producción · Cápsulas" titulo={`Paso ${paso.numero} — ${paso.titulo}`} generado={generado} />
        <div className="flex flex-1 items-start gap-6">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: C.marcaSuave }}
          >
            <Icono className="h-8 w-8" style={{ color: C.marca }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">{paso.contenido({ urlMd })}</div>
        </div>
        <p className="text-right text-[11px]" style={{ color: C.suave }}>
          Paso {paso.numero} de {PASOS_GUIA.length}
        </p>
      </div>
    );
  }
);
SlideCapsula.displayName = "SlideCapsula";
