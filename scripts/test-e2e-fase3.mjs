import { obtenerSesionDePrueba, limpiarUsuarioPrueba, UID_PRUEBA } from "./get-test-session.mjs";

const BASE = process.argv[2] || "http://localhost:3240";
const { cookie, turso } = await obtenerSesionDePrueba(BASE, "superadmin");
const headers = { Cookie: cookie, "Content-Type": "application/json" };

const limpieza = [];
async function probar(nombre, fn) {
  try {
    await fn();
    console.log(`OK  ${nombre}`);
  } catch (e) {
    console.log(`ERR ${nombre}:`, e.message);
  }
}

let proyectoId, guionId, entregableId, requisicionId;

await probar("POST /api/db/proyectos", async () => {
  const r = await fetch(`${BASE}/api/db/proyectos`, {
    method: "POST", headers,
    body: JSON.stringify({ nombre: "Proyecto E2E", requisicionesVinculadas: [], colaboradoresIds: [], departamentoSolicitante: "Marketing", prioridad: "media" }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  proyectoId = d.id;
  console.log("   ->", d.folio);
  limpieza.push(() => turso.execute({ sql: "DELETE FROM proyectos WHERE id = ?", args: [proyectoId] }));
});

await probar("GET /api/db/proyectos", async () => {
  const r = await fetch(`${BASE}/api/db/proyectos`, { headers });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  console.log("   ->", d.length, "proyecto(s)");
});

await probar("PATCH /api/db/proyectos", async () => {
  const r = await fetch(`${BASE}/api/db/proyectos?id=${proyectoId}`, { method: "PATCH", headers, body: JSON.stringify({ etapaActual: "produccion", porcentajeAvance: 30 }) });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

await probar("POST /api/db/guiones", async () => {
  const r = await fetch(`${BASE}/api/db/guiones`, {
    method: "POST", headers,
    body: JSON.stringify({ proyectoId, titulo: "Guion E2E", objetivo: "probar", contenido: "hola", responsableId: UID_PRUEBA }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  guionId = d.id;
  console.log("   ->", d.folio);
  limpieza.push(() => turso.execute({ sql: "DELETE FROM guiones WHERE id = ?", args: [guionId] }));
});

await probar("POST /api/db/guiones comentario (rol superadmin)", async () => {
  const r = await fetch(`${BASE}/api/db/guiones?id=${guionId}&sub=comentarios`, {
    method: "POST", headers, body: JSON.stringify({ autorId: UID_PRUEBA, autorNombre: "Test", texto: "comentario" }),
  });
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("GET /api/db/guiones comentarios", async () => {
  const r = await fetch(`${BASE}/api/db/guiones?id=${guionId}&sub=comentarios`, { headers });
  const d = await r.json();
  if (r.status !== 200 || d.length !== 1) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
});

await probar("POST /api/db/entregables", async () => {
  const r = await fetch(`${BASE}/api/db/entregables`, {
    method: "POST", headers,
    body: JSON.stringify({ proyectoId, nombre: "Entregable E2E", tipo: "video_institucional", responsableId: UID_PRUEBA, fechaCompromiso: "2026-12-15" }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  entregableId = d.id;
  console.log("   ->", d.id, d.estado);
  limpieza.push(() => turso.execute({ sql: "DELETE FROM entregables WHERE id = ?", args: [entregableId] }));
});

await probar("PATCH /api/db/entregables (enviar a revision)", async () => {
  const r = await fetch(`${BASE}/api/db/entregables?id=${entregableId}`, {
    method: "PATCH", headers, body: JSON.stringify({ urlRevision: "https://drive.google.com/x", estado: "en_revision", fechaEnviado: new Date().toISOString() }),
  });
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("GET /api/db/entregables?id=X (uno solo)", async () => {
  const r = await fetch(`${BASE}/api/db/entregables?id=${entregableId}`, { headers });
  const d = await r.json();
  if (r.status !== 200 || d.estado !== "en_revision") throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
});

await probar("POST /api/db/entregables comentario", async () => {
  const r = await fetch(`${BASE}/api/db/entregables?id=${entregableId}&sub=comentarios`, {
    method: "POST", headers, body: JSON.stringify({ autorId: UID_PRUEBA, autorNombre: "Test", texto: "revisa esto" }),
  });
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("PATCH /api/db/entregables (aprobar)", async () => {
  const r = await fetch(`${BASE}/api/db/entregables?id=${entregableId}`, {
    method: "PATCH", headers, body: JSON.stringify({ estado: "aprobado", aprobadorId: UID_PRUEBA, urlFinal: "https://drive.google.com/y", fechaAprobado: new Date().toISOString() }),
  });
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("POST /api/db/requisiciones", async () => {
  const r = await fetch(`${BASE}/api/db/requisiciones`, {
    method: "POST", headers,
    body: JSON.stringify({
      titulo: "Requisicion E2E", departamentoSolicitante: "Marketing", nombreSolicitante: "Test",
      solicitanteId: UID_PRUEBA, tipoContenido: "video_institucional", objetivo: "probar", descripcion: "desc",
      cantidadEntregables: 1, fechaRequerida: "2026-12-20", prioridad: "media", necesitaGrabacion: false,
    }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  requisicionId = d.id;
  console.log("   ->", d.folio);
  limpieza.push(() => turso.execute({ sql: "DELETE FROM requisiciones WHERE id = ?", args: [requisicionId] }));
});

await probar("GET /api/db/requisiciones (superadmin ve todo)", async () => {
  const r = await fetch(`${BASE}/api/db/requisiciones`, { headers });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  console.log("   ->", d.length, "requisicion(es)");
});

await probar("PATCH /api/db/requisiciones?action=estado", async () => {
  const r = await fetch(`${BASE}/api/db/requisiciones?id=${requisicionId}&action=estado`, { method: "PATCH", headers, body: JSON.stringify({ estado: "aprobada" }) });
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

await probar("PATCH /api/db/requisiciones?action=gestor", async () => {
  const r = await fetch(`${BASE}/api/db/requisiciones?id=${requisicionId}&action=gestor`, { method: "PATCH", headers, body: JSON.stringify({ gestor: { id: UID_PRUEBA, correo: "test@local" } }) });
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(await r.json())}`);
});

for (const limpiar of limpieza.reverse()) await limpiar();
await limpiarUsuarioPrueba(turso);
console.log("Limpieza completa.");
