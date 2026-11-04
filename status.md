# AV CONTROL — Status

> Actualizado: 2026-11-03

## Fase actual

Fase 8 — Produccion. App en uso real por el equipo (datos reales desde octubre), desplegada en Vercel (`control-go.vercel.app`). Hoy se cerro una ronda de auditoria + feature nueva + infraestructura rota que nunca se habia terminado de configurar.

## % MVP

Ver `MVP_BREAKDOWN.md`. Modulos base completos; hoy se agrego "Marcas" (manuales de identidad).

## Semaforo

Amarillo → verde en progreso. La app funciona, pero hoy se destaparon 2 huecos de infraestructura que llevaban tiempo invisibles (ver "Bugs corregidos hoy"). Falta que el usuario termine de copiar las credenciales de Drive de la cuenta vieja.

## Que se hizo hoy (2026-11-03)

### Feature nueva: Marcas
- `src/types/index.ts`: tipos `Marca`/`AssetMarca`, campo opcional `marcaId` en `Proyecto`/`Entregable`.
- `src/services/marcasService.ts` + `src/hooks/useMarcas.ts`: CRUD completo, mismo patron que `proyectosService.ts`.
- `src/pages/MarcasPage.tsx` + `src/components/marcas/NuevaMarcaDialog.tsx`: logos, paleta de colores (swatch copiable), manual PDF — sube todo a Drive via `subirArchivoCentralizado`.
- Selector de marca agregado a "Nuevo proyecto".
- Ruta `/marcas` en sidebar y `lib/roles.ts` (visible a cualquier rol autenticado; crear/editar restringido a quien ya puede crear proyectos).

### Auditoria de bugs + consistencia visual
- `LoadingState`/`ErrorState` (`src/components/ui/`) cableados en las 8 paginas que listan datos — antes un error de Firestore se tragaba en silencio y la pantalla quedaba vacia sin avisar.
- `PageHeader` (`src/components/layout/`) reemplaza el header duplicado a mano en las 13 paginas.
- Color de marca `#C1EB1F` tokenizado como `accent-dato` (`tailwind.config.ts` + `index.css`) — antes hardcodeado en 8 archivos distintos.
- Credencial de Firebase Admin (`av-control-grupo-ortiz-*.json`) movida fuera del repo a `~/.secrets/av-control/` (seguia el patron del `.gitignore` pero vivia sin cifrar en disco).

### Infraestructura rota — descubierta al revisar los bugs anteriores
1. **Firestore con las reglas nunca desplegadas**: `firestore.rules` tenia la nota "borrador, validar antes de produccion" desde siempre. Nunca se habia corrido `firebase deploy --only firestore:rules` — Firestore estaba con las reglas de bloqueo total por defecto. Causaba el "Inicio en blanco"/"no se pudo cargar el panel". **Corregido**: reglas desplegadas al proyecto real.
2. **Proyecto Vercel `control-go` incompleto**: es un proyecto nuevo (se creo esta semana para reemplazar el deploy viejo en otra cuenta) que solo tenia las 6 variables de Firebase, y SOLO en Production. Le faltaban:
   - Framework mal detectado como Astro (`vercel.json` no tenia `"framework": "vite"` explicito) → `vercel dev` fallaba con `astro: command not found`. **Corregido**.
   - Las 6 variables de Firebase no existian en Development → `vercel dev` no arrancaba. **Corregido**, agregadas a Development.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`_PRIVATE_KEY` no existian en ningun ambiente → causaba el error "Failed to execute json" al subir cualquier archivo (logos de Marcas incluidos). **Corregido**, agregadas a Production + Development (Preview quedo pendiente, el CLI de Vercel pide una rama especifica y no lo acepto en automatico).
   - `GOOGLE_DRIVE_OWNER_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN` (credenciales OAuth de Drive de `pablocorona111@gmail.com`) **siguen faltando** — viven solo en el proyecto Vercel viejo (otra cuenta). **Pendiente**: usuario las va a copiar el mismo.

## Bloqueos

1. Sin las 3 variables de `GOOGLE_DRIVE_OWNER_*`, **ninguna subida de archivo funciona** (videos, fotos, logos, manuales PDF) — ni en local ni en produccion. El usuario tiene acceso al proyecto Vercel viejo para copiarlas.
2. Las mismas 3 variables no se agregaron a Preview (limitacion del CLI de Vercel, pide `--value` + rama especifica). No urgente — Production y Development ya cubren uso real y desarrollo local.

## Siguiente paso

1. Usuario copia `GOOGLE_DRIVE_OWNER_CLIENT_ID/_CLIENT_SECRET/_REFRESH_TOKEN` del proyecto Vercel viejo a `control-go` (Production + Development).
2. Probar subida completa de un logo en Marcas con `vercel dev` corriendo.
3. Deploy a produccion (`git push` → Vercel auto-deploy) una vez confirmado en local.
4. Agregar las 3 variables de Drive tambien a Preview cuando se tenga tiempo (no bloquea nada hoy).
