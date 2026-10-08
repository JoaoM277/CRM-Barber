import { useMemo, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChartColumn, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Confirmar } from "@/components/confirmar"
import { GraficoColunas } from "@/components/grafico-colunas"
import { Indicador } from "@/components/indicador"
import { SeletorPeriodo, usePeriodo } from "@/components/seletor-periodo"
import { useRecurso } from "@/hooks/use-sessao"
import { api } from "@/lib/api"
import { dataBR, moeda, somarDias } from "@/lib/format"

type Fat = {
  periodo: { inicio: string; fim: string; atendimentos: number; faturamento_total: number; total_comissoes: number; total_fixo: number; lucro_liquido: number }
  por_profissional: { worker_id: number; profissional: string; atendimentos: number; bruto: number; comissao: number; fixo: number; total_a_pagar: number }[]
  por_servico: { servico: string; quantidade: number; total: number }[]
  itens: { id: number; data: string; valor: number }[]
}
type Repasse = { id: number; worker?: { name: string }; periodo_inicio: string; periodo_fim: string; valor_pago: number | string; pago_em: string; atendimentos: number }

function SemRecurso() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <ChartColumn className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">O financeiro faz parte do plano Pro</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Faturamento por dia, por serviço e por profissional, comissões calculadas sozinhas e registro de repasses — sem planilha.
      </p>
      <Button asChild>
        <Link to="/assinatura">Ver planos</Link>
      </Button>
    </div>
  )
}

export default function Financeiro() {
  const qc = useQueryClient()
  const temRecurso = useRecurso("financeiro")
  const periodo = usePeriodo()
  const [pagar, setPagar] = useState<Fat["por_profissional"][number] | null>(null)
  const { inicio, fim } = periodo

  const { data, isLoading } = useQuery({
    queryKey: ["faturamento", inicio, fim],
    queryFn: () => api<Fat>(`/faturamento?inicio=${inicio}&fim=${fim}`),
    enabled: temRecurso,
  })
  const { data: repasses = [] } = useQuery({
    queryKey: ["repasses"],
    queryFn: () => api<{ data: Repasse[] }>("/payouts").then((r) => r.data),
    enabled: temRecurso,
  })

  const registrar = useMutation({
    mutationFn: (worker_id: number) => api<{ message: string }>("/payouts", { method: "POST", body: { worker_id, inicio, fim } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["repasses"] })
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })

  // faturamento por dia (dias sem atendimento = 0)
  const porDia = useMemo(() => {
    if (!data) return []
    const soma = new Map<string, number>()
    data.itens.forEach((i) => soma.set(i.data.slice(0, 10), (soma.get(i.data.slice(0, 10)) ?? 0) + Number(i.valor)))
    const dias: { rotulo: string; rotuloLongo: string; valor: number }[] = []
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
      dias.push({ rotulo: dataBR(d).slice(0, 5), rotuloLongo: dataBR(d), valor: soma.get(d) ?? 0 })
    }
    return dias
  }, [data, inicio, fim])

  if (!temRecurso) return <SemRecurso />

  const p = data?.periodo
  const maxServico = Math.max(1, ...(data?.por_servico ?? []).map((s) => s.total))

  return (
    <div>
      <SeletorPeriodo periodo={periodo} nota="Considera só atendimentos concluídos." />

      {isLoading || !p ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Faturamento" valor={moeda(p.faturamento_total)} nota={`${p.atendimentos} atendimento(s)`} />
            <Indicador rotulo="Ticket médio" valor={moeda(p.atendimentos ? p.faturamento_total / p.atendimentos : 0)} />
            <Indicador rotulo="Comissões e fixos" valor={moeda(p.total_comissoes + p.total_fixo)} />
            <Indicador rotulo="Fica para a barbearia" valor={moeda(p.lucro_liquido)} nota="Faturamento menos pagamentos" />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento por dia</CardTitle>
                <CardDescription>
                  {dataBR(inicio)} a {dataBR(fim)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoColunas pontos={porDia} formatar={moeda} descricao="Gráfico de colunas do faturamento por dia no período" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por serviço</CardTitle>
              </CardHeader>
              <CardContent>
                {data.por_servico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum atendimento concluído no período.</p>
                ) : (
                  <ul className="grid gap-3">
                    {data.por_servico.map((s) => (
                      <li key={s.servico} className="grid gap-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="truncate">{s.servico}</span>
                          <span className="tabular text-muted-foreground">
                            {s.quantidade}× · <span className="text-foreground">{moeda(s.total)}</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-r-full bg-chart-1" style={{ width: `${(s.total / maxServico) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>A pagar por profissional</CardTitle>
              <CardDescription>Comissão sobre os atendimentos concluídos no período, mais o fixo.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Profissional</TableHead>
                    <TableHead>Atendimentos</TableHead>
                    <TableHead>Faturou</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Fixo</TableHead>
                    <TableHead>Total a pagar</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_profissional.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhum atendimento concluído no período.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.por_profissional.map((r) => (
                    <TableRow key={r.worker_id}>
                      <TableCell className="pl-6 font-medium">{r.profissional}</TableCell>
                      <TableCell className="tabular">{r.atendimentos}</TableCell>
                      <TableCell className="tabular">{moeda(r.bruto)}</TableCell>
                      <TableCell className="tabular">{moeda(r.comissao)}</TableCell>
                      <TableCell className="tabular">{moeda(r.fixo)}</TableCell>
                      <TableCell className="font-semibold tabular">{moeda(r.total_a_pagar)}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button size="sm" variant="outline" onClick={() => setPagar(r)} disabled={r.total_a_pagar <= 0}>
                          <HandCoins aria-hidden /> Registrar repasse
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repasses registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {repasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda. Ao pagar um profissional, registre aqui para ter o histórico.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {repasses.slice(0, 20).map((r) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                      <span>
                        <span className="font-medium">{r.worker?.name ?? "Profissional"}</span>
                        <span className="text-muted-foreground"> · {dataBR(r.periodo_inicio)} a {dataBR(r.periodo_fim)} · {r.atendimentos} atend.</span>
                      </span>
                      <span className="tabular">
                        {moeda(r.valor_pago)} <span className="text-muted-foreground">pago em {dataBR(r.pago_em)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Confirmar
        aberto={!!pagar}
        titulo={`Registrar repasse para ${pagar?.profissional}?`}
        descricao={`${moeda(pagar?.total_a_pagar)} referentes a ${dataBR(inicio)} a ${dataBR(fim)}. Isso só registra o pagamento no histórico; o Pix/dinheiro é feito por você.`}
        acao="Registrar repasse"
        onConfirmar={() => pagar && registrar.mutate(pagar.worker_id)}
        onFechar={() => setPagar(null)}
      />
    </div>
  )
}
