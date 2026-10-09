import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus, Scissors, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Confirmar } from "@/components/confirmar"
import { EnviarImagem } from "@/components/enviar-imagem"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRecurso } from "@/hooks/use-sessao"
import { useServicos } from "@/hooks/use-cadastros"
import { api, ApiError } from "@/lib/api"
import { moeda } from "@/lib/format"
import type { Servico } from "@/lib/types"

type Form = { name: string; price: string; duration_time: string; description: string; categoria: string; destaque: string }
const vazio: Form = { name: "", price: "", duration_time: "30", description: "", categoria: "", destaque: "nenhum" }

function FormServico({ servico, aberto, onFechar, categorias }: { servico: Servico | null; aberto: boolean; onFechar: () => void; categorias: string[] }) {
  const qc = useQueryClient()
  const personaliza = useRecurso("personalizacao")
  const [f, setF] = useState<Form>(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [ultimo, setUltimo] = useState<Servico | null | undefined>(undefined)

  // preenche ao abrir (novo ou edição)
  if (aberto && ultimo !== servico) {
    setUltimo(servico)
    setErros({})
    setF(servico
      ? { name: servico.name, price: String(Number(servico.price)), duration_time: String(servico.duration_time ?? 30), description: servico.description ?? "", categoria: servico.categoria ?? "", destaque: servico.destaque ?? "nenhum" }
      : vazio)
  }
  if (!aberto && ultimo !== undefined) setUltimo(undefined)

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(), price: Number(f.price.replace(",", ".")), duration_time: Number(f.duration_time), description: f.description.trim() || null,
        ...(personaliza ? { categoria: f.categoria.trim() || null, destaque: f.destaque === "nenhum" ? null : f.destaque } : {}),
      }
      return servico ? api(`/servicos/${servico.id}`, { method: "PUT", body }) : api("/servicos", { method: "POST", body: { ...body, active: true } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos"] })
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success(servico ? "Serviço atualizado." : "Serviço cadastrado.")
      onFechar()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.errors) setErros(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else toast.error(e.message)
    },
  })

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{servico ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Aparece na sua página de agendamento com preço e duração.</DialogDescription>
        </DialogHeader>
        <form
          id="form-servico"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="s-nome">Nome</Label>
            <Input id="s-nome" value={f.name} onChange={set("name")} placeholder="Ex.: Corte degradê" required />
            {erro("name")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="s-preco">Preço (R$)</Label>
              <Input id="s-preco" inputMode="decimal" value={f.price} onChange={set("price")} placeholder="40,00" required />
              {erro("price")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-dur">Duração (min)</Label>
              <Input id="s-dur" type="number" min={5} step={5} value={f.duration_time} onChange={set("duration_time")} required />
              {erro("duration_time")}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-desc">Descrição (opcional)</Label>
            <Textarea id="s-desc" rows={2} value={f.description} onChange={set("description")} />
          </div>
          {personaliza && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="s-cat">Categoria (opcional)</Label>
                  <Input id="s-cat" list="categorias-servico" maxLength={40} value={f.categoria} onChange={set("categoria")} placeholder="Ex.: Cabelo, Barba, Combos" />
                  <datalist id="categorias-servico">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="grid gap-1.5">
                  <Label>Destaque</Label>
                  <Select value={f.destaque} onValueChange={(v) => setF({ ...f, destaque: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      <SelectItem value="mais_pedido">Mais pedido</SelectItem>
                      <SelectItem value="novo">Novo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {servico ? (
                <EnviarImagem
                  atual={servico.photo ?? null}
                  rotulo="Foto do serviço"
                  inicial={servico.name.slice(0, 1).toUpperCase()}
                  enviarPara={`/servicos/${servico.id}/foto`}
                  removerEm={`/servicos/${servico.id}/foto`}
                  onMudou={() => qc.invalidateQueries({ queryKey: ["servicos"] })}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Depois de cadastrar, você pode colocar uma foto do serviço.</p>
              )}
            </>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-servico" disabled={salvar.isPending}>
            {servico ? "Salvar alterações" : "Cadastrar serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Servicos() {
  const qc = useQueryClient()
  const { data: servicos = [], isLoading } = useServicos()
  const personaliza = useRecurso("personalizacao")
  const categorias = [...new Set(servicos.map((s) => s.categoria?.trim()).filter(Boolean) as string[])]
  const ordenar = useMutation({
    mutationFn: (ids: number[]) => api("/pagina/servicos/ordem", { method: "PUT", body: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servicos"] }),
    onError: (e) => toast.error(e.message),
  })
  const mover = (i: number, d: -1 | 1) => {
    const ids = servicos.map((s) => s.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    ordenar.mutate(ids)
  }
  const [editando, setEditando] = useState<Servico | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [excluir, setExcluir] = useState<Servico | null>(null)

  const alternar = useMutation({
    mutationFn: (s: Servico) => api(`/servicos/${s.id}`, { method: "PUT", body: { active: !s.active } }),
    onSuccess: (_r, s) => {
      qc.invalidateQueries({ queryKey: ["servicos"] })
      toast.success(s.active ? "Serviço oculto da página de agendamento." : "Serviço de volta na página de agendamento.")
    },
    onError: (e) => toast.error(e.message),
  })
  const remover = useMutation({
    mutationFn: (s: Servico) => api(`/servicos/${s.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicos"] })
      toast.success("Serviço excluído.")
    },
    onError: (e) => toast.error(e.message),
  })
  const exemplos = useMutation({
    mutationFn: () => api<{ message: string }>("/onboarding/servicos-padrao", { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["servicos"] })
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })

  const abrirNovo = () => {
    setEditando(null)
    setFormAberto(true)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">Preços e durações que o cliente vê ao agendar.</p>
        <Button onClick={abrirNovo}>
          <Plus aria-hidden /> Novo serviço
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : servicos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <Scissors className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum serviço cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Comece com os serviços mais comuns e ajuste os preços depois, ou cadastre os seus.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => exemplos.mutate()} disabled={exemplos.isPending}>
              Usar serviços de exemplo
            </Button>
            <Button variant="outline" onClick={abrirNovo}>
              Cadastrar o primeiro
            </Button>
          </div>
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Serviço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Na página de agendamento</TableHead>
                <TableHead className={personaliza ? "w-40" : "w-24"} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s, i) => (
                <TableRow key={s.id} className={s.active ? "" : "text-muted-foreground"}>
                  <TableCell className="pl-5 font-medium">
                    <span className="flex items-center gap-2.5">
                      {s.photo && <img src={s.photo} alt="" className="size-9 shrink-0 rounded-md object-cover" />}
                      <span>
                        {s.name}
                        {s.destaque && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{s.destaque === "novo" ? "Novo" : "Mais pedido"}</span>}
                        {s.categoria && <span className="block text-xs font-normal text-muted-foreground">{s.categoria}</span>}
                      </span>
                    </span>
                    {s.description && <span className="block max-w-xs truncate text-xs font-normal text-muted-foreground">{s.description}</span>}
                  </TableCell>
                  <TableCell className="tabular">{s.duration_time} min</TableCell>
                  <TableCell className="tabular">{moeda(s.price)}</TableCell>
                  <TableCell>
                    <Switch checked={s.active} onCheckedChange={() => alternar.mutate(s)} aria-label={`Mostrar ${s.name} na página de agendamento`} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {personaliza && (
                      <>
                        <Button variant="ghost" size="icon" aria-label={`Subir ${s.name} na lista`} disabled={i === 0 || ordenar.isPending} onClick={() => mover(i, -1)}>
                          <ArrowUp aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Descer ${s.name} na lista`} disabled={i === servicos.length - 1 || ordenar.isPending} onClick={() => mover(i, 1)}>
                          <ArrowDown aria-hidden />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`} onClick={() => { setEditando(s); setFormAberto(true) }}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${s.name}`} className="text-destructive hover:text-destructive" onClick={() => setExcluir(s)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <FormServico servico={editando} aberto={formAberto} onFechar={() => setFormAberto(false)} categorias={categorias} />
      <Confirmar
        aberto={!!excluir}
        titulo={`Excluir "${excluir?.name}"?`}
        descricao="O serviço sai da página de agendamento. Os atendimentos antigos continuam no histórico. Se só quer pausar, use a chave ao lado."
        acao="Excluir serviço"
        onConfirmar={() => excluir && remover.mutate(excluir)}
        onFechar={() => setExcluir(null)}
      />
    </div>
  )
}
