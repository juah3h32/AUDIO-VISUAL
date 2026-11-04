# AV CONTROL — Status

> Actualizado: 2026-11-04

## Fase actual

Fase 8 — Produccion. Migracion completa de Firestore a Turso terminada y probada de punta a punta (automatizado); falta que el usuario la use un dia real antes de dar por cerrado el corte con Firestore.

## % MVP

Ver `MVP_BREAKDOWN.md`. Sin cambios de alcance funcional hoy — todo lo de ayer (Marcas, auditoria) sigue igual, solo cambio donde vive la data.

## Semaforo

Verde con un pendiente: sistema corriendo sobre Turso, todos los endpoints probados con tokens reales de Firebase y datos reales migrados (incluido un login simulado de un superadmin real existente, exitoso). Falta uso real en produccion por el equipo.

## Que se hizo hoy (2026-11-04): migracion completa Firestore -> Turso

Ver `context.md` seccion "Migracion Firestore -> Turso" para el detalle tecnico completo. Resumen:

1. **Fundacion**: schema de 16 tablas en Turso (`scripts/turso-schema.sql`), modulos compartidos de servidor (`api/db/_shared/`: cliente Turso, verificacion de token Firebase, permisos portados de `firestore.rules`).
2. **11 endpoints nuevos** (`api/db/*.ts`): usuarios, requisiciones, proyectos, entregables (+comentarios), guiones (+comentarios), salidas, equipo, marcas, metas, notificaciones, admin.
3. **Todos los servicios de `src/services/`** reescritos para hablar con esos endpoints via `fetch` (nuevo `src/lib/apiClient.ts`) en vez del SDK de Firestore — misma firma exportada en cada uno, cero cambios en hooks ni paginas.
4. **`AuthContext.tsx`** reescrito: el alta por invitacion y la resolucion de usuario ahora pasan por `/api/db/usuarios?action=resolver` en servidor (antes era logica directa a Firestore en el cliente). El `onSnapshot` en vivo del rol se reemplazo por poll cada 60s + al recuperar el foco de la ventana.
5. **Tiempo real reemplazado por polling**: `useCatalogos.ts` (entregables/usuarios, 20s) y `notificacionesService.ts` (15s) — Turso no tiene listeners nativos.
6. **Datos reales migrados**: 4 usuarios, 1 invitacion, 3 proyectos, 2 guiones, 102 entregables (+9 comentarios), 2 salidas, 77 notificaciones, 4 contadores de folio. Marcas/requisiciones/equipo_av/colaboradores/metas salieron en 0 (nunca se habian podido guardar bien en Firestore — marcas nunca tuvo regla de seguridad, bug que se resuelve solo con esta migracion).
7. **Bug de diseño encontrado y corregido a medio camino**: el schema original declaraba `FOREIGN KEY ... REFERENCES` — rompia el borrado de proyectos con entregables huerfanos ligados (comportamiento que la app depende de permitir) y ademas se descubrio que Turso via HTTP no mantiene `PRAGMA foreign_keys` entre llamadas. Se quitaron todas las FK reales del schema (se recreo desde cero, sin perdida de datos porque aun no se habia migrado nada real).
8. **Verificacion exhaustiva**: 4 scripts de smoke-test (`scripts/test-e2e-fase2/3/4.mjs`) cubriendo los ~40 endpoints/variantes con tokens de Firebase reales (via Admin SDK + Identity Toolkit), incluido un login simulado de un usuario real (superadmin) ya migrado — resolvio su perfil completo al instante.

## Bloqueos

Ninguno tecnico. Pendiente que el equipo use el sistema un dia completo en produccion sobre Turso antes de:
1. Agregar `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` a Preview en Vercel (quedo pendiente por una limitacion del CLI que pide rama especifica).
2. Decidir si borrar `firestore.rules` y los datos viejos de Firestore, o dejarlos como respaldo frio indefinidamente.

## Siguiente paso

1. Deploy a produccion (`git push`) y uso real por el equipo.
2. Confirmar que todo se ve y funciona igual que con Firestore (requisiciones, proyectos, entregables, notificaciones, Marcas — esta ultima por primera vez deberia funcionar de verdad).
3. Completar las 3 variables de `GOOGLE_DRIVE_OWNER_*` en Vercel (pendiente de la sesion anterior, sin relacion a esta migracion) para que las subidas de archivo terminen de funcionar.
4. Una vez confirmado el dia de uso real: decidir el destino final de Firestore (archivar o borrar).
