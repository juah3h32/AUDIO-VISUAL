import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  FolderKanban,
  Calendar,
  Users,
  PackageCheck,
  BarChart3,
  FolderOpen,
  FileBarChart,
  Settings,
  Camera,
  TrendingUp,
  Network,
  Palette,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { puedeVerRuta } from "@/lib/roles";

/** Mismo orden de prioridad para todos los roles — se filtra por `puedeVerRuta` y se toman los
 * primeros 4 visibles, asi que el resultado SI varia por rol (ver comentario en el plan: un
 * colaborador ve Inicio/Entregables/Calendario/Salidas, un lider ve Inicio/Entregables/
 * Requisiciones/Calendario, etc.) sin mantener una lista aparte por rol. Mismos iconos que
 * `Sidebar.tsx` para que se reconozcan igual al abrir "Más". */
const RUTAS_PRIORIDAD = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/entregables", label: "Entregables", icon: PackageCheck },
  { to: "/requisiciones", label: "Solicitudes", icon: FileText },
  { to: "/calendario", label: "Calendario", icon: Calendar },
  { to: "/salidas", label: "Salidas", icon: Camera },
  { to: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { to: "/equipo", label: "Equipo", icon: Users },
  { to: "/marcas", label: "Marcas", icon: Palette },
  { to: "/archivos", label: "Archivos", icon: FolderOpen },
  { to: "/estructura", label: "Estructura", icon: Network },
  { to: "/rendimiento", label: "Rendimiento", icon: TrendingUp },
  { to: "/reportes", label: "Reportes", icon: FileBarChart },
  { to: "/metricas", label: "Métricas", icon: BarChart3 },
  { to: "/configuracion", label: "Ajustes", icon: Settings },
];

const CANTIDAD_FIJA = 4;

/**
 * Barra de navegacion fija abajo, SOLO en movil (`lg:hidden` — en escritorio sigue el `<aside>`
 * de `Sidebar.tsx`) — reemplaza al boton de hamburguesa de `Header.tsx` como unica forma de
 * navegar en pantallas chicas, estilo app nativa (icono + etiqueta, pestaña activa resaltada).
 * El 5to espacio ("Más") abre el MISMO cajon de Radix que ya existia — nada se duplica, solo
 * cambia quien lo dispara.
 */
export function BottomNav({ onAbrirMas }: { onAbrirMas: () => void }) {
  const { usuario } = useAuth();
  const location = useLocation();

  const visibles = RUTAS_PRIORIDAD.filter((r) => puedeVerRuta(usuario, r.to));
  const fijas = visibles.slice(0, CANTIDAD_FIJA);
  // "Más" se resalta cuando la pagina actual vive fuera de las 4 fijas (ej. Métricas) — asi no
  // se siente "perdido" al navegar a algo que solo esta dentro del cajon completo.
  const enOverflow = !fijas.some((r) => (r.end ? location.pathname === r.to : location.pathname.startsWith(r.to)));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navegación principal"
    >
      {fijas.map((r) => (
        <NavLink
          key={r.to}
          to={r.to}
          end={r.end}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground",
              isActive && "text-accent-dato"
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className={cn("flex h-8 w-11 items-center justify-center rounded-full", isActive && "bg-accent-dato/15")}>
                <r.icon className="h-5 w-5" />
              </span>
              <span className="truncate">{r.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onAbrirMas}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground",
          enOverflow && "text-accent-dato"
        )}
      >
        <span className={cn("flex h-8 w-11 items-center justify-center rounded-full", enOverflow && "bg-accent-dato/15")}>
          <MoreHorizontal className="h-5 w-5" />
        </span>
        <span className="truncate">Más</span>
      </button>
    </nav>
  );
}
