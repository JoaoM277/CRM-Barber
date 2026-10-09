import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Agendamento, Paginado, StatusAgendamento } from "@/lib/types"

/** Agendamentos de um dia (data) ou de um período (inicio..fim), em YYYY-MM-DD. */
export function useAgendamentos(filtro: { data: string } | { inicio: string; fim: string }) {
  const qs = new URLSearchParams({ ...filtro, per_page: "500" }).toString()
  return useQuery({
    queryKey: ["agendamentos", filtro],
    queryFn: () => api<Paginado<Agendamento>>(`/agendamentos?${qs}`).then((r) => r.data),
  })
}

/** Invalida tudo que depende da agenda (indicadores, financeiro, guia). */
function useRecarregarAgenda() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["agendamentos"] })
    qc.invalidateQueries({ queryKey: ["lista-espera"] })
    qc.invalidateQueries({ queryKey: ["pendencias"] })
    qc.invalidateQueries({ queryKey: ["faturamento"] })
    qc.invalidateQueries({ queryKey: ["onboarding"] })
  }
}

const MSG_STATUS: Record<StatusAgendamento, string> = {
  confirmado: "Agendamento confirmado.",
  concluido: "Atendimento concluído.",
  cancelado: "Agendamento cancelado.",
  pendente: "Agendamento reaberto.",
  falta: "Registrado como falta.",
}

export function useMudarStatus() {
  const recarregar = useRecarregarAgenda()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusAgendamento }) =>
      api(`/agendamentos/${id}`, { method: "PUT", body: { status } }),
    onSuccess: (_r, v) => {
      recarregar()
      toast.success(MSG_STATUS[v.status])
    },
    onError: (e) => toast.error(e.message),
  })
}

export type Remarcacao = { id: number; dataAgendamento?: string; horario?: string; barbeiroId?: number; observacoes?: string | null }

export function useRemarcar() {
  const recarregar = useRecarregarAgenda()
  return useMutation({
    mutationFn: ({ id, ...body }: Remarcacao) => api(`/agendamentos/${id}`, { method: "PUT", body }),
    onSuccess: (_r, v) => {
      recarregar()
      toast.success(v.observacoes !== undefined && !v.horario && !v.dataAgendamento && !v.barbeiroId ? "Observação salva." : "Agendamento remarcado.")
    },
    onError: (e) => {
      recarregar() // desfaz a posição "arrastada" na tela
      toast.error(e.message)
    },
  })
}

export type NovoAgendamento = {
  clienteNome: string
  clienteTelefone: string
  barbeiroId: number
  servicosIds: number[]
  dataAgendamento: string
  horario: string
  observacoes?: string
}

export function useNovoAgendamento() {
  const recarregar = useRecarregarAgenda()
  return useMutation({
    mutationFn: (body: NovoAgendamento) => api("/agendamentos", { method: "POST", body }),
    onSuccess: () => {
      recarregar()
      toast.success("Agendamento marcado.")
    },
  })
}
