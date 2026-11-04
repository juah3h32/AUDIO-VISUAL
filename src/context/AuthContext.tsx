import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/apiClient";
import { esModoDemo } from "@/lib/modoDemo";
import { DEMO_USUARIOS } from "@/data/demoData";
import type { Usuario } from "@/types";

/** Cada cuanto se vuelve a pedir el perfil mientras hay sesion activa — reemplaza el listener en
 * vivo que tenia Firestore sobre el rol. Si un admin cambia el rol/permisos de alguien, tarda
 * hasta este tiempo en reflejarse (o al instante si la pestaña recupera el foco). */
const POLL_PERFIL_MS = 60_000;

export type EstadoCorreo = "activa" | "pendiente" | "sin_invitacion";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  esModoDemo: boolean;
  /** Primer paso del login: dado un correo, dice que formulario mostrar despues. */
  consultarEstado: (correo: string) => Promise<EstadoCorreo>;
  /** Login normal — cuenta ya tiene contraseña. */
  login: (correo: string, password: string) => Promise<void>;
  /** Primera vez — invitado nuevo, o cuenta real sin password todavia (migracion vieja). */
  activarCuenta: (correo: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Solo disponible en modo demo — cambia el usuario activo para previsualizar roles. */
  cambiarUsuarioDemo: (usuarioId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_SESSION_KEY = "av-control:demo-usuario-id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const sesionActivaRef = useRef(false);

  useEffect(() => {
    if (esModoDemo) {
      const storedId = localStorage.getItem(DEMO_SESSION_KEY);
      const demoUser = DEMO_USUARIOS.find((u) => u.id === storedId) ?? DEMO_USUARIOS[0];
      setUsuario(demoUser);
      setCargando(false);
      return;
    }

    let intervalo: ReturnType<typeof setInterval> | null = null;

    const refrescarPerfil = async (silencioso: boolean) => {
      try {
        const fresco = await apiFetch<Usuario>("/api/auth/me");
        setUsuario(fresco);
        sesionActivaRef.current = true;
        if (!intervalo) intervalo = setInterval(() => refrescarPerfil(true), POLL_PERFIL_MS);
      } catch {
        if (!silencioso) {
          setUsuario(null);
          sesionActivaRef.current = false;
        }
        // En un poll silencioso, un fallo transitorio de red no debe desloguear a nadie — el
        // siguiente tick o el proximo foco de ventana lo reintenta solo.
      } finally {
        setCargando(false);
      }
    };

    refrescarPerfil(false);

    const alRecuperarFoco = () => {
      if (sesionActivaRef.current) refrescarPerfil(true);
    };
    window.addEventListener("focus", alRecuperarFoco);

    return () => {
      if (intervalo) clearInterval(intervalo);
      window.removeEventListener("focus", alRecuperarFoco);
    };
  }, []);

  const consultarEstado = async (correo: string): Promise<EstadoCorreo> => {
    const { estado } = await apiFetch<{ estado: EstadoCorreo }>("/api/auth/estado", {
      method: "POST",
      body: JSON.stringify({ correo }),
    });
    return estado;
  };

  const login = async (correo: string, password: string) => {
    const perfil = await apiFetch<Usuario>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ correo, password }),
    });
    setUsuario(perfil);
    sesionActivaRef.current = true;
  };

  const activarCuenta = async (correo: string, password: string) => {
    const perfil = await apiFetch<Usuario>("/api/auth/activar", {
      method: "POST",
      body: JSON.stringify({ correo, password }),
    });
    setUsuario(perfil);
    sesionActivaRef.current = true;
  };

  const logout = async () => {
    sesionActivaRef.current = false;
    if (esModoDemo) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUsuario(null);
      return;
    }
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Recarga limpia: en una compu compartida, borra cualquier estado de React/cache de
    // react-query que hubiera quedado del usuario anterior.
    window.location.reload();
  };

  const cambiarUsuarioDemo = (usuarioId: string) => {
    const demoUser = DEMO_USUARIOS.find((u) => u.id === usuarioId);
    if (!demoUser) return;
    localStorage.setItem(DEMO_SESSION_KEY, demoUser.id);
    setUsuario(demoUser);
  };

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      esModoDemo,
      consultarEstado,
      login,
      activarCuenta,
      logout,
      cambiarUsuarioDemo,
    }),
    [usuario, cargando]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
