import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { CalendarPlus, Check, CheckCheck, Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OnboardingCard } from "@/components/onboarding-card"
import { StatusAgendamentoBadge } from "@/components/status-agendamento"
import { useAgendamentos, useMudarStatus } from "@/hooks/use-agenda"
import { useMe, useRecurso } from "@/hooks/use-sessao"
import { api } from "@/lib/api"
import { hojeISO, moeda } from "@/lib/format"
import type { Agendamento, ResumoFaturamento } from "@/lib/types"

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}

function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular">{valor}</p>
        {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  )
}

export function AgendaDoDia({ itens }: { itens: Agendamento[] }) {
  const mudar = useMudarStatus()

  if (!itens.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <CalendarPlus className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Nenhum agendamento para hoje</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Divulgue o seu link de agendamento no Instagram e no WhatsApp: os horários marcados aparecem aqui na hora.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {itens.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
          <time className="w-14 shrink-0 font-mono text-[15px] font-semibold tabular">{a.start_time}</time>
          <div className="min-w-0 flex-1 basis-48">
            <p className={a.status === "cancelado" ? "font-medium text-muted-foreground line-through" : "font-medium"}>
              {a.cliente_nome ?? "Cliente"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {a.servicos_nomes || "—"}
              {a.worker && ` · ${a.worker.name}`}
            </p>
          </div>
          <StatusAgendamentoBadge status={a.status} />
          <div className="ml-auto flex gap-1">
            {a.cliente_telefone && (
              <Button variant="ghost" size="icon" asChild title="Chamar no WhatsApp">
                <a href={`https://wa.me/${a.cliente_telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener" aria-label={`Chamar ${a.cliente_nome} no WhatsApp`}>
                  <Phone aria-hidden />
                </a>
              </Button>
            )}
            {a.status === "pendente" && (
              <Button variant="ghost" size="icon" title="Confirmar" aria-label="Confirmar agendamento" onClick={() => mudar.mutate({ id: a.id, status: "confirmado" })}>
                <Check aria-hidden />
              </Button>
            )}
            {(a.status === "pendente" || a.status === "confirmado") && (
              <>
                <Button variant="ghost" size="icon" title="Concluir atendimento" aria-label="Concluir atendimento" onClick={() => mudar.mutate({ id: a.id, status: "concluido" })}>
                  <CheckCheck aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" title="Cancelar" aria-label="Cancelar agendamento" className="text-destructive hover:text-destructive" onClick={() => mudar.mutate({ id: a.id, status: "cancelado" })}>
                  <X aria-hidden />
                </Button>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function VisaoGeral() {
  const { data: me } = useMe()
  const temFinanceiro = useRecurso("financeiro") && me?.role === "admin"
  const [params, setParams] = useSearchParams()
  const [boasVindas] = useState(params.has("bem-vindo"))

  useEffect(() => {
    if (params.has("bem-vindo")) setParams({}, { replace: true })
  }, [params, setParams])

  const hoje = hojeISO()
  const { data: agenda, isLoading } = useAgendamentos({ data: hoje })
  const { data: fat } = useQuery({
    queryKey: ["faturamento", "resumo"],
    queryFn: () => api<ResumoFaturamento>("/faturamento"),
    enabled: temFinanceiro,
  })

  const ativos = (agenda ?? []).filter((a) => a.status !== "cancelado")
  const agora = new Date().toTimeString().slice(0, 5)
  const proximo = ativos.find((a) => a.status !== "concluido" && a.start_time >= agora)
  const aConfirmar = ativos.filter((a) => a.status === "pendente").length

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h2 className="text-2xl font-semibold">
          {saudacao()}{me ? `, ${me.name.split(" ")[0]}` : ""}
        </h2>
      </div>

      <OnboardingCard boasVindas={boasVindas} />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Atendimentos hoje" valor={isLoading ? <Skeleton className="h-8 w-10" /> : ativos.length} />
        <Indicador rotulo="A confirmar" valor={isLoading ? <Skeleton className="h-8 w-10" /> : aConfirmar} />
        <Indicador
          rotulo="Próximo cliente"
          valor={isLoading ? <Skeleton className="h-8 w-20" /> : proximo ? <span className="font-mono">{proximo.start_time}</span> : "—"}
          nota={proximo?.cliente_nome ?? (isLoading ? undefined : "Sem mais horários hoje")}
        />
        {temFinanceiro ? (
          <Indicador rotulo="Faturado no mês" valor={fat ? moeda(fat.mes) : <Skeleton className="h-8 w-24" />} nota={fat ? `Hoje: ${moeda(fat.dia)}` : undefined} />
        ) : (
          <Indicador rotulo="Faturado no mês" valor="—" nota="Disponível no plano Pro" />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Agenda de hoje</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/agenda">Ver agenda completa</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <AgendaDoDia itens={agenda ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
