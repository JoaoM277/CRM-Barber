import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Eye, EyeOff, MessageSquareReply, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Indicador } from "@/components/indicador"
import { useProfissionais } from "@/hooks/use-cadastros"
import { useBarbearia } from "@/hooks/use-sessao"
import { api } from "@/lib/api"
import { dataBR, linkAgendamento } from "@/lib/format"
import { cn } from "@/lib/utils"

type Avaliacao = {
  id: number
  nota: number
  comentario: string | null
  cliente: string | null
  profissional: string | null
  data_atendimento: string
  em: string
  oculta: boolean
  publica: boolean
  resposta: string | null
}
type Lista = {
  data: Avaliacao[]
  meta: { pagina: number; ultima: number; total: number }
  resumo: { media: number | null; total: number; distribuicao: Record<string, number>; publicas: number; sem_resposta: number }
}

const estrelas = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n)

function Situacao({ a }: { a: Avaliacao }) {
  if (a.oculta) return <Badge variant="outline" className="text-muted-foreground">Escondida</Badge>
  if (a.publica) return <Badge variant="outline" className="border-success/50 bg-success/10 text-success">Na página</Badge>
  return <Badge variant="outline" className="text-muted-foreground" title="Notas de 1 a 3, ou sem comentário, ficam só aqui">Só no painel</Badge>
}

export default function Avaliacoes() {
  const qc = useQueryClient()
  const { data: barbearia } = useBarbearia()
  const { data: profissionais = [] } = useProfissionais()
  const [filtro, setFiltro] = useState({ nota: "todas", profissional: "todos", status: "todas" })
  const [pagina, setPagina] = useState(1)
  const [respondendo, setRespondendo] = useState<Avaliacao | null>(null)
  const [resposta, setResposta] = useState("")

  const qs = new URLSearchParams({
    page: String(pagina),
    ...(filtro.nota !== "todas" ? { nota: filtro.nota } : {}),
    ...(filtro.profissional !== "todos" ? { profissional: filtro.profissional } : {}),
    ...(filtro.status !== "todas" ? { status: filtro.status } : {}),
  }).toString()
  const { data, isLoading } = useQuery({ queryKey: ["avaliacoes", qs], queryFn: () => api<Lista>(`/avaliacoes?${qs}`), placeholderData: (a) => a })

  const salvar = useMutation({
    mutationFn: ({ id, ...body }: { id: number; oculta?: boolean; resposta?: string | null }) => api<{ message: string }>(`/avaliacoes/${id}`, { method: "PUT", body }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["avaliacoes"] })
      toast.success(v.oculta === undefined ? (v.resposta ? "Resposta publicada." : "Resposta removida.") : v.oculta ? "Escondida da página." : "De volta à página.")
      setRespondendo(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const mudarFiltro = (k: keyof typeof filtro, v: string) => { setFiltro({ ...filtro, [k]: v }); setPagina(1) }
  const r = data?.resumo
  const maior = r ? Math.max(1, ...Object.values(r.distribuicao)) : 1

  return (
    <div className="grid gap-6">
      {isLoading || !r ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[repeat(3,1fr)_1.4fr]">
          <Indicador rotulo="Nota média" valor={r.media != null ? `${r.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ★` : "—"} nota={`${r.total} avaliação(ões)`} />
          <Indicador rotulo="Na página de agendamento" valor={String(r.publicas)} nota="Notas 4 e 5 com comentário" />
          <Indicador rotulo="Esperando resposta" valor={String(r.sem_resposta)} nota="Com comentário e sem resposta" />
          <Card className="py-4">
            <CardContent className="grid gap-1 px-5">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-sm">
                  <span className="tabular">{n}★</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${((r.distribuicao[n] ?? 0) / maior) * 100}%` }} /></div>
                  <span className="text-right tabular text-muted-foreground">{r.distribuicao[n] ?? 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Nota</Label>
          <Select value={filtro.nota} onValueChange={(v) => mudarFiltro("nota", v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} estrela{n > 1 ? "s" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Profissional</Label>
          <Select value={filtro.profissional} onValueChange={(v) => mudarFiltro("profissional", v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {profissionais.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Situação</Label>
          <Select value={filtro.status} onValueChange={(v) => mudarFiltro("status", v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="publica">Na página</SelectItem>
              <SelectItem value="interna">Só no painel</SelectItem>
              <SelectItem value="oculta">Escondidas</SelectItem>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {barbearia && (
          <Button variant="outline" className="ml-auto" asChild>
            <a href={`${linkAgendamento(barbearia.slug)}#avaliacoes`} target="_blank" rel="noopener">Ver na página</a>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data?.data.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <Star className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhuma avaliação {filtro.nota !== "todas" || filtro.status !== "todas" || filtro.profissional !== "todos" ? "com esses filtros" : "ainda"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            1h depois de você marcar um atendimento como concluído, o cliente recebe no WhatsApp "de 1 a 5, como foi?" e pode deixar um comentário.
            Ligue em <Link to="/whatsapp" className="underline underline-offset-2">WhatsApp → Avaliação pós-atendimento</Link>.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {data.data.map((a) => (
            <li key={a.id}>
              <Card className={cn("py-4", a.oculta && "opacity-60")}>
                <CardContent className="grid gap-2 px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={cn("text-lg leading-none", a.nota <= 3 ? "text-destructive" : "text-amber-500")} aria-label={`Nota ${a.nota} de 5`}>{estrelas(a.nota)}</span>
                    <span className="font-medium">{a.cliente ?? "Cliente"}</span>
                    <span className="text-sm text-muted-foreground">{a.profissional ? `com ${a.profissional} · ` : ""}atendido em {dataBR(a.data_atendimento)}</span>
                    <span className="ml-auto"><Situacao a={a} /></span>
                  </div>
                  {a.comentario ? <p className="whitespace-pre-line">“{a.comentario}”</p> : <p className="text-sm text-muted-foreground">Sem comentário, só a nota.</p>}
                  {a.resposta && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="text-xs font-semibold">Sua resposta</p>
                      <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{a.resposta}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {a.comentario && (
                      <Button size="sm" variant="outline" onClick={() => { setRespondendo(a); setResposta(a.resposta ?? "") }}>
                        <MessageSquareReply aria-hidden /> {a.resposta ? "Editar resposta" : "Responder"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={salvar.isPending} onClick={() => salvar.mutate({ id: a.id, oculta: !a.oculta })}>
                      {a.oculta ? <><Eye aria-hidden /> Mostrar</> : <><EyeOff aria-hidden /> Esconder</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.ultima > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anteriores</Button>
          <span className="text-sm text-muted-foreground">Página {data.meta.pagina} de {data.meta.ultima}</span>
          <Button variant="outline" disabled={pagina >= data.meta.ultima} onClick={() => setPagina(pagina + 1)}>Próximas</Button>
        </div>
      )}

      <Dialog open={!!respondendo} onOpenChange={(v) => !v && setRespondendo(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder a {respondendo?.cliente ?? "cliente"}</DialogTitle>
            <DialogDescription>
              {respondendo?.publica ? "A resposta aparece embaixo do comentário, na página de agendamento." : "Esta avaliação está só no painel; a resposta fica registrada aqui."}
            </DialogDescription>
          </DialogHeader>
          {respondendo?.comentario && <p className="rounded-lg bg-muted p-3 text-sm">“{respondendo.comentario}”</p>}
          <Textarea rows={4} maxLength={500} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Ex.: Valeu demais, João! Te esperamos na próxima." />
          <DialogFooter>
            {respondendo?.resposta && (
              <Button variant="ghost" className="mr-auto text-destructive" onClick={() => respondendo && salvar.mutate({ id: respondendo.id, resposta: null })}>Apagar resposta</Button>
            )}
            <Button variant="outline" onClick={() => setRespondendo(null)}>Cancelar</Button>
            <Button disabled={!resposta.trim() || salvar.isPending} onClick={() => respondendo && salvar.mutate({ id: respondendo.id, resposta: resposta.trim() })}>Publicar resposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
