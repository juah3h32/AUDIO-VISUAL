import { SLIDE_H, SLIDE_W } from "@/components/reportes/SlideRendimiento";

/** Captura cualquier nodo de ancho/alto FIJO a PNG y lo mete en un PDF de UNA pagina del mismo
 * tamaño exacto. La imagen se carga en un <img> real antes de `addImage` para que jsPDF reciba
 * una imagen ya decodificada. `transform: none` anula el escalado de una vista previa (si el
 * nodo se mostraba encogido en pantalla). Generico en tamaño/orientacion — lo usa tanto el slide
 * 16:9 de Reportes como documentos mas altos tipo "guia" (ver GuiaProduccionDoc.tsx). */
export async function descargarNodoComoPdf(
  nodo: HTMLElement,
  nombreArchivo: string,
  fondo: string,
  ancho: number,
  alto: number,
  orientacion: "landscape" | "portrait" = ancho >= alto ? "landscape" : "portrait"
) {
  // Import dinamico: jspdf + html-to-image (~400 KB) solo se descargan al pedir el PDF.
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const dataUrl = await toPng(nodo, {
    pixelRatio: 2,
    backgroundColor: fondo,
    width: ancho,
    height: alto,
    style: { transform: "none", margin: "0" },
  });
  const pdf = new jsPDF({ orientation: orientacion, unit: "px", format: [ancho, alto] });
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      pdf.addImage(img, "PNG", 0, 0, ancho, alto, "", "FAST");
      resolve();
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen capturada del documento."));
    img.src = dataUrl;
  });
  pdf.save(nombreArchivo);
}

/** Version para el slide 16:9 de Reportes (tamaño fijo de siempre) — mismo comportamiento que
 * antes, ahora implementado sobre `descargarNodoComoPdf`. */
export async function descargarComoPdf(nodo: HTMLElement, nombreArchivo: string, fondo: string) {
  await descargarNodoComoPdf(nodo, nombreArchivo, fondo, SLIDE_W, SLIDE_H, "landscape");
}
