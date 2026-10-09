import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarCheck, Check, MessageCircle, UserX, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { dataBR, deISO } from "@/lib/format"

type Item = {
  id: number
  data: string
  horario: string
  status: "pendente" | "confirmado" | "falta"
  cliente: string | null
  telefone: string | null
  profissional: string | null
  servicos: string
  reverter_ate: string | null
}
type Lista = { faltas: Item[]; nao_registrados: Item[]; meses: string[] }
type Resultado = "concluido" | "falta" | "cancelado"

const diaLongo = (iso: string) => deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })
const nomeMes = (ym: string) => deISO(`${ym}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

function Linha({ i, children }: { i: Item; children: React.ReactNode }) {
  const wa = i.telefone?.replace(/\D/g, "")
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="w-12 font-mono text-sm font-semibold">{i.horario}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{i.cliente ?? "Cliente"}</p>
        <p className="truncate text-xs text-muted-foreground">{[i.servicos, i.profissional && `com ${i.profissional}`].filter(Boolean).join(" · ")}</p>
      </div>
      {i.status === "confirmado" && <Badge variant="outline" className="border-success/50 text-success">Cliente confirmou</Badge>}
      {wa && (
        <Button size="icon" variant="ghost" asChild>
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" aria-label={`Chamar ${i.cliente ?? "cliente"} no WhatsApp`}><MessageCircle aria-hidden /></a>
        </Button>
      )}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </li>
  )
}

/** Atendimentos esquecidos (dias anteriores sem registro) e faltas automáticas a revisar. */
export default function Pendencias() {
  const qc = useQueryClient()
  const [mes, setMes] = useState("todos")
  const { data, isLoading } = useQuery({
    queryKey: ["pendencias", mes],
    queryFn: () => api<Lista>(`/pendencias${mes !== "todos" ? `?mes=${mes}` : ""}`),
  })

  const recarregar = () => ["pendencias", "agendamentos", "faturamento", "relatorios"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
  const registrar = useMutation({
    mutationFn: ({ id, resultado }: { id: number; resultado: Resultado }) => api<{ message: string }>(`/agendamentos/${id}/registrar`, { method: "POST", body: { resultado } }),
    onSuccess: (r) => { recarregar(); toast.success(r.message) },
    onError: (e) => toast.error(e.message),
  })
  const doDia = useMutation({
    mutationFn: (body: { data: string; resultado: "concluido" | "falta" }) => api<{ message: string }>("/pendencias/dia", { method: "POST", body }),
    onSuccess: (r) => { recarregar(); toast.success(r.message) },
    onError: (e) => toast.error(e.message),
  })

  const ocupado = registrar.isPending || doDia.isPending
  const dias = Object.entries(
    (data?.nao_registrados ?? []).reduce<Record<string, Item[]>>((acc, i) => ({ ...acc, [i.data]: [...(acc[i.data] ?? []), i] }), {}),
  ).sort(([a], [b]) => b.localeCompare(a))

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground">
          Atendimentos de dias anteriores que ficaram sem registro e faltas automáticas que ainda dá para corrigir. Registrar aqui
          mantém o financeiro, a fidelidade e os relatórios certos.
        </p>
        <div className="grid gap-1.5">
          <Label>Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Tudo em aberto</SelectItem>
              {(data?.meses ?? []).map((m) => <SelectItem key={m} value={m} className="capitalize">{nomeMes(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data.faltas.length && !data.nao_registrados.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <CalendarCheck className="size-8 text-success" aria-hidden />
          <p className="font-medium">Tudo registrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Nenhum atendimento esquecido nem falta para revisar{mes !== "todos" ? " neste mês" : ""}.</p>
        </div>
      ) : (
        <>
          {data.faltas.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserX className="size-5 text-destructive" aria-hidden /> Faltas automáticas para revisar</CardTitle>
                <CardDescription>
                  O cliente não confirmou e o atendimento não foi registrado, então o sistema marcou falta 1h depois do horário. Se ele veio,
                  corrija em até 3 dias. Se faltou mesmo, confirme para tirar do aviso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.faltas.map((i) => (
                    <Linha key={i.id} i={i}>
                      <span className="self-center text-xs text-muted-foreground">{dataBR(i.data)} · corrigir até {i.reverter_ate ? dataBR(i.reverter_ate) : "—"}</span>
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => registrar.mutate({ id: i.id, resultado: "concluido" })}>
                        <Check aria-hidden /> Compareceu
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={ocupado} onClick={() => registrar.mutate({ id: i.id, resultado: "falta" })}>
                        Faltou mesmo
                      </Button>
                    </Linha>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {dias.map(([dia, itens]) => (
            <Card key={dia}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="capitalize">{diaLongo(dia)}</CardTitle>
                  <CardDescription>{itens.length} atendimento{itens.length > 1 ? "s" : ""} sem registro</CardDescription>
                </div>
                {itens.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={ocupado} onClick={() => doDia.mutate({ data: dia, resultado: "concluido" })}>
                      <Check aria-hidden /> Todos atendidos
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupado} onClick={() => doDia.mutate({ data: dia, resultado: "falta" })}>
                      Todos faltaram
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {itens.map((i) => (
                    <Linha key={i.id} i={i}>
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => registrar.mutate({ id: i.id, resultado: "concluido" })}>
                        <Check aria-hidden /> Atendido
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={ocupado} onClick={() => registrar.mutate({ id: i.id, resultado: "falta" })}>
                        <UserX aria-hidden /> Faltou
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={ocupado} onClick={() => registrar.mutate({ id: i.id, resultado: "cancelado" })}>
                        <X aria-hidden /> Cancelado
                      </Button>
                    </Linha>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
