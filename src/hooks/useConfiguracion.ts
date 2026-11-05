import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/services/configuracionService";

export function useConfiguracion() {
  return useQuery({ queryKey: ["configuracion"], queryFn: obtenerConfiguracion });
}

export function useActualizarConfiguracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: string }) => actualizarConfiguracion(clave, valor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configuracion"] }),
  });
}
