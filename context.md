# AV CONTROL — Contexto

> Sistema Integral de Gestion Audiovisual — Grupo Ortiz
> Raiz: /Users/govideo/Documents/PAGINAS WEB/VISUAL
> Owner: JUANPA (tecnico) | Ana Torres (Lider Audiovisual, owner funcional)

## Que es

App web real (no maqueta). Centraliza operacion del depto audiovisual: requisiciones, proyectos, tareas, salidas de grabacion a fabricas, equipo AV, equipo humano, calendario, postproduccion/entregables, metricas, reportes.

## Entidades clave (no confundir)

- Requisicion: solicitud de contenido, pasa por aprobacion.
- Proyecto: unidad de trabajo, nace de 1+ requisiciones aprobadas.
- Tarea: trabajo atomico dentro de un proyecto.
- Jornada/Salida de grabacion: evento de produccion en planta o locacion externa.
- Entregable: archivo final versionado, vinculado a proyecto.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + Lucide + Recharts + TanStack Query + React Hook Form + Zod.
- Auth: Firebase Auth (Google) — unico pedazo de Firebase que sigue en uso.
- Base de datos: **Turso (libSQL/SQLite)**, desde el 2026-11-04 (antes Firestore — ver "Migracion Firestore -> Turso" abajo). Acceso SIEMPRE via funciones serverless de Vercel (`api/db/*.ts`), nunca desde el navegador — Turso no tiene reglas de seguridad declarativas como Firestore, asi que toda la autorizacion vive en servidor (`api/db/_shared/authz.ts`).
- Archivos (videos, fotos, logos, PDFs): Google Drive, centralizado en el Drive personal de `pablocorona111@gmail.com` via funciones serverless de Vercel (`api/drive-*.ts`), no Firebase Storage ni Drive personal de cada usuario.
- Hosting/deploy: Vercel (proyecto `control-go`).

## Migracion Firestore -> Turso (2026-11-04)

Se migro TODA la base de datos de Firestore a Turso (SQLite), manteniendo Firebase Auth intacto. Motivo: decision del usuario de consolidar en Turso. Firestore se dejo de escribir pero **sus datos siguen ahi intactos como respaldo** (no se borraron) hasta confirmar un dia completo de uso real sobre Turso en produccion.

**Arquitectura nueva:**
- `scripts/turso-schema.sql` — schema completo (16 tablas). Sin `FOREIGN KEY` reales a proposito: Firestore nunca forzo integridad referencial (un entregable puede seguir apuntando a un `proyectoId` borrado — ver "Proyecto eliminado" en `ArchivosPage.tsx`) y ademas Turso via HTTP no mantiene `PRAGMA foreign_keys` entre llamadas separadas, asi que declararlas no se podria hacer cumplir de todos modos. El cascade de comentarios (antes `ON DELETE CASCADE`) se hace a mano en cada endpoint `DELETE`.
- `api/db/*.ts` — un endpoint por grupo de entidades (`usuarios`, `requisiciones`, `proyectos`, `entregables`, `guiones`, `salidas`, `equipo`, `marcas`, `metas`, `notificaciones`, `admin`). Cada uno verifica el ID token de Firebase (`api/db/_shared/firebaseAuth.ts`) y aplica permisos portados 1:1 de las `firestore.rules` originales (`api/db/_shared/authz.ts`) — NO la version de `src/lib/roles.ts`, que es mas permisiva (solo decide que se MUESTRA en la UI).
- `src/services/*.ts` — mismas firmas exportadas de siempre, por dentro hacen `fetch` a `/api/db/*` (via `src/lib/apiClient.ts`) en vez de llamar al SDK de Firestore. Los hooks (`src/hooks/*.ts`) y las paginas no cambiaron nada.
- Tiempo real: Firestore tenia `onSnapshot` (entregables/usuarios en `useCatalogos.ts`, notificaciones en `notificacionesService.ts`, rol del usuario en `AuthContext.tsx`). Turso no tiene listeners nativos — se reemplazo por polling (20s entregables/usuarios, 15s notificaciones, 60s + foco de ventana el perfil propio).
- `scripts/migrar-firestore-a-turso.mjs` — script de migracion de datos (ya corrido una vez contra produccion). Solo LEE de Firestore, nunca escribe ahi. `--dry-run` para ver conteos sin tocar Turso.
- `scripts/test-e2e-fase*.mjs` + `scripts/get-test-token.mjs` — smoke tests end-to-end de los endpoints (mintan un ID token real de Firebase via Admin SDK para probar cada ruta con permisos reales). Correrlos despues de tocar cualquier `api/db/*.ts`.

**Variables de entorno nuevas que requiere `control-go` en Vercel** (Production + Development; Preview quedo pendiente por una limitacion del CLI): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.

**Pendiente antes de poder borrar Firestore del todo**: confirmar con el usuario un dia completo de uso real en produccion sobre Turso. Mientras tanto `firestore.rules` y los datos viejos se quedan como estan, sin desplegar cambios nuevos ahi.

## Infraestructura y deploy — REQUIERE 2 proyectos distintos

El sistema vive repartido en dos proveedores que hay que mantener sincronizados:

1. **Firebase** (`av-control-grupo-ortiz`) — solo Auth (Google). Firestore ya no se usa (ver arriba).
2. **Vercel** (proyecto `control-go`, team `sistemas-projects-7bb47e57`) — hostea el frontend y las funciones serverless: `api/db/*.ts` (datos, Turso) y `api/drive-*.ts` (archivos, Google Drive).

**Variables de entorno que requiere `control-go` en Vercel** (Production, Preview y Development — las 3, Vercel no las comparte entre ambientes):

- `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` — del proyecto Firebase (solo Auth). Sin esto el build falla (`vite.config.ts` lo valida y detiene el build en Production).
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — acceso a la base de datos. Sin esto, cualquier endpoint `/api/db/*` responde 500 "Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN".
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — cuenta de servicio de Firebase Admin (mismo JSON que `firebase-adminsdk-*.json`, guardado FUERA del repo en `~/.secrets/av-control/`). Las usan `api/drive-video.ts`/`api/drive-thumbnail.ts` para verificar la sesion de quien pide un archivo.
- `GOOGLE_DRIVE_OWNER_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` — credenciales OAuth de Drive de `pablocorona111@gmail.com` (cuenta Gmail normal, no Workspace). Sin esto, **ninguna subida de archivo funciona** (ni videos, ni fotos, ni logos de Marcas, ni manuales PDF) — falla con "Failed to execute json" porque el endpoint regresa error sin cuerpo. Ver `.env.example` para los pasos exactos de como generarlas desde cero en Google Cloud Console.

Ver `.env.example` en la raiz para el detalle linea por linea de cada variable y como obtenerla.

**Para correr el sistema completo en local** (incluyendo subir archivos y leer/escribir datos): `vercel dev`, NO `npm run dev`. `npm run dev` solo levanta Vite (el frontend) — las rutas `/api/*` no existen ahi y cualquier operacion truena con un 404 vacio o "Failed to execute json". `vercel link` ya quedo hecho apuntando a `control-go`; `vercel env pull .env.local --environment=production` trae las credenciales reales antes de correr `vercel dev`.

**Para aplicar cambios al schema de Turso**: editar `scripts/turso-schema.sql` y correr `node scripts/apply-schema.mjs` (usa `CREATE TABLE IF NOT EXISTS`, no destruye datos existentes).

## Identidad visual

Ver `DESIGN_SYSTEM.md`.

## Roles (5 + 1 permiso especial)

1. Superadministrador
2. Lider audiovisual
3. Colaborador audiovisual
4. Solicitante
5. Aprobador departamental
+ Permiso especial: "Gestor de requisiciones" (venta/gestion, ej. community manager) — scope limitado, ver `SECURITY.md`.

## Modulos (13)

1. Dashboard principal
2. Requisiciones
3. Proyectos
4. Grabaciones y salidas a fabricas (modulo critico)
5. Equipo audiovisual (inventario)
6. Equipo humano
7. Calendario general
8. Postproduccion y entregables
9. Metricas y reportes
10. Autenticacion y permisos (transversal)
11. Notificaciones (transversal, Cloud Functions)
12. Archivos/referencias
13. Configuracion

## Referencia visual recibida

Mockup dashboard: `/Users/govideo/Downloads/WhatsApp Image 2026-10-14 at 8.33.10 a. m..jpeg`
Usuario: Ana Torres, Lider Audiovisual. Sidebar: Inicio, Requisiciones, Proyectos, Calendario, Equipo, Entregables, Metricas, Archivos, Reportes, Configuracion.

## Brief original

Brief completo del usuario (13 secciones, roles, campos, estados, formulas) recibido 2026-10-14. Fuente de verdad para requerimientos — no reinventar scope, consultar antes de recortar funcionalidad.
