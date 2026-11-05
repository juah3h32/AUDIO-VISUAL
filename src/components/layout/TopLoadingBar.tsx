import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Barra delgada arriba de todo (como YouTube/GitHub) que corre cada vez que cambias de seccion —
 * sube "sola" en etapas y nunca llega a 100% hasta que la pagina nueva ya esta montada, para que
 * no se sienta como una barra falsa que siempre dice "listo" de inmediato.
 */
export function TopLoadingBar() {
  const location = useLocation();
  const [progreso, setProgreso] = useState(0);
  const [visible, setVisible] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    setVisible(true);
    setProgreso(15);
    timeoutsRef.current.push(setTimeout(() => setProgreso(55), 120));
    timeoutsRef.current.push(setTimeout(() => setProgreso(80), 320));
    // El contenido de la pagina nueva ya monto para cuando este efecto corre otra vez (cambio de
    // ruta) o en el siguiente frame — se completa y se desvanece.
    const cerrar = setTimeout(() => {
      setProgreso(100);
      timeoutsRef.current.push(setTimeout(() => setVisible(false), 250));
    }, 450);
    timeoutsRef.current.push(cerrar);

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent">
      <div
        className="h-full bg-accent-dato shadow-[0_0_8px_rgb(var(--av-accent-dato)/0.8)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progreso}%`, opacity: progreso === 100 ? 0 : 1 }}
      />
    </div>
  );
}
