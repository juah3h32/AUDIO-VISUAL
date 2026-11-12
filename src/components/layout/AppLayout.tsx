import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { TopLoadingBar } from "./TopLoadingBar";
import { CargandoPagina } from "@/components/CargandoPagina";

export function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex h-screen bg-bg-app">
      <TopLoadingBar />
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        {/* Slot para el banner de Inicio ("Hola, Juan") — fuera de <main>, asi NO vive dentro
            del contenedor que hace scroll. Antes era `sticky` ADENTRO de main y, en scroll
            rapido con las graficas pesadas de Inicio repintando a la vez, se alcanzaba a ver un
            frame del contenido de abajo colandose detras (bug de compositing que ni isolate, ni
            will-change, ni translateZ(0)/contain-paint lograron eliminar del todo). Como fila
            fija normal de la columna (como el Header), nunca se superpone con nada que
            scrollee — no hay "detras" donde algo se pueda asomar. DashboardPage.tsx hace un
            portal aqui con ReactDOM.createPortal. */}
        <div id="banner-inicio-slot" />
        {/* pb extra en movil (donde vive BottomNav, fija abajo) para que el ultimo elemento de la
            pagina no quede tapado detras de la barra — altura de la barra (~4.5rem con su icono +
            etiqueta) SUMADA a su propio safe-area-inset-bottom. En `lg:` la barra no existe
            (Sidebar vuelve a ser un <aside> normal), asi que ahi vuelve al padding de siempre. */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6">
          {/* Suspense aqui (no solo en App) para que sidebar/header no desaparezcan al cambiar de pagina. */}
          <Suspense fallback={<CargandoPagina />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav onAbrirMas={() => setMenuAbierto(true)} />
    </div>
  );
}
