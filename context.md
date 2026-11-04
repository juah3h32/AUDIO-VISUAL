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
- Backend de datos: Firebase (Auth con Google + Firestore). Storage de Firebase NO se usa.
- Archivos (videos, fotos, logos, PDFs): Google Drive, centralizado en el Drive personal de `pablocorona111@gmail.com` via funciones serverless de Vercel (`api/drive-*.ts`), no Firebase Storage ni Drive personal de cada usuario.
- Hosting/deploy: Vercel (proyecto `control-go`, no Firebase Hosting pese a lo que decia esta seccion antes).

## Infraestructura y deploy — REQUIERE 2 proyectos distintos

El sistema vive repartido en dos proveedores que hay que mantener sincronizados:

1. **Firebase** (`av-control-grupo-ortiz`) — Auth (Google) + Firestore (toda la data: requisiciones, proyectos, entregables, marcas, etc.) + reglas de seguridad (`firestore.rules`).
2. **Vercel** (proyecto `control-go`, team `sistemas-projects-7bb47e57`) — hostea el frontend y las funciones serverless de `api/*.ts` que hablan con Google Drive.

**Variables de entorno que requiere `control-go` en Vercel** (Production, Preview y Development — las 3, Vercel no las comparte entre ambientes):

- `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` — del proyecto Firebase. Sin esto el build falla (`vite.config.ts` lo valida y detiene el build en Production).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — cuenta de servicio de Firebase Admin (mismo JSON que `firebase-adminsdk-*.json`, guardado FUERA del repo en `~/.secrets/av-control/`). Las usan `api/drive-video.ts`/`api/drive-thumbnail.ts` para verificar la sesion de quien pide un archivo.
- `GOOGLE_DRIVE_OWNER_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` — credenciales OAuth de Drive de `pablocorona111@gmail.com` (cuenta Gmail normal, no Workspace). Sin esto, **ninguna subida de archivo funciona** (ni videos, ni fotos, ni logos de Marcas, ni manuales PDF) — falla con "Failed to execute json" porque el endpoint regresa error sin cuerpo. Ver `.env.example` para los pasos exactos de como generarlas desde cero en Google Cloud Console.

Ver `.env.example` en la raiz para el detalle linea por linea de cada variable y como obtenerla.

**Para correr el sistema completo en local** (incluyendo subir archivos): `vercel dev`, NO `npm run dev`. `npm run dev` solo levanta Vite (el frontend) — las rutas `/api/*` no existen ahi y cualquier subida truena con un 404 vacio. `vercel link` ya quedo hecho apuntando a `control-go`; `vercel env pull .env.local --environment=production` trae las credenciales reales antes de correr `vercel dev`.

**Para publicar cambios en las reglas de Firestore**: `firebase deploy --only firestore:rules --project av-control-grupo-ortiz` (requiere `firebase login` ya hecho). Editar `firestore.rules` en el repo NO alcanza — si no se despliega, Firestore sigue con las reglas viejas (o las de bloqueo total si nunca se desplegaron, que fue justo el bug del Inicio en blanco del 2026-11-03).

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
