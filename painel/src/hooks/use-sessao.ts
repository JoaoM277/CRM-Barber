import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Barbearia, Me } from "@/lib/types"

/** Usuário logado + situação da assinatura + se é acesso de suporte. */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), staleTime: 60_000 })
}

/** A barbearia do usuário logado (nome, link, cores). */
export function useBarbearia() {
  return useQuery({
    queryKey: ["barbearia"],
    queryFn: async () => (await api<Barbearia[]>("/barbearias"))[0] ?? null,
    staleTime: 5 * 60_000,
  })
}

/** O plano atual libera o recurso? Sem assinatura registrada = liberado (contas antigas). */
export function useRecurso(recurso: "whatsapp" | "financeiro") {
  const { data: me } = useMe()
  const plano = me?.assinatura?.plano
  return !me?.assinatura || !!plano?.recursos.includes(recurso)
}
