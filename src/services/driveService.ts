export interface ArchivoSubido {
  id: string;
  previewUrl: string;
  viewUrl: string;
  /** Carpeta de Drive donde quedo el archivo — solo en subidas nuevas (no al reemplazar
   * contenido de un `fileIdExistente`, ahi no se vuelve a resolver la carpeta). */
  carpetaId?: string;
  carpetaUrl?: string;
}

/** Extrae el ID de archivo de Drive de cualquier link (view, preview, open?id=...). */
export function extraerFileIdDrive(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Extrae el ID de CARPETA de un link `https://drive.google.com/drive/folders/{id}`. */
export function extraerCarpetaIdDrive(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function linksDe(id: string, carpetaId?: string): ArchivoSubido {
  return {
    id,
    previewUrl: `https://drive.google.com/file/d/${id}/preview`,
    viewUrl: `https://drive.google.com/file/d/${id}/view`,
    ...(carpetaId ? { carpetaId, carpetaUrl: `https://drive.google.com/drive/folders/${carpetaId}` } : {}),
  };
}

// La API de Drive (a diferencia de Cloud Storage) no responde CORS en sus URLs de sesion
// reanudable — el navegador NO puede hacer el PUT directo a googleapis.com (lo bloquea sin
// siquiera mandar la peticion). Por eso el archivo pasa por `/api/drive-upload-chunk`, pero en
// PEDAZOS de este tamaño para no chocar con el limite de ~4.5 MB de body de Vercel — un video de
// cualquier tamaño sube igual, solo que en varias llamadas en vez de una.
const TAMANO_CHUNK = 3 * 1024 * 1024;

function subirUnChunk(
  chunk: Blob,
  sessionUrl: string,
  rangoBytes: string,
  onProgress?: (porcentajeDelChunk: number) => void
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/drive-upload-chunk");
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Session-Url", sessionUrl);
    xhr.setRequestHeader("Content-Range", rangoBytes);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Error de red al subir a Drive."));
    xhr.send(chunk);
  });
}

async function subirBytesPorChunks(
  file: File,
  sessionUrl: string,
  onProgress?: (porcentaje: number) => void
): Promise<{ id: string }> {
  const total = file.size || 1;
  let subido = 0;

  for (let inicio = 0; inicio < total; inicio += TAMANO_CHUNK) {
    const fin = Math.min(inicio + TAMANO_CHUNK, total);
    const chunk = file.slice(inicio, fin);
    const rangoBytes = `bytes ${inicio}-${fin - 1}/${total}`;

    const { status, body } = await subirUnChunk(chunk, sessionUrl, rangoBytes, (pctChunk) => {
      if (!onProgress) return;
      const subidoConEste = subido + (pctChunk / 100) * chunk.size;
      onProgress(Math.round((subidoConEste / total) * 100));
    });
    subido = fin;

    if (status === 200 || status === 201) {
      try {
        return JSON.parse(body) as { id: string };
      } catch {
        throw new Error("Drive no entrego el id del archivo subido.");
      }
    }
    // 308 = "falta mas" (protocolo normal de subida reanudable) — sigue con el siguiente pedazo.
    if (status !== 308) {
      throw new Error(`No se pudo subir el archivo a Drive (codigo ${status}).`);
    }
  }

  throw new Error("La subida termino sin que Drive confirmara el archivo.");
}

async function compartirEnDriveCentral(id: string): Promise<void> {
  try {
    await fetch("/api/drive-share", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    // si falla compartir, el archivo igual quedo subido.
  }
}

/**
 * Sube un archivo a la cuenta CENTRAL de Drive de la organizacion, sin importar de que cuenta de
 * Google sea quien esta logueado en AV Control — ver `api/drive-upload-session.ts`.
 *
 * El navegador pide la sesion de subida al backend (que resuelve/crea la carpeta y la abre con
 * la cuenta central) y luego sube los BYTES directo a esa sesion — el archivo nunca pasa por
 * nuestra funcion serverless (sin eso, un video grande chocaria con el limite de tamaño de
 * request de Vercel).
 */
export async function subirArchivoCentralizado(
  file: File,
  opciones: {
    nombre: string;
    nombreCarpeta: string;
    subcarpeta?: string;
    carpetaIdDestino?: string;
    fileIdExistente?: string;
    onProgress?: (porcentaje: number) => void;
  }
): Promise<ArchivoSubido> {
  const { nombre, nombreCarpeta, subcarpeta, carpetaIdDestino, fileIdExistente, onProgress } = opciones;

  async function abrirSesionYSubir(intentarReemplazo: boolean) {
    const sesionRes = await fetch("/api/drive-upload-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        // `nombre` es la etiqueta que vera Drive (ej. "Proyecto X - Entrega final"), casi nunca
        // trae la extension real del archivo — el backend valida el TIPO contra esta, el nombre
        // de archivo original tal cual lo eligio el usuario (ej. "video-final.mp4").
        nombreArchivoOriginal: file.name,
        nombreCarpeta,
        subcarpeta,
        carpetaIdDestino,
        fileIdExistente: intentarReemplazo ? fileIdExistente : undefined,
      }),
    });
    const sesionData = (await sesionRes.json()) as { sessionUrl?: string; carpetaId?: string | null; error?: string };
    if (!sesionRes.ok || !sesionData.sessionUrl) {
      throw new Error(sesionData.error || "No se pudo iniciar la subida a Drive.");
    }
    const { id } = await subirBytesPorChunks(file, sesionData.sessionUrl, onProgress);
    return { id, carpetaId: sesionData.carpetaId ?? null };
  }

  let resultado: { id: string; carpetaId: string | null };
  try {
    resultado = await abrirSesionYSubir(Boolean(fileIdExistente));
  } catch (err) {
    // Reemplazar en el MISMO archivo puede abrir la sesion bien pero rechazar los bytes ya a
    // medias (403/404) si ese archivo es de antes de centralizar — en ese caso, y SOLO si se
    // habia pedido reemplazo, se reintenta de cero como archivo NUEVO en vez de fallar la subida
    // completa ("vuelve a subir y que quede en su lugar", sin que la persona sepa de este detalle).
    const mensaje = err instanceof Error ? err.message : "";
    if (fileIdExistente && /codigo 403|codigo 404/.test(mensaje)) {
      resultado = await abrirSesionYSubir(false);
    } else {
      throw err;
    }
  }

  await compartirEnDriveCentral(resultado.id);
  if (resultado.carpetaId) {
    await compartirEnDriveCentral(resultado.carpetaId);
  }
  return linksDe(resultado.id, resultado.carpetaId ?? undefined);
}

/** Manda un archivo de Drive a la papelera (no borrado permanente — recuperable desde la
 * papelera de Drive por 30 dias) usando la cuenta central del dueño. Para cuando de verdad ya no
 * se quiere el archivo, no solo quitar su referencia del sistema (eso es
 * `eliminarMaterialEntregable`) — asi no hay que entrar a Drive a mano a borrarlo. */
export async function moverABasuraDrive(fileId: string): Promise<void> {
  const res = await fetch("/api/drive-delete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: fileId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "No se pudo borrar el archivo en Drive.");
  }
}
