import { SLIDE_H, SLIDE_W } from "@/components/reportes/SlideRendimiento";

async function rasterizar(nodo: HTMLElement, fondo: string, ancho: number, alto: number, calidad: number) {
  const { toPng } = await import("html-to-image");
  return toPng(nodo, {
    pixelRatio: calidad,
    backgroundColor: fondo,
    width: ancho,
    height: alto,
    // `transform: none` anula el escalado de una vista previa (si el nodo se mostraba encogido
    // en pantalla) — se captura siempre a su tamaño real.
    style: { transform: "none", margin: "0" },
  });
}

function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen capturada del documento."));
    img.src = dataUrl;
  });
}

/** Captura cualquier nodo de ancho/alto FIJO a PNG y lo mete en un PDF de UNA pagina del mismo
 * tamaño exacto. Generico en tamaño/orientacion/calidad — lo usa tanto el slide 16:9 de Reportes
 * como documentos de otro tamaño. `calidad` es el pixelRatio de la captura (2 = nitidez normal,
 * 3 = maxima calidad, archivo mas pesado). */
export async function descargarNodoComoPdf(
  nodo: HTMLElement,
  nombreArchivo: string,
  fondo: string,
  ancho: number,
  alto: number,
  orientacion: "landscape" | "portrait" = ancho >= alto ? "landscape" : "portrait",
  calidad = 2
) {
  // Import dinamico: jspdf + html-to-image (~400 KB) solo se descargan al pedir el PDF.
  const [dataUrl, { jsPDF }] = await Promise.all([rasterizar(nodo, fondo, ancho, alto, calidad), import("jspdf")]);
  const pdf = new jsPDF({ orientation: orientacion, unit: "px", format: [ancho, alto] });
  const img = await cargarImagen(dataUrl);
  pdf.addImage(img, "PNG", 0, 0, ancho, alto, "", "FAST");
  pdf.save(nombreArchivo);
}

/** Version para el slide 16:9 de Reportes (tamaño fijo de siempre) — mismo comportamiento que
 * antes, ahora implementado sobre `descargarNodoComoPdf`. */
export async function descargarComoPdf(nodo: HTMLElement, nombreArchivo: string, fondo: string) {
  await descargarNodoComoPdf(nodo, nombreArchivo, fondo, SLIDE_W, SLIDE_H, "landscape");
}

/** Varios nodos (mismo tamaño), UNA pagina de PDF por nodo — para documentos tipo presentacion
 * (una diapositiva por paso/tema) en vez de un solo PDF de una pagina. Rasteriza todos los nodos
 * EN PARALELO (son capturas independientes) antes de armar el PDF pagina por pagina. */
export async function descargarMultiplesNodosComoPdf(
  nodos: HTMLElement[],
  nombreArchivo: string,
  fondo: string,
  ancho: number,
  alto: number,
  orientacion: "landscape" | "portrait" = ancho >= alto ? "landscape" : "portrait",
  calidad = 2
) {
  if (nodos.length === 0) return;
  const [dataUrls, { jsPDF }] = await Promise.all([
    Promise.all(nodos.map((n) => rasterizar(n, fondo, ancho, alto, calidad))),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: orientacion, unit: "px", format: [ancho, alto] });
  for (let i = 0; i < dataUrls.length; i++) {
    if (i > 0) pdf.addPage([ancho, alto], orientacion);
    const img = await cargarImagen(dataUrls[i]);
    pdf.addImage(img, "PNG", 0, 0, ancho, alto, "", "FAST");
  }
  pdf.save(nombreArchivo);
}
