import { forwardRef } from "react";
import { Captions, CheckCircle2, Clapperboard, Film, Mic, Music, ScrollText } from "lucide-react";

/**
 * Presentacion "Guia del proceso de produccion — Capsulas Grupo Ortiz": UNA diapositiva por paso
 * (formato horizontal, mas alta que el slide 16:9 de Reportes para que el contenido respire —
 * esto es un documento para leer con calma, no un slide de proyector) en vez de un documento
 * vertical largo. `export const PASOS_GUIA` trae los datos; `SlidePortada`/`SlideCapsula` son los
 * dos tipos de diapositiva. Sin fecha de generacion en ningun lado — es una guia de referencia
 * fija, no un reporte de un periodo puntual.
 */
export const SLIDE_GUIA_W = 1280;
export const SLIDE_GUIA_H = 900;

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
 * (logo GO, linea de acento de marca). El espacio entre el texto chico de arriba y el titulo
 * grande usa `gap` de flexbox (no margin) — un gap de flex es un espacio REAL garantizado por el
 * layout, a diferencia de un margin que puede verse distinto segun el line-height que calcule
 * cada motor de render; asi no se vuelve a pegar el titulo con la linea de arriba. */
function Encabezado({ kicker, titulo }: { kicker: string; titulo: string }) {
  return (
    <div className="relative flex items-center justify-between pb-4" style={{ borderBottom: `1px solid ${C.borde}` }}>
      <div className="flex items-center gap-4">
        <img src="/logo-go.png" alt="GO" className="h-14 w-14 shrink-0 object-contain" />
        <div className="h-11 w-px shrink-0" style={{ backgroundColor: C.borde }} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: C.suave }}>
            {kicker}
          </p>
          <h2 className="truncate text-[28px] font-bold leading-snug tracking-tight">{titulo}</h2>
        </div>
      </div>
      <p className="shrink-0 text-right text-[10px] uppercase tracking-widest" style={{ color: C.suave }}>
        Documento interno
      </p>
      <div className="absolute -bottom-px left-0 h-[3px] w-28 rounded-full" style={{ backgroundColor: C.marca }} />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: C.fondoSuave }}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.suave }}>
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
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.marcaTexto }}>
        {etiqueta}
      </p>
      <p className="break-all text-[13px] font-medium leading-snug" style={{ color: C.marcaTexto }}>
        {url}
      </p>
    </div>
  );
}

function ListaReglas({ titulo, items }: { titulo?: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      {titulo && (
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.suave }}>
          {titulo}
        </p>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-snug">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: C.marca }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SlidePortada = forwardRef<HTMLDivElement, object>((_props, ref) => (
  <div
    ref={ref}
    className="relative flex flex-col items-center justify-center gap-7 p-10 text-center"
    style={{ width: SLIDE_GUIA_W, height: SLIDE_GUIA_H, backgroundColor: C.fondo, color: C.texto, fontFamily: "Inter, sans-serif" }}
  >
    <img src="/logo-go.png" alt="GO" className="h-24 w-24 object-contain" />
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-semibold uppercase tracking-[0.3em]" style={{ color: C.marca }}>
        Grupo Ortiz · Departamento Audiovisual
      </p>
      <h1 className="text-[50px] font-bold leading-tight tracking-tight">Guía del proceso de producción</h1>
      <p className="text-[23px] font-medium" style={{ color: C.suave }}>
        Cápsulas — de la idea al video terminado
      </p>
    </div>
    <p className="max-w-xl text-[14px] leading-relaxed" style={{ color: C.suave }}>
      Referencia para quien se incorpora al equipo: guion y tono, aprobación, voz, música, montaje,
      subtítulos, y cierre/entrega — un paso por diapositiva.
    </p>
    <p className="absolute bottom-10 text-[11px] uppercase tracking-widest" style={{ color: C.suave }}>
      Documento interno
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
        <p className="text-[14px] leading-relaxed">
          Este es el PRIMER paso de toda cápsula: alguien del equipo (el responsable asignado) escribe el guion
          — el texto que después se convierte en la voz en off del video. Antes de escribir cualquier guion es
          importante conocer la <b>estructura de los videos</b>. El tono de diálogo que usamos para Grupo Ortiz
          está definido en un documento maestro — se puede abrir directo desde este link:
        </p>
        <LinkDestacado etiqueta="Prompt maestro de guiones (tono Grupo Ortiz)" url={urlMd} />
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Estructura del guion" valor="Apertura → Desarrollo → Demostración → Conexión → Cierre" />
          <Dato label="Duración" valor="30–40s producto · 60–90s institucional" />
          <Dato label="Voz en off" valor="Documental industrial premium, corporativa y cinematográfica" />
          <Dato label="Entregable de esta etapa" valor="Diálogo completo, listo para ElevenLabs" />
        </div>
        <ListaReglas
          titulo="Reglas clave"
          items={[
            "Evitar guiones genéricos, aperturas repetidas o venta agresiva.",
            "No inventar capacidades, certificaciones ni resultados de pruebas.",
            "No repetir constantemente \"innovación\", \"calidad\" o \"tecnología\".",
            "Entregar primero el diálogo completo — sin escenas ni instrucciones de cámara, salvo que se pidan.",
          ]}
        />
      </>
    ),
  },
  {
    numero: 2,
    icono: CheckCircle2,
    titulo: "Aprobación",
    contenido: () => (
      <>
        <p className="text-[14px] leading-relaxed">
          <b>Community</b> es el equipo que revisa y aprueba el contenido antes de producirlo — conoce el
          contexto de a quién le habla cada cápsula, por eso ningún guion avanza sin pasar por aquí.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Dato label="1. Envío" valor="El responsable manda el guion terminado a Community" />
          <Dato label="2. Revisión" valor="Community lo lee y deja comentarios directamente sobre el texto" />
          <Dato label="3. Ajuste" valor="El responsable corrige el guion según esas observaciones" />
        </div>
        <p className="text-[14px] leading-relaxed">
          Este envío-revisión-ajuste se repite las veces que haga falta hasta que Community quede conforme. Una
          vez <b>aprobado</b>, el guion pasa a la etapa de generación de voz — no antes.
        </p>
        <ListaReglas
          titulo="Por qué importa"
          items={[
            "Ninguna cápsula debe generarse en ElevenLabs sin esta aprobación previa.",
            "Evita rehacer voz y música por un cambio de texto que se pudo resolver antes.",
          ]}
        />
      </>
    ),
  },
  {
    numero: 3,
    icono: Mic,
    titulo: "Voz (ElevenLabs)",
    contenido: ({ urlMd }) => (
      <>
        <p className="text-[14px] leading-relaxed">
          El guion ya aprobado se convierte a audio en <b>ElevenLabs</b>, la plataforma de texto a voz que
          usamos para generar la narración — siempre con la misma voz oficial, sin variaciones.
        </p>
        <Dato label="Voz oficial" valor="El Faraón" />
        <LinkDestacado etiqueta="ElevenLabs (texto a voz)" url="https://elevenlabs.io" />
        <ListaReglas
          titulo="Checklist antes de generar"
          items={[
            "El guion ya pasó por aprobación de Community (ver Paso 2).",
            "Se usa siempre la voz \"El Faraón\", sin variaciones.",
            `Tono de referencia para la narración: ${urlMd}`,
          ]}
        />
      </>
    ),
  },
  {
    numero: 4,
    icono: Music,
    titulo: "Música",
    contenido: () => (
      <>
        <p className="text-[14px] leading-relaxed">
          Con la voz ya grabada, se le pone música de fondo. Usamos <b>3 tipos de música</b>, todas clásicas,
          seleccionadas por el dueño — no se cambian sin su autorización.
        </p>
        <Dato label="Música" valor="3 pistas clásicas, seleccionadas por el dueño" />
        <LinkDestacado etiqueta="Carpeta de música (Drive)" url="https://drive.google.com/drive/folders/1uu6aOnx4cWc6d6SN7woTF-ytHwPkt3J5" />
        <ListaReglas
          titulo="Reglas clave"
          items={[
            "Siempre una de estas 3 pistas — nunca música nueva sin autorización.",
            "La elección entre las 3 depende del tono del video (consultar con el lider/dueño si hay duda).",
          ]}
        />
      </>
    ),
  },
  {
    numero: 5,
    icono: Film,
    titulo: "Montaje",
    contenido: () => (
      <>
        <p className="text-[14px] leading-relaxed">
          Con voz y música listas, se arma el video final en el editor: se acomodan las tomas, se sincroniza la
          narración con la imagen, y se deja el corte listo para ponerle los subtítulos (siguiente paso).
        </p>
        <ListaReglas
          titulo="Qué debe quedar listo aquí"
          items={[
            "Corte final sincronizado con la voz en off y la música.",
            "Imagen revisada: sin tomas repetidas, movidas o de baja calidad.",
            "Duración dentro de lo acordado en el guion (ver Paso 1).",
          ]}
        />
      </>
    ),
  },
  {
    numero: 6,
    icono: Captions,
    titulo: "Subtítulos",
    contenido: () => (
      <>
        <p className="text-[14px] leading-relaxed">
          Sobre el video ya montado se agregan los subtítulos — español arriba, inglés debajo — con un formato
          FIJO, igual en todas las cápsulas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Fuente" valor="Morganite Medium, tamaño 82" />
          <Dato label="Posición" valor="X 550.000 · Y 525.000 · Interlineado 0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Subtítulo principal (español)" valor="SIEMPRE EN MAYÚSCULAS — dorado o blanco según la marca/identidad" />
          <Dato label="Subtítulo en inglés (debajo)" valor="siempre en minúsculas — dorado o naranja según la marca/identidad" />
        </div>
        <ListaReglas
          titulo="Reglas clave"
          items={[
            "El español va siempre arriba (principal); el inglés va debajo, en menor jerarquía visual.",
            "El color (dorado, blanco o naranja) depende de la marca/identidad del video, nunca al azar.",
            "Mayúsculas en español y minúsculas en inglés son fijas, sin excepción.",
          ]}
        />
      </>
    ),
  },
  {
    numero: 7,
    icono: Clapperboard,
    titulo: "Cierre y entrega",
    contenido: () => (
      <>
        <p className="text-[14px] leading-relaxed">
          Cada video cierra con el <b>logo institucional (cortinilla)</b>, siempre al final — mismo logo para
          todos los videos, se descarga directo de esta carpeta:
        </p>
        <LinkDestacado etiqueta="Carpeta del logo de cierre (Drive)" url="https://drive.google.com/drive/folders/1Ch4GikaERtHlDquAc_n3C2A70eYkOlhs" />
        <p className="text-[14px] leading-relaxed">
          Con la cortinilla ya puesta, el video se entrega a <b>Community</b>, quien lo usa/publica. Con esto se
          cierra el ciclo completo de la cápsula.
        </p>
        <div className="grid grid-cols-4 gap-3">
          <Dato label="Voz" valor="Integrada (ElevenLabs)" />
          <Dato label="Música" valor="Integrada (3 clásicas)" />
          <Dato label="Subtítulos" valor="ES mayúsculas + EN minúsculas" />
          <Dato label="Cortinilla" valor="Al final del video" />
        </div>
      </>
    ),
  },
];

export const SlideCapsula = forwardRef<HTMLDivElement, { paso: PasoGuia; urlMd: string }>(({ paso, urlMd }, ref) => {
  const Icono = paso.icono;
  return (
    <div
      ref={ref}
      className="flex flex-col gap-8 p-10"
      style={{ width: SLIDE_GUIA_W, height: SLIDE_GUIA_H, backgroundColor: C.fondo, color: C.texto, fontFamily: "Inter, sans-serif" }}
    >
      <Encabezado kicker="Guía del proceso de producción · Cápsulas" titulo={`Paso ${paso.numero} — ${paso.titulo}`} />
      <div className="flex flex-1 items-start gap-6 overflow-hidden">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: C.marcaSuave }}
        >
          <Icono className="h-7 w-7" style={{ color: C.marca }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{paso.contenido({ urlMd })}</div>
      </div>
      <p className="text-right text-[11px]" style={{ color: C.suave }}>
        Paso {paso.numero} de {PASOS_GUIA.length}
      </p>
    </div>
  );
});
SlideCapsula.displayName = "SlideCapsula";
