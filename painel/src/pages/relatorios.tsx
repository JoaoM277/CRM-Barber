import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Lightbulb, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Indicador } from "@/components/indicador"
import { SeletorPeriodo, usePeriodo } from "@/components/seletor-periodo"
import { useRecurso } from "@/hooks/use-sessao"
import { api } from "@/lib/api"

type Relatorio = {
  agenda: { total: number; concluidos: number; cancelados: number; cancelados_pelo_cliente: number; taxa_cancelamento: number }
  clientes: { atendidos: number; novos: number; recorrentes: number }
  retorno: { janela_dias: number; coorte: number; voltaram: number; taxa: number | null; intervalo_medio_dias: number | null }
  ocupacao: {
    geral: number
    por_profissional: { worker_id: number; profissional: string; atendimentos: number; horas_ocupadas: number; horas_disponiveis: number; ocupacao: number }[]
    por_dia_semana: { dia: number; aberto: boolean; ocupacao: number }[]
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const horas = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`

/** Barra horizontal de 0 a 100%. */
function Barra({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(valor * 100)} aria-label={rotulo}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, valor * 100)}%` }} />
    </div>
  )
}

function SemRecurso() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <TrendingUp className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">Os relatórios fazem parte do plano Pro</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Quantos clientes voltam, quanto da agenda está ocupada por profissional e por dia da semana, clientes novos e cancelamentos.
      </p>
      <Button asChild>
        <Link to="/assinatura">Ver planos</Link>
      </Button>
    </div>
  )
}

export default function Relatorios() {
  const temRecurso = useRecurso("financeiro")
  const periodo = usePeriodo()
  const { inicio, fim } = periodo

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios", inicio, fim],
    queryFn: () => api<Relatorio>(`/relatorios?inicio=${inicio}&fim=${fim}`),
    enabled: temRecurso,
  })

  if (!temRecurso) return <SemRecurso />

  // segunda a domingo (ordem de quem trabalha na semana)
  const semana = data ? [1, 2, 3, 4, 5, 6, 0].map((d) => data.ocupacao.por_dia_semana.find((x) => x.dia === d)!).filter(Boolean) : []
  const r = data?.retorno

  return (
    <div>
      <SeletorPeriodo periodo={periodo} com90 nota="Visita = horário marcado e não cancelado que já passou." />

      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              rotulo="Clientes atendidos"
              valor={String(data.clientes.atendidos)}
              nota={`${data.clientes.novos} novo(s) · ${data.clientes.recorrentes} de volta`}
            />
            <Indicador
              rotulo="Taxa de retorno"
              valor={r?.taxa == null ? "—" : pct(r.taxa)}
              nota={r?.taxa == null ? "Ainda sem histórico suficiente" : `${r.voltaram} de ${r.coorte} voltaram em até ${r.janela_dias} dias`}
            />
            <Indicador rotulo="Agenda ocupada" valor={pct(data.ocupacao.geral)} nota="Tempo marcado ÷ tempo aberto" />
            <Indicador
              rotulo="Cancelamentos"
              valor={pct(data.agenda.taxa_cancelamento)}
              nota={`${data.agenda.cancelados} de ${data.agenda.total}${data.agenda.cancelados_pelo_cliente ? ` · ${data.agenda.cancelados_pelo_cliente} pelo cliente` : ""}`}
            />
          </div>

          {r?.intervalo_medio_dias != null && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-wrap items-center gap-3">
                <Lightbulb className="size-5 shrink-0 text-primary" aria-hidden />
                <p className="min-w-0 flex-1 text-sm">
                  Seus clientes voltam, em média, a cada <strong>{r.intervalo_medio_dias} dias</strong>. Quem passa bem disso pode estar indo
                  em outro lugar: a reativação automática convida essas pessoas a voltar.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/whatsapp">Ver reativação</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ocupação por profissional</CardTitle>
                <CardDescription>Quanto do horário de funcionamento cada um tem marcado no período.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.ocupacao.por_profissional.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum profissional ativo.</p>
                ) : (
                  <ul className="grid gap-4">
                    {data.ocupacao.por_profissional.map((p) => (
                      <li key={p.worker_id} className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium">{p.profissional}</span>
                          <span className="tabular text-muted-foreground">
                            <strong className="text-foreground">{pct(p.ocupacao)}</strong> · {horas(p.horas_ocupadas)} de {horas(p.horas_disponiveis)} · {p.atendimentos} atend.
                          </span>
                        </div>
                        <Barra valor={p.ocupacao} rotulo={`Ocupação de ${p.profissional}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ocupação por dia da semana</CardTitle>
                <CardDescription>Os dias mais vazios são bons para promoções e encaixes.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {semana.map((d) => (
                    <li key={d.dia} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span>{DIAS[d.dia]}</span>
                      {d.aberto ? <Barra valor={d.ocupacao} rotulo={`Ocupação de ${DIAS[d.dia]}`} /> : <span className="text-xs text-muted-foreground">Fechado</span>}
                      <span className="text-right tabular">{d.aberto ? pct(d.ocupacao) : ""}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
