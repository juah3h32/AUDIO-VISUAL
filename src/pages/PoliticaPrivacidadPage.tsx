import { Link } from "react-router-dom";
import { Clapperboard } from "lucide-react";

const ACTUALIZADO = "3 de noviembre de 2026";

export function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-bg-app px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Clapperboard className="h-4 w-4" />
          </span>
          AV Control — Grupo Ortiz
        </Link>

        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Politica de privacidad</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ultima actualizacion: {ACTUALIZADO}</p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-text-primary">
            <section className="space-y-2">
              <h2 className="text-base font-semibold">1. Que es AV Control</h2>
              <p>
                AV Control es una aplicacion interna de uso privado del departamento Audiovisual de
                Grupo Ortiz, usada para administrar requisiciones, proyectos, entregables (videos y
                disenos), grabaciones y reportes del equipo. El acceso es exclusivamente por
                invitacion, con cuentas corporativas de Grupo Ortiz; no es una app publica ni
                recolecta datos de personas fuera de la organizacion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">2. Que informacion recolectamos</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium">Datos de tu cuenta</span>: nombre, correo y
                  contraseña (guardada siempre cifrada, nunca en texto plano) para identificarte y
                  darte acceso segun tu rol.
                </li>
                <li>
                  <span className="font-medium">Contenido que tu mismo cargas</span>: nombre de
                  requisiciones/proyectos/entregables, comentarios, fechas, y los archivos de
                  video/diseno que subes para revision.
                </li>
                <li>
                  <span className="font-medium">Metadatos de uso</span>: quien creo o aprobo cada
                  registro y cuando, para llevar control interno del flujo de trabajo.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">3. Como accedes y como se suben los archivos</h2>
              <p>
                El acceso es solo por invitacion: un administrador te da de alta con tu correo
                corporativo y tu creas tu propia contraseña la primera vez que entras. AV Control no
                pide permisos sobre tu cuenta personal de Google — los videos y disenos que subes se
                guardan en una cuenta de Google Drive propia del departamento (no en la tuya), y el
                boton "Agregar a mi Google Calendar" solo abre un evento pre-llenado para que tu
                mismo decidas si lo guardas en tu calendario; no se conecta ni se le da acceso a nada
                de tu cuenta para eso.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">4. Donde se guarda la informacion</h2>
              <p>
                Los datos de la operacion (requisiciones, proyectos, entregables, comentarios,
                usuarios) se guardan en una base de datos propia del sistema (Turso). Los archivos
                de video y diseno se guardan en la cuenta de Google Drive central del departamento —
                AV Control no mantiene una copia adicional del archivo.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">5. Con quien compartimos informacion</h2>
              <p>
                No vendemos ni compartimos tu informacion con terceros ajenos a Grupo Ortiz. Dentro
                de la app, cada registro es visible solo para los roles correspondientes (ej. tu
                lider, el equipo de aprobacion), segun el nivel de acceso de tu cuenta.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">6. Cuanto tiempo se conserva</h2>
              <p>
                La informacion se conserva mientras el proyecto/entregable siga activo en el
                departamento, o hasta que un administrador la elimine. Puedes pedir la eliminacion de
                tu cuenta o de datos especificos escribiendo al correo de contacto abajo.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold">7. Contacto</h2>
              <p>
                Dudas sobre esta politica o sobre tus datos:{" "}
                <a href="mailto:juan.corona@grupo-ortiz.com" className="font-medium text-accent underline">
                  juan.corona@grupo-ortiz.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
