import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Expediente, Profissional, Servico } from "@/lib/types"

export const useProfissionais = () =>
  useQuery({ queryKey: ["profissionais"], queryFn: () => api<Profissional[]>("/profissionais"), staleTime: 60_000 })

export const useServicos = () =>
  useQuery({ queryKey: ["servicos"], queryFn: () => api<Servico[]>("/servicos"), staleTime: 60_000 })

export const useExpediente = () =>
  useQuery({ queryKey: ["expediente"], queryFn: () => api<Expediente[]>("/tempo_de_operacao"), staleTime: 5 * 60_000 })
