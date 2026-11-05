import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BookOpen, FileDown, KeyRound, Loader2, Trash2 } from "lucide-react";
import {
  useActualizarGestorRequisiciones,
  useActualizarRolUsuario,
  useEliminarUsuario,
  useReiniciarPasswordUsuario,
  useUsuarios,
} from "@/hooks/useCatalogos";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS, puedeGestionarUsuarios } from "@/lib/roles";
import { vaciarTodaLaInfo } from "@/services/resetService";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoBadge } from "@/components/DemoBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { InvitarUsuarioDialog } from "@/components/configuracion/InvitarUsuarioDialog";
import { PASOS_GUIA, SLIDE_GUIA_H, SLIDE_GUIA_W, SlideCapsula, SlidePortada } from "@/components/configuracion/GuiaProduccionDoc";
import { descargarMultiplesNodosComoPdf } from "@/lib/pdf";
import { formatFecha } from "@/lib/utils";
import type { GestorRequisicionesPermisos } from "@/types";

/** Vista previa a escala de UNA diapositiva (tamaño fijo) dentro de la tarjeta — mismo truco que
 * VistaPreviaEscalada.tsx (reportes), pero generico en ancho/alto para reusarlo con miniaturas
 * chicas (varias diapositivas en fila) en vez de una sola vista previa grande. */
function VistaPreviaDoc({ ancho, alto, children }: { ancho: number; alto: number; children: React.ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setEscala(Math.min(1, entrada.contentRect.width / ancho)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ancho]);

  return (
    <div ref={contenedor} className="w-full overflow-hidden rounded-lg border border-border" style={{ height: alto * escala }}>
      <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: ancho }}>{children}</div>
    </div>
  );
}

const PERMISO_LABELS: Record<keyof Omit<GestorRequisicionesPermisos, "activo">, string> = {
  crearEnNombreDeTerceros: "Crear requisiciones en nombre de terceros",
  editarDespuesDeEnviar: "Editar requisiciones despues de enviarlas",
  adjuntarArchivos: "Adjuntar archivos",
  verRequisicionesDeOtros: "Ver requisiciones creadas por otros usuarios",
  verInfoSolicitante: "Ver informacion del solicitante",
  verInfoProyectoVinculado: "Ver informacion del proyecto vinculado",
  verFechasYEstadosProduccion: "Ver fechas y estados de produccion",
  notificacionesCorreo: "Recibir notificaciones por correo",
  notificacionesSistema: "Recibir notificaciones dentro del sistema",
};

/**
 * Honestidad en la configuracion: estos dos permisos se guardan, pero todavia no hay nada en
 * la app que los aplique porque la funcionalidad que gobiernan no existe. Sin esta nota, el
 * lider cree que esta apagando algo y no pasa nada.
 */
const PERMISO_SIN_FUNCIONALIDAD: Partial<Record<keyof typeof PERMISO_LABELS, string>> = {
  adjuntarArchivos: "Aun no hay forma de adjuntar archivos a una requisicion en la app.",
  notificacionesCorreo: "Aun no hay envio de correo (requiere Cloud Functions, ver SECURITY.md).",
};

export function ConfiguracionPage() {
  const { usuario: usuarioActual } = useAuth();
  const { data: usuarios = [] } = useUsuarios();
  const gestor = usuarios.find((u) => u.gestorRequisiciones?.activo);
  const [permisos, setPermisos] = useState<GestorRequisicionesPermisos | undefined>();
  const actualizarGestor = useActualizarGestorRequisiciones();
  const actualizarRol = useActualizarRolUsuario();
  const reiniciarPassword = useReiniciarPasswordUsuario();
  const eliminarUsuario = useEliminarUsuario();
  const [usuarioAReiniciar, setUsuarioAReiniciar] = useState<{ id: string; nombre: string } | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [reseteando, setReseteando] = useState(false);
  const [errorReset, setErrorReset] = useState<string | null>(null);
  // Un ref por diapositiva (portada + un paso por cada capsula) — se llenan con callback refs
  // en el render (cantidad fija, no hace falta un hook por cada una).
  const slidesRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [descargandoGuia, setDescargandoGuia] = useState(false);
  const [errorGuia, setErrorGuia] = useState<string | null>(null);
  // El MD de tono vive en public/ de este mismo sitio — se arma el link absoluto con el origen
  // actual (funciona igual en produccion, preview o si el dominio cambia algun dia).
  const urlMd = `${window.location.origin}/Prompt_Maestro_Guiones_Grupo_Ortiz.md`;

  const onDescargarGuia = async () => {
    const nodos = slidesRefs.current.filter((n): n is HTMLDivElement => n !== null);
    if (nodos.length === 0) return;
    setDescargandoGuia(true);
    setErrorGuia(null);
    try {
      await descargarMultiplesNodosComoPdf(
        nodos,
        "guia-proceso-produccion-capsulas.pdf",
        "#FFFFFF",
        SLIDE_GUIA_W,
        SLIDE_GUIA_H,
        "landscape",
        3 // maxima calidad pedida — pixelRatio 3 en vez del 2 normal de Reportes
      );
    } catch (e) {
      setErrorGuia(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setDescargandoGuia(false);
    }
  };

  const onVaciarTodo = async () => {
    setReseteando(true);
    setErrorReset(null);
    try {
      await vaciarTodaLaInfo();
      setConfirmarReset(false);
      window.location.reload();
    } catch (e) {
      setErrorReset(e instanceof Error ? e.message : "No se pudo vaciar la informacion.");
    } finally {
      setReseteando(false);
    }
  };

  // usuarios llega de forma asincrona (Firestore/demo) — sincronizar cuando este disponible.
  useEffect(() => {
    if (gestor?.gestorRequisiciones) setPermisos(gestor.gestorRequisiciones);
  }, [gestor]);

  const guardarPermisos = () => {
    if (!gestor || !permisos) return;
    actualizarGestor.mutate({ id: gestor.id, gestorRequisiciones: permisos });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configuracion" description="Usuarios, roles y permisos del sistema.">
        <DemoBadge />
        <InvitarUsuarioDialog />
      </PageHeader>

      <Card className="border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground">
          La autorizacion real vive en el servidor (api/_shared/authz.ts) — ver SECURITY.md. Esta vista
          administra invitaciones y el permiso de gestor de requisiciones.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Roles asignados dentro del departamento.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Gestor de requisiciones</TableHead>
                {puedeGestionarUsuarios(usuarioActual) && <TableHead className="text-right">Acceso</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{u.correo}</TableCell>
                  <TableCell>
                    {u.id === usuarioActual?.id || usuarioActual?.rol !== "superadmin" ? (
                      <Badge variant="outline">{ROLE_LABELS[u.rol]}</Badge>
                    ) : (
                      <Select
                        value={u.rol}
                        onValueChange={(value) =>
                          actualizarRol.mutate({ id: u.id, rol: value as typeof u.rol })
                        }
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.puesto ?? "—"}</TableCell>
                  <TableCell>
                    {u.gestorRequisiciones?.activo ? (
                      <Badge variant="accent">Activo</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  {puedeGestionarUsuarios(usuarioActual) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          title="Reiniciar contraseña — la persona crea una nueva al entrar"
                          onClick={() => setUsuarioAReiniciar({ id: u.id, nombre: u.nombre })}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reiniciar contraseña
                        </Button>
                        {u.id !== usuarioActual?.id && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10"
                            title="Eliminar usuario"
                            onClick={() => setUsuarioAEliminar({ id: u.id, nombre: u.nombre })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {gestor && permisos && (
        <Card>
          <CardHeader>
            <CardTitle>Permisos de {gestor.nombre} (gestor de requisiciones)</CardTitle>
            <CardDescription>
              Configurable solo por el Lider Audiovisual. Ver reglas de negocio en SECURITY.md.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(Object.keys(PERMISO_LABELS) as Array<keyof typeof PERMISO_LABELS>).map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={permisos[key]}
                  onChange={(e) => setPermisos({ ...permisos, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span>
                  {PERMISO_LABELS[key]}
                  {PERMISO_SIN_FUNCIONALIDAD[key] && (
                    <span className="block text-xs text-muted-foreground">
                      {PERMISO_SIN_FUNCIONALIDAD[key]}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={guardarPermisos} disabled={actualizarGestor.isPending}>
              {actualizarGestor.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {usuarioActual?.rol === "superadmin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Guía del proceso de producción (cápsulas)
            </CardTitle>
            <CardDescription>
              Presentación de referencia para quien se incorpora al equipo: una diapositiva por paso
              (guion y tono, aprobación, voz y música, montaje/subtítulos, cierre/entrega). Exportable
              en PDF horizontal, máxima calidad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1">
              <div className="shrink-0" style={{ width: 220 }}>
                <VistaPreviaDoc ancho={SLIDE_GUIA_W} alto={SLIDE_GUIA_H}>
                  <SlidePortada
                    ref={(el) => {
                      slidesRefs.current[0] = el;
                    }}
                    generado={formatFecha(new Date().toISOString())}
                  />
                </VistaPreviaDoc>
              </div>
              {PASOS_GUIA.map((paso, i) => (
                <div key={paso.numero} className="shrink-0" style={{ width: 220 }}>
                  <VistaPreviaDoc ancho={SLIDE_GUIA_W} alto={SLIDE_GUIA_H}>
                    <SlideCapsula
                      ref={(el) => {
                        slidesRefs.current[i + 1] = el;
                      }}
                      paso={paso}
                      generado={formatFecha(new Date().toISOString())}
                      urlMd={urlMd}
                    />
                  </VistaPreviaDoc>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2">
            <Button onClick={onDescargarGuia} disabled={descargandoGuia}>
              {descargandoGuia ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {descargandoGuia ? "Generando..." : "Descargar PDF"}
            </Button>
            {errorGuia && <p className="text-xs text-destructive">{errorGuia}</p>}
          </CardFooter>
        </Card>
      )}

      {usuarioActual?.rol === "superadmin" && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Zona de peligro
            </CardTitle>
            <CardDescription>
              Borra requisiciones, proyectos, entregables, guiones, salidas, notificaciones, equipo
              AV, colaboradores e invitaciones — deja la app como recien instalada. No toca la
              lista de usuarios/cuentas (para que nadie, incluido tu, se quede sin acceso).
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="text-destructive hover:bg-red-50 dark:hover:bg-red-400/10" onClick={() => setConfirmarReset(true)}>
              Vaciar toda la info de la app
            </Button>
          </CardFooter>
        </Card>
      )}

      <ConfirmDialog
        open={confirmarReset}
        onOpenChange={(v) => {
          setConfirmarReset(v);
          if (!v) setErrorReset(null);
        }}
        title="¿Vaciar toda la informacion de la app?"
        description={
          <>
            <p>
              Esto borra para siempre requisiciones, proyectos, entregables, guiones, salidas,
              notificaciones, equipo AV, colaboradores e invitaciones. No se puede deshacer.
            </p>
            {errorReset && <p className="mt-2 font-medium text-destructive">{errorReset}</p>}
          </>
        }
        confirmLabel={reseteando ? "Borrando..." : "Borrar todo"}
        destructive
        confirmarTexto="BORRAR TODO"
        onConfirm={onVaciarTodo}
      />

      <ConfirmDialog
        open={Boolean(usuarioAReiniciar)}
        onOpenChange={(v) => {
          if (!v) setUsuarioAReiniciar(null);
        }}
        title={`¿Reiniciar la contraseña de ${usuarioAReiniciar?.nombre}?`}
        description="La cuenta vuelve a quedar como una invitacion pendiente: la proxima vez que entre a login con su correo, el sistema le pedira crear una contraseña nueva. No pierde su rol ni su historial."
        confirmLabel={reiniciarPassword.isPending ? "Reiniciando..." : "Reiniciar contraseña"}
        onConfirm={async () => {
          if (!usuarioAReiniciar) return;
          await reiniciarPassword.mutateAsync(usuarioAReiniciar.id);
          setUsuarioAReiniciar(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(usuarioAEliminar)}
        onOpenChange={(v) => {
          if (!v) setUsuarioAEliminar(null);
        }}
        title={`¿Eliminar a ${usuarioAEliminar?.nombre}?`}
        description="Se borra su cuenta y pierde acceso al sistema de inmediato. Sus requisiciones, proyectos y entregables ya asignados no se borran. No se puede deshacer."
        confirmLabel={eliminarUsuario.isPending ? "Eliminando..." : "Eliminar usuario"}
        destructive
        onConfirm={async () => {
          if (!usuarioAEliminar) return;
          await eliminarUsuario.mutateAsync(usuarioAEliminar.id);
          setUsuarioAEliminar(null);
        }}
      />
    </div>
  );
}
