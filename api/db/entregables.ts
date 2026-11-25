import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, parseJsonArray, parseBool } from "../_shared/turso.js";
import { requerirUsuario, puedeAsignarEntregables, esSuperadmin, esLiderAudiovisual, esGestorRequisiciones, type UsuarioFila } from "../_shared/authz.js";
import { manejarApi, cuerpoJson } from "../_shared/http.js";
import { ErrorAuth } from "../_shared/session.js";
import { nuevoId } from "../_shared/ids.js";

const COLUMNAS: Record<string, string> = {
  proyectoId: "proyecto_id", marcaId: "marca_id", nombre: "nombre", prioridad: "prioridad", tipo: "tipo", formato: "formato",
  orientacionVideo: "orientacion_video", resolucion: "resolucion", duracion: "duracion",
  responsableId: "responsable_id", fechaCompromiso: "fecha_compromiso", version: "version", estado: "estado",
  urlRevision: "url_revision", urlFinal: "url_final", orientacionVideoAlt: "orientacion_video_alt",
  urlRevisionAlt: "url_revision_alt", urlFinalAlt: "url_final_alt", carpetaFotosUrl: "carpeta_fotos_url",
  guionId: "guion_id", dialogoTexto: "dialogo_texto", aprobadorId: "aprobador_id", creadoEn: "creado_en",
  fechaEnviado: "fecha_enviado", fechaEntregado: "fecha_entregado",
  fechaAprobado: "fecha_aprobado", urlPaginaWeb: "url_pagina_web", esDemo: "es_demo",
  sinGuion: "sin_guion", indicaciones: "indicaciones",
};
const COLUMNAS_JSON: Record<string, string> = {
  fotos: "fotos",
  fotosParaBorrar: "fotos_para_borrar",
  materialesApoyo: "materiales_apoyo",
  archivosDiseno: "archivos_diseno",
  fotosSinFondo: "fotos_sin_fondo",
  guionPdf: "guion_pdf",
  checklist: "checklist",
};

/** `guion_pdf` guarda UN objeto ({id,nombre,url,fileId}), no un string suelto. */
function parseGuionPdf(valor: unknown): { id: string; nombre: string; url: string; fileId?: string } | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** `ultima_actividad` guarda UN objeto ({tipo,porId,en}) — mismo patron que `guion_pdf`. */
function parseUltimaActividad(
  valor: unknown
): { tipo: "nuevo" | "correccion" | "actualizacion"; porId: string; en: string } | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** `materiales_apoyo` guarda objetos ({id,nombre,url,fileId,esCarpeta}), no strings sueltos como
 * `fotos` — `parseJsonArray` (tipada a string[]) no sirve aqui. */
function parseMaterialesApoyo(
  valor: unknown
): { id: string; nombre: string; url: string; fileId?: string; esCarpeta?: boolean; tipo?: string }[] | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

type ArchivoDisenoFila = { id: string; nombre: string; url: string; fileId?: string; subtipo: "editable" | "pdf_final" | "logo" };

/** Mismo patron que `parseMaterialesApoyo` — objetos etiquetados, no strings sueltos. */
function parseArchivosDiseno(valor: unknown): ArchivoDisenoFila[] | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

type ChecklistItemFila = { id: string; texto: string; hecho: boolean };

/** Mismo patron que `parseMaterialesApoyo` — objetos etiquetados, no strings sueltos. */
function parseChecklist(valor: unknown): ChecklistItemFila[] | undefined {
  if (typeof valor !== "string" || !valor) return undefined;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** El responsable solo puede marcar/desmarcar `hecho` de items YA EXISTENTES — nunca agregar,
 * redactar ni borrar (ver comentario de `checklist` en puedeActualizar). */
function checklistEsSoloToggle(actual: ChecklistItemFila[], nuevo: unknown): boolean {
  if (!Array.isArray(nuevo) || nuevo.length !== actual.length) return false;
  return actual.every((item, i) => {
    const n = nuevo[i];
    return n && typeof n === "object" && n.id === item.id && n.texto === item.texto;
  });
}

function filaAEntregable(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    proyectoId: f.proyecto_id ? String(f.proyecto_id) : undefined,
    marcaId: f.marca_id ? String(f.marca_id) : undefined,
    nombre: String(f.nombre),
    prioridad: f.prioridad ? String(f.prioridad) : undefined,
    tipo: String(f.tipo),
    formato: f.formato ? String(f.formato) : undefined,
    orientacionVideo: f.orientacion_video ? String(f.orientacion_video) : undefined,
    resolucion: f.resolucion ? String(f.resolucion) : undefined,
    duracion: f.duracion ? String(f.duracion) : undefined,
    responsableId: String(f.responsable_id),
    fechaCompromiso: String(f.fecha_compromiso),
    version: String(f.version),
    estado: String(f.estado),
    urlRevision: f.url_revision ? String(f.url_revision) : undefined,
    urlFinal: f.url_final ? String(f.url_final) : undefined,
    orientacionVideoAlt: f.orientacion_video_alt ? String(f.orientacion_video_alt) : undefined,
    urlRevisionAlt: f.url_revision_alt ? String(f.url_revision_alt) : undefined,
    urlFinalAlt: f.url_final_alt ? String(f.url_final_alt) : undefined,
    fotos: f.fotos ? parseJsonArray(f.fotos) : undefined,
    carpetaFotosUrl: f.carpeta_fotos_url ? String(f.carpeta_fotos_url) : undefined,
    fotosParaBorrar: f.fotos_para_borrar ? parseJsonArray(f.fotos_para_borrar) : undefined,
    fotosSinFondo: f.fotos_sin_fondo ? parseJsonArray(f.fotos_sin_fondo) : undefined,
    guionId: f.guion_id ? String(f.guion_id) : undefined,
    dialogoTexto: f.dialogo_texto ? String(f.dialogo_texto) : undefined,
    materialesApoyo: parseMaterialesApoyo(f.materiales_apoyo),
    guionPdf: parseGuionPdf(f.guion_pdf),
    urlPaginaWeb: f.url_pagina_web ? String(f.url_pagina_web) : undefined,
    archivosDiseno: parseArchivosDiseno(f.archivos_diseno),
    checklist: parseChecklist(f.checklist),
    sinGuion: parseBool(f.sin_guion),
    indicaciones: f.indicaciones ? String(f.indicaciones) : undefined,
    aprobadorId: f.aprobador_id ? String(f.aprobador_id) : undefined,
    creadoEn: String(f.creado_en),
    fechaEnviado: f.fecha_enviado ? String(f.fecha_enviado) : undefined,
    fechaEntregado: f.fecha_entregado ? String(f.fecha_entregado) : undefined,
    fechaAprobado: f.fecha_aprobado ? String(f.fecha_aprobado) : undefined,
    esDemo: parseBool(f.es_demo),
    ultimaActividad: parseUltimaActividad(f.ultima_actividad),
  };
}

function filaAComentario(f: Record<string, unknown>) {
  return {
    id: String(f.id),
    autorId: String(f.autor_id),
    autorNombre: String(f.autor_nombre),
    texto: String(f.texto),
    momento: f.momento ? String(f.momento) : undefined,
    creadoEn: String(f.creado_en),
    corregido: parseBool(f.corregido),
  };
}

/** Portado 1:1 de la regla `entregables.update` de firestore.rules. */
function puedeActualizar(
  usuario: UsuarioFila,
  actual: { estado: string; responsableId: string; checklist: ChecklistItemFila[] },
  cambios: Record<string, unknown>
): boolean {
  // La prioridad (urgencia) la define quien asigna el trabajo — ni el responsable ni community
  // (que solo aprueba) pueden cambiarla, aunque si puedan editar otros campos del mismo PATCH.
  if ("prioridad" in cambios && !esSuperadmin(usuario) && !esLiderAudiovisual(usuario)) return false;
  // Marcar/quitar "prueba de edicion" (esDemo) es solo de superadmin — ni lider ni community
  // (que de otro modo editan todo lo demas via el shortcut de abajo) lo deciden.
  if ("esDemo" in cambios && !esSuperadmin(usuario)) return false;
  // sinGuion/indicaciones las define quien asigna el trabajo — igual que prioridad, ni el
  // responsable ni community las tocan.
  if ("sinGuion" in cambios && !esSuperadmin(usuario) && !esLiderAudiovisual(usuario)) return false;
  if ("indicaciones" in cambios && !esSuperadmin(usuario) && !esLiderAudiovisual(usuario)) return false;
  // El checklist lo arma quien asigna el trabajo (agregar/redactar/borrar items) — igual que
  // puedeAsignarEntregables. El responsable (o cualquier otro rol de abajo) solo puede marcar/
  // desmarcar `hecho` de items que ya existian, nunca tocar la lista en si.
  if ("checklist" in cambios && !esSuperadmin(usuario) && !esLiderAudiovisual(usuario)) {
    if (!checklistEsSoloToggle(actual.checklist, cambios.checklist)) return false;
  }
  if (esSuperadmin(usuario) || esGestorRequisiciones(usuario)) return true;
  const nuevoEstado = typeof cambios.estado === "string" ? cambios.estado : actual.estado;
  if (esLiderAudiovisual(usuario)) return nuevoEstado === actual.estado;
  const esResponsable = usuario.id === actual.responsableId;
  const rolValido = ["superadmin", "lider_audiovisual", "colaborador_audiovisual"].includes(usuario.rol);
  return esResponsable && rolValido && nuevoEstado !== "aprobado";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await manejarApi(req, res, async () => {
    const usuario = await requerirUsuario(req);
    const id = req.query.id ? String(req.query.id) : null;
    const sub = req.query.sub ? String(req.query.sub) : null;

    // --- Comentarios ---
    if (sub === "comentarios") {
      if (!id) throw new ErrorAuth(400, "Falta el id del entregable.");

      if (req.method === "GET") {
        const filas = await db().execute({
          sql: "SELECT * FROM entregables_comentarios WHERE entregable_id = ? ORDER BY creado_en ASC",
          args: [id],
        });
        res.status(200).json(filas.rows.map((f) => filaAComentario(f as Record<string, unknown>)));
        return;
      }

      if (req.method === "POST") {
        if (!esSuperadmin(usuario) && !esGestorRequisiciones(usuario)) {
          throw new ErrorAuth(403, "No tienes permiso para comentar este entregable.");
        }
        const body = cuerpoJson<{ autorId: string; autorNombre: string; texto: string; momento?: string }>(req);
        await db().execute({
          sql: "INSERT INTO entregables_comentarios (id, entregable_id, autor_id, autor_nombre, texto, momento, creado_en, corregido) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
          args: [nuevoId(), id, body.autorId, body.autorNombre, body.texto, body.momento ?? null, new Date().toISOString()],
        });
        res.status(201).json({ ok: true });
        return;
      }

      if (req.method === "PATCH" && req.query.action === "marcar-corregidos") {
        const entregable = await db().execute({ sql: "SELECT responsable_id FROM entregables WHERE id = ?", args: [id] });
        const fila = entregable.rows[0];
        if (!fila) throw new ErrorAuth(404, "Entregable no encontrado.");
        const puede = esSuperadmin(usuario) || esGestorRequisiciones(usuario) || esLiderAudiovisual(usuario) || usuario.id === String(fila.responsable_id);
        if (!puede) throw new ErrorAuth(403, "No tienes permiso.");
        await db().execute({ sql: "UPDATE entregables_comentarios SET corregido = 1 WHERE entregable_id = ? AND corregido = 0", args: [id] });
        res.status(200).json({ ok: true });
        return;
      }

      res.status(405).json({ error: "Metodo no soportado." });
      return;
    }

    // --- Entregables ---
    if (req.method === "GET" && id) {
      const fila = await db().execute({ sql: "SELECT * FROM entregables WHERE id = ?", args: [id] });
      if (!fila.rows[0]) throw new ErrorAuth(404, "Entregable no encontrado.");
      const entregable = filaAEntregable(fila.rows[0] as Record<string, unknown>);
      // Mismo filtro que la lista de abajo: un colaborador_audiovisual solo ve lo suyo. Antes
      // esta rama (buscar por id) no comparaba nada — cualquiera con sesion valida podia leer
      // el entregable COMPLETO de otra persona (incluido el fileId de Drive en urlFinal/urlRevision)
      // con solo conocer su id.
      const veTodo = esSuperadmin(usuario) || esLiderAudiovisual(usuario) || esGestorRequisiciones(usuario);
      if (!veTodo && entregable.responsableId !== usuario.id) {
        throw new ErrorAuth(403, "No tienes permiso para ver este entregable.");
      }
      // "Prueba de edicion" (esDemo) es solo para superadmin/community — ni lider ni el propio
      // responsable (aunque sea el suyo) la ven, para no confundirla con la entrega real.
      const puedeVerDemo = esSuperadmin(usuario) || esGestorRequisiciones(usuario);
      if (entregable.esDemo && !puedeVerDemo) {
        throw new ErrorAuth(403, "No tienes permiso para ver este entregable.");
      }
      res.status(200).json(entregable);
      return;
    }

    if (req.method === "GET") {
      // Un colaborador_audiovisual solo ve SUS propios entregables asignados — antes la lista
      // completa (todo el equipo) se mandaba sin filtrar y el Kanban de Entregables mostraba el
      // trabajo de todos. Lider/superadmin/community (gestor de requisiciones) si ven todo: son
      // quienes asignan o aprueban el trabajo de todo el equipo.
      const veTodo = esSuperadmin(usuario) || esLiderAudiovisual(usuario) || esGestorRequisiciones(usuario);
      const filas = veTodo
        ? await db().execute("SELECT * FROM entregables")
        : await db().execute({ sql: "SELECT * FROM entregables WHERE responsable_id = ?", args: [usuario.id] });
      // "Prueba de edicion" (esDemo) solo la ven superadmin/community — ni lider (aunque "vea
      // todo") ni el responsable (aunque sea su propio entregable), para no confundirla con la
      // entrega real entre varios intentos parecidos.
      const puedeVerDemo = esSuperadmin(usuario) || esGestorRequisiciones(usuario);
      const entregables = filas.rows
        .map((f) => filaAEntregable(f as Record<string, unknown>))
        .filter((e) => !e.esDemo || puedeVerDemo);
      res.status(200).json(entregables);
      return;
    }

    if (req.method === "POST") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para crear entregables.");
      const body = cuerpoJson<Record<string, unknown> & {
        opciones?: { estadoFinal: "aprobado" | "entregado"; fecha: string; urlFinal: string; aprobadorId: string };
      }>(req);
      const { opciones, ...data } = body;
      const nuevoEntregableId = nuevoId();
      const ahora = opciones?.fecha ?? new Date().toISOString();

      await db().execute({
        sql: `INSERT INTO entregables (id, proyecto_id, marca_id, nombre, prioridad, tipo, formato, orientacion_video, resolucion,
                duracion, responsable_id, fecha_compromiso, version, estado, url_final, guion_id, aprobador_id,
                creado_en, fecha_aprobado, fecha_entregado, url_pagina_web)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1', ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          nuevoEntregableId, data.proyectoId ?? null, data.marcaId ?? null, data.nombre, data.prioridad ?? "media",
          data.tipo, data.formato ?? null,
          data.orientacionVideo ?? null, data.resolucion ?? null, data.duracion ?? null, data.responsableId,
          data.fechaCompromiso, opciones ? opciones.estadoFinal : "pendiente", opciones?.urlFinal ?? null,
          data.guionId ?? null, opciones?.aprobadorId ?? null, ahora,
          opciones ? opciones.fecha : null, opciones?.estadoFinal === "entregado" ? opciones.fecha : null,
          data.urlPaginaWeb ?? null,
        ] as any[],
      });
      const fila = await db().execute({ sql: "SELECT * FROM entregables WHERE id = ?", args: [nuevoEntregableId] });
      res.status(201).json(filaAEntregable(fila.rows[0] as Record<string, unknown>));
      return;
    }

    if (!id) throw new ErrorAuth(400, "Falta el id del entregable.");

    if (req.method === "PATCH") {
      const actualRes = await db().execute({
        sql: "SELECT estado, responsable_id, tipo, archivos_diseno, checklist FROM entregables WHERE id = ?",
        args: [id],
      });
      const actual = actualRes.rows[0];
      if (!actual) throw new ErrorAuth(404, "Entregable no encontrado.");
      const body = cuerpoJson<Record<string, unknown>>(req);
      const actualParaPermiso = {
        estado: String(actual.estado),
        responsableId: String(actual.responsable_id),
        checklist: parseChecklist(actual.checklist) ?? [],
      };
      if (!puedeActualizar(usuario, actualParaPermiso, body)) {
        throw new ErrorAuth(403, "No tienes permiso para editar este entregable.");
      }

      // Un diseño no puede aprobarse/entregarse sin el editable Y el PDF final cargados — evita
      // que se publique/cierre un trabajo a medias por olvido. Si este mismo PATCH ya trae
      // `archivosDiseno` actualizado (ej. se subio el ultimo archivo y se aprueba de un jalon) se
      // revisa ESE valor, no el viejo de la base.
      const nuevoEstado = typeof body.estado === "string" ? body.estado : undefined;
      if (String(actual.tipo) === "diseno_grafico" && (nuevoEstado === "aprobado" || nuevoEstado === "entregado")) {
        const archivos = Array.isArray(body.archivosDiseno)
          ? (body.archivosDiseno as ArchivoDisenoFila[])
          : (parseArchivosDiseno(actual.archivos_diseno) ?? []);
        const tieneEditable = archivos.some((a) => a?.subtipo === "editable");
        const tienePdf = archivos.some((a) => a?.subtipo === "pdf_final");
        if (!tieneEditable || !tienePdf) {
          throw new ErrorAuth(400, "Falta subir el editable y/o el PDF final antes de aprobar este diseño.");
        }
      }

      const campos: string[] = [];
      const args: any[] = [];
      for (const [campo, valor] of Object.entries(body)) {
        if (COLUMNAS[campo]) {
          campos.push(`${COLUMNAS[campo]} = ?`);
          // `es_demo` (y cualquier futura columna booleana) se guarda como 0/1 de SQLite, no el
          // `true`/`false` de JS tal cual.
          args.push(typeof valor === "boolean" ? (valor ? 1 : 0) : (valor ?? null));
        } else if (campo === "guionPdf") {
          // Unico objeto JSON (no arreglo) entre las columnas JSON — valor falsy quita el PDF.
          campos.push("guion_pdf = ?");
          args.push(valor ? JSON.stringify(valor) : null);
        } else if (campo === "ultimaActividad") {
          campos.push("ultima_actividad = ?");
          args.push(valor ? JSON.stringify(valor) : null);
        } else if (COLUMNAS_JSON[campo]) {
          campos.push(`${COLUMNAS_JSON[campo]} = ?`);
          args.push(valor && Array.isArray(valor) && valor.length > 0 ? JSON.stringify(valor) : null);
        }
      }
      if (campos.length === 0) {
        res.status(200).json({ ok: true });
        return;
      }
      args.push(id);
      await db().execute({ sql: `UPDATE entregables SET ${campos.join(", ")} WHERE id = ?`, args });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      if (!puedeAsignarEntregables(usuario)) throw new ErrorAuth(403, "No tienes permiso para eliminar entregables.");
      await db().execute({ sql: "DELETE FROM entregables_comentarios WHERE entregable_id = ?", args: [id] });
      await db().execute({ sql: "DELETE FROM entregables WHERE id = ?", args: [id] });
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Metodo no soportado." });
  });
}
