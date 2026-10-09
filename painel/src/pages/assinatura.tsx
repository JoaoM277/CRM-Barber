import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Confirmar } from "@/components/confirmar"
import { api } from "@/lib/api"
import { dataBR, moeda } from "@/lib/format"
import type { Assinatura, Plano } from "@/lib/types"
import { cn } from "@/lib/utils"

type Fatura = { id: string; valor: number; status: string; forma_pagamento: string | null; vencimento: string | null; pago_em: string | null; link: string | null }
type Resp = { assinatura: Assinatura | null; planos: Plano[]; faturas: Fatura[] }

const FORMAS = [
  { v: "PIX", t: "Pix", d: "Você recebe a cobrança todo mês e paga pelo app do banco." },
  { v: "BOLETO", t: "Boleto", d: "Você recebe o boleto todo mês por e-mail." },
  { v: "CREDIT_CARD", t: "Cartão de crédito", d: "Cobrado sozinho todo mês. O cartão fica na página segura do Asaas." },
] as const
const RECURSO: Record<string, string> = { whatsapp: "Confirmação automática no WhatsApp", financeiro: "Financeiro e comissões", personalizacao: "Página com a cara da barbearia (estilos, capa e galeria)", seletores_premium: "Todos os 10 modelos de seletor" }
const FATURA: Record<string, string> = { PENDING: "Em aberto", OVERDUE: "Vencida", CONFIRMED: "Paga", RECEIVED: "Paga", RECEIVED_IN_CASH: "Paga", REFUNDED: "Estornada", DELETED: "Cancelada" }

function situacao(a: Assinatura | null) {
  if (!a) return "Nenhuma assinatura encontrada."
  const plano = a.plano?.nome ?? "—"
  switch (a.status) {
    case "trialing":
      return a.acesso === "full"
        ? `Teste grátis com tudo liberado até ${dataBR(a.trial_termina_em)}.${a.tem_assinatura_no_gateway ? ` Plano escolhido: ${plano}.` : ""}`
        : `Seu teste grátis terminou em ${dataBR(a.trial_termina_em)}. Escolha um plano para continuar.`
    case "active":
      return `Plano ${plano} ativo, pago até ${dataBR(a.periodo_pago_ate)}.`
    case "past_due":
      return a.acesso === "full" ? `Plano ${plano} com mensalidade em atraso. O acesso continua até ${dataBR(a.acesso_ate)}.` : `Plano ${plano} com mensalidade em atraso. O painel está em modo leitura até o pagamento.`
    case "canceled":
      return `Assinatura cancelada. Acesso até ${dataBR(a.acesso_ate)}.`
  }
}

export default function AssinaturaPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["assinatura"], queryFn: () => api<Resp>("/assinatura") })
  const a = data?.assinatura ?? null
  const contratado = !!(a?.tem_assinatura_no_gateway && a.status !== "canceled")

  const [plano, setPlano] = useState("pro")
  const [forma, setForma] = useState("PIX")
  const [cpf, setCpf] = useState("")
  const [cancelar, setCancelar] = useState(false)

  useEffect(() => {
    if (!data) return
    setPlano(contratado && a?.plano ? a.plano.slug : (data.planos.find((p) => p.slug === "pro") ?? data.planos[0])?.slug ?? "pro")
    if (a?.forma_pagamento) setForma(a.forma_pagamento)
  }, [data, contratado, a])

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["assinatura"] })
    qc.invalidateQueries({ queryKey: ["me"] })
  }

  const assinar = useMutation({
    mutationFn: () => api<{ link_pagamento: string | null }>("/assinatura", { method: "POST", body: { plano, forma_pagamento: forma, ...(cpf.trim() ? { cpf_cnpj: cpf } : {}) } }),
    onMutate: () => window.open("", "_blank"), // abre a aba no clique (bloqueador de pop-up)
    onSuccess: (r, _v, janela) => {
      recarregar()
      if (r.link_pagamento && janela) {
        janela.location.href = r.link_pagamento
        toast.success("Cobrança gerada! Conclua o pagamento na aba que abriu.")
      } else {
        janela?.close()
        toast.success("Assinatura atualizada.")
      }
    },
    onError: (e, _v, janela) => {
      janela?.close()
      toast.error(e.message)
    },
  })
  const cancelarAssinatura = useMutation({
    mutationFn: () => api<{ message: string }>("/assinatura", { method: "DELETE" }),
    onSuccess: (r) => {
      recarregar()
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading || !data) return <Skeleton className="h-[32rem] w-full rounded-xl" />

  const escolhido = data.planos.find((p) => p.slug === plano)

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sua assinatura</CardTitle>
          <CardDescription className="text-base text-foreground">{situacao(a)}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {data.planos.map((p) => {
          const sel = p.slug === plano
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => setPlano(p.slug)}
              aria-pressed={sel}
              className={cn(
                "grid content-start gap-3 rounded-xl border bg-card p-5 text-left transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring",
                sel && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{p.nome}</span>
                {contratado && a?.plano?.slug === p.slug && <Badge variant="outline" className="border-success/50 text-success">Seu plano</Badge>}
              </div>
              <span className="text-3xl font-semibold tabular">
                {moeda(p.preco)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </span>
              <ul className="grid gap-1.5 text-sm">
                <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden />{p.max_profissionais ? `Até ${p.max_profissionais} profissionais` : "Profissionais ilimitados"}</li>
                <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden />Agenda e página de agendamento</li>
                {p.recursos.map((r) => (
                  <li key={r} className="flex gap-2"><Check className="size-4 shrink-0 text-success" aria-hidden />{RECURSO[r] ?? r}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forma de pagamento</CardTitle>
          {a?.status === "trialing" && a.acesso === "full" && (
            <CardDescription>A primeira cobrança só vence no fim do teste ({dataBR(a.trial_termina_em)}).</CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Forma de pagamento">
            {FORMAS.map((f) => (
              <button
                key={f.v}
                type="button"
                role="radio"
                aria-checked={forma === f.v}
                onClick={() => setForma(f.v)}
                className={cn("rounded-lg border p-3 text-left text-sm transition hover:border-primary/60", forma === f.v && "border-primary ring-1 ring-primary")}
              >
                <span className="block font-medium">{f.t}</span>
                <span className="text-muted-foreground">{f.d}</span>
              </button>
            ))}
          </div>
          {!contratado && (
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor="a-cpf">CPF ou CNPJ do titular</Label>
              <Input id="a-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => assinar.mutate()} disabled={assinar.isPending}>
              {contratado ? "Salvar plano e forma de pagamento" : `Assinar o ${escolhido?.nome ?? "plano"} — ${moeda(escolhido?.preco)}/mês`}
            </Button>
            <span className="text-xs text-muted-foreground">Pagamento processado pelo Asaas. Sem fidelidade.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.faturas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma fatura ainda.</TableCell></TableRow>
              )}
              {data.faturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="pl-6">{dataBR(f.vencimento)}</TableCell>
                  <TableCell className="tabular">{moeda(f.valor)}</TableCell>
                  <TableCell>{FATURA[f.status] ?? f.status}</TableCell>
                  <TableCell className="pr-6 text-right">
                    {f.link && ["PENDING", "OVERDUE"].includes(f.status) && (
                      <Button size="sm" asChild><a href={f.link} target="_blank" rel="noopener">Pagar</a></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {contratado && (
        <button type="button" onClick={() => setCancelar(true)} className="justify-self-start text-sm text-muted-foreground underline hover:text-destructive">
          Cancelar assinatura
        </button>
      )}
      <Confirmar
        aberto={cancelar}
        titulo="Cancelar a assinatura?"
        descricao="As próximas cobranças param. O acesso continua até o fim do período já pago."
        acao="Cancelar assinatura"
        onConfirmar={() => cancelarAssinatura.mutate()}
        onFechar={() => setCancelar(false)}
      />
    </div>
  )
}
