import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export type ResumoPendencias = {
  nao_registrados: number
  por_dia: { data: string; total: number }[]
  dias: number
  faltas_para_revisar: number
}

/** Atendimentos de dias anteriores sem registro + faltas automáticas a revisar (aviso e menu). */
export const useResumoPendencias = () =>
  useQuery({
    queryKey: ["pendencias", "resumo"],
    queryFn: () => api<ResumoPendencias>("/pendencias/resumo"),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
