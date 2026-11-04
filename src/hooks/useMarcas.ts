import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarMarca, crearMarca, eliminarMarca, listarMarcas } from "@/services/marcasService";
import type { Marca } from "@/types";

export function useMarcas() {
  return useQuery({ queryKey: ["marcas"], queryFn: listarMarcas });
}

export function useCrearMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Marca, "id" | "creadoEn" | "actualizadoEn">) => crearMarca(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marcas"] }),
  });
}

export function useActualizarMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<Marca> }) => actualizarMarca(id, cambios),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marcas"] }),
  });
}

export function useEliminarMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarMarca(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marcas"] }),
  });
}
