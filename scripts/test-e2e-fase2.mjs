import { obtenerSesionDePrueba, limpiarUsuarioPrueba } from "./get-test-session.mjs";

const BASE = process.argv[2] || "http://localhost:3231";
const { cookie, turso } = await obtenerSesionDePrueba(BASE);
const headers = { Cookie: cookie, "Content-Type": "application/json" };

async function probar(nombre, fn) {
  try {
    await fn();
    console.log(`OK  ${nombre}`);
  } catch (e) {
    console.log(`ERR ${nombre}:`, e.message);
  }
}

await probar("GET /api/db/usuarios", async () => {
  const r = await fetch(`${BASE}/api/db/usuarios`, { headers });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  console.log("   ->", d.length, "usuario(s)");
});

await probar("GET /api/db/equipo?tipo=equipo_av", async () => {
  const r = await fetch(`${BASE}/api/db/equipo?tipo=equipo_av`, { headers });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  console.log("   ->", d.length, "equipo(s)");
});

let colaboradorId;
await probar("POST /api/db/equipo (crear colaborador)", async () => {
  const r = await fetch(`${BASE}/api/db/equipo`, {
    method: "POST",
    headers,
    body: JSON.stringify({ nombre: "Colab E2E", puesto: "Editor", especialidades: ["Edicion"], disponibilidad: "disponible" }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  colaboradorId = d.id;
  console.log("   -> creado", d.id);
});

await probar("PATCH /api/db/equipo?tipo=perfil", async () => {
  const r = await fetch(`${BASE}/api/db/equipo?tipo=perfil&id=${colaboradorId}&tieneCuenta=0`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ especialidades: ["Edicion", "Motion"], puesto: "Editor Senior" }),
  });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

let salidaId;
await probar("POST /api/db/salidas", async () => {
  const r = await fetch(`${BASE}/api/db/salidas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombreJornada: "Salida E2E", proyectosRelacionados: [], tipoActividad: "entrevista", planta: "Toluca",
      fecha: "2026-12-01", horaSalida: "08:00", horaEstimadaLlegada: "09:00", personalAsignado: [],
      responsableProduccionId: "test-superadmin-uid", equipoRequerido: [],
    }),
  });
  const d = await r.json();
  if (r.status !== 201) throw new Error(`status ${r.status} ${JSON.stringify(d)}`);
  salidaId = d.id;
  console.log("   -> creado", d.folio);
});

await probar("PATCH /api/db/salidas (autorizar)", async () => {
  const r = await fetch(`${BASE}/api/db/salidas?id=${salidaId}`, {
    method: "PATCH", headers, body: JSON.stringify({ estadoAutorizacion: "autorizada" }),
  });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

await probar("PUT /api/db/metas", async () => {
  const r = await fetch(`${BASE}/api/db/metas`, {
    method: "PUT", headers,
    body: JSON.stringify({ id: "test-superadmin-uid", responsabilidad: "Prueba", metasSemanales: { videos: 2 }, proyectosACargo: [] }),
  });
  if (r.status !== 200) throw new Error(`status ${r.status}`);
});

await probar("GET /api/db/metas", async () => {
  const r = await fetch(`${BASE}/api/db/metas`, { headers });
  const d = await r.json();
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  console.log("   ->", d.length, "meta(s)");
});

// Limpieza
await turso.execute({ sql: "DELETE FROM colaboradores WHERE id = ?", args: [colaboradorId] });
await turso.execute({ sql: "DELETE FROM salidas WHERE id = ?", args: [salidaId] });
await turso.execute({ sql: "DELETE FROM metas WHERE id = ?", args: ["test-superadmin-uid"] });
await limpiarUsuarioPrueba(turso);
console.log("Limpieza completa.");
