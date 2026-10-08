import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Expediente, Produto, Profissional, Servico } from "@/lib/types"

/** Produtos (todos ou só os à venda). Só busca se o plano tem o recurso. */
export const useProdutos = (soAtivos = false, habilitado = true) =>
  useQuery({
    queryKey: ["produtos", soAtivos],
    queryFn: () => api<Produto[]>(`/produtos${soAtivos ? "?ativos=1" : ""}`),
    staleTime: 60_000,
    enabled: habilitado,
  })

export const useProfissionais = () =>
  useQuery({ queryKey: ["profissionais"], queryFn: () => api<Profissional[]>("/profissionais"), staleTime: 60_000 })

export const useServicos = () =>
  useQuery({ queryKey: ["servicos"], queryFn: () => api<Servico[]>("/servicos"), staleTime: 60_000 })

export const useExpediente = () =>
  useQuery({ queryKey: ["expediente"], queryFn: () => api<Expediente[]>("/tempo_de_operacao"), staleTime: 5 * 60_000 })
