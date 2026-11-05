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
