import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowLeft, Clapperboard, Loader2, ShieldCheck, Film, Users2 } from "lucide-react";
import { useAuth, type EstadoCorreo } from "@/context/AuthContext";
import { mensajeErrorAuth } from "@/lib/authErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BENEFICIOS = [
  { icon: Film, texto: "Requisiciones, proyectos y entregables en un solo lugar" },
  { icon: Users2, texto: "Visibilidad de equipo, cargas y calendario en tiempo real" },
  { icon: ShieldCheck, texto: "Acceso controlado por rol, solo cuentas corporativas" },
];

export function LoginPage() {
  const { usuario, esModoDemo, consultarEstado, login, activarCuenta } = useAuth();
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<EstadoCorreo | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const onContinuar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const resultado = await consultarEstado(correo);
      if (resultado === "sin_invitacion") {
        setError("Ese correo no tiene una invitacion activa. Pide a tu administrador que te invite.");
        return;
      }
      setEstado(resultado);
    } catch (e) {
      setError(mensajeErrorAuth(e));
    } finally {
      setEnviando(false);
    }
  };

  const onVolver = () => {
    setEstado(null);
    setPassword("");
    setError(null);
  };

  const onEnviarPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (estado === "activa") {
        await login(correo, password);
      } else {
        await activarCuenta(correo, password);
      }
    } catch (e) {
      setError(mensajeErrorAuth(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-app">
      {/* El panel de marca es oscuro en los dos temas, asi que NO puede colgar de
          `bg-text-primary` (que en oscuro se vuelve casi blanco y se comeria su texto blanco):
          va a hex fijo. */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#111827] p-12 text-white lg:flex dark:bg-[#0B0D11]">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #FFFFFF 0%, transparent 45%), radial-gradient(circle at 80% 70%, #FFFFFF 0%, transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white">
            <Clapperboard className="h-5 w-5 text-[#111827]" />
          </div>
          <span className="text-lg font-bold">AV CONTROL</span>
        </div>

        <div className="relative space-y-8">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Gestión audiovisual de Grupo Ortiz, ordenada de principio a fin.
          </h2>
          <ul className="space-y-4">
            {BENEFICIOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-white/80">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © 2026 Grupo Ortiz — Departamento Audiovisual
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <Card className="w-full max-w-sm border-border shadow-card">
          <CardContent className="pt-8">
            <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent">
                <Clapperboard className="h-6 w-6 text-accent-foreground" />
              </div>
              <h1 className="text-lg font-bold">AV CONTROL</h1>
            </div>

            <div className="mb-6 space-y-1 text-center lg:text-left">
              <h2 className="text-xl font-bold text-text-primary">Bienvenido de vuelta</h2>
              <p className="text-sm text-muted-foreground">
                {estado === null
                  ? "Ingresa con tu cuenta corporativa de Grupo Ortiz"
                  : estado === "activa"
                    ? "Escribe tu contraseña"
                    : "Crea tu contraseña para activar tu cuenta"}
              </p>
            </div>

            {esModoDemo && (
              <p className="mb-4 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                Modo demo: entra directo con el primer usuario demo. No hay base de datos configurada todavia.
              </p>
            )}

            {estado === null ? (
              <form onSubmit={onContinuar} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="correo">Correo</Label>
                  <Input
                    id="correo"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    placeholder="nombre@grupo-ortiz.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={enviando}>
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </form>
            ) : (
              <form onSubmit={onEnviarPassword} className="space-y-4">
                <button
                  type="button"
                  onClick={onVolver}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-text-primary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> {correo}
                </button>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{estado === "activa" ? "Contraseña" : "Nueva contraseña"}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoFocus
                    autoComplete={estado === "activa" ? "current-password" : "new-password"}
                    minLength={estado === "activa" ? undefined : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={enviando}>
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  {estado === "activa" ? "Iniciar sesion" : "Activar cuenta"}
                </Button>
              </form>
            )}

            {error && (
              <p className="mt-3 rounded-md bg-red-50 p-2 text-center text-xs text-destructive dark:bg-red-400/15">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acceso solo por invitación
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
