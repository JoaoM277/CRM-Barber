import { useDeferredValue, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MessageCircle, Plus, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { StatusAgendamentoBadge } from "@/components/status-agendamento"
import { Confirmar } from "@/components/confirmar"
import { useMe } from "@/hooks/use-sessao"
import { api, ApiError, API_BASE_URL, getToken } from "@/lib/api"
import { dataBR, fone, moeda } from "@/lib/format"
import type { StatusAgendamento } from "@/lib/types"

const DIAS_SUMIDO = 45

type Cliente = {
  id: number
  name: string
  phone: string
  email: string | null
  birth_date: string | null
  observation: string | null
  visitas: number
  ultima_visita: string | null
  total_gasto: string | number | null
  proximo_horario: string | null
}

type Ficha = Cliente & {
  historico: { id: number; date: string; start_time: string; status: StatusAgendamento; price: string | number | null; profissional: string | null; servicos: string }[]
}

const diasDesde = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso.slice(0, 10) + "T12:00").getTime()) / 86_400_000) : null)

function FormCliente({ cliente, aberto, onFechar }: { cliente: Cliente | null; aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: "", phone: "", email: "", birth_date: "", observation: "" })
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!aberto) return
    setErros({})
    setF({
      name: cliente?.name ?? "",
      phone: cliente ? fone(cliente.phone) : "",
      email: cliente?.email ?? "",
      birth_date: cliente?.birth_date?.slice(0, 10) ?? "",
      observation: cliente?.observation ?? "",
    })
  }, [aberto, cliente])

  const salvar = useMutation({
    mutationFn: () => {
      const body = { name: f.name.trim(), phone: f.phone, email: f.email.trim() || null, birth_date: f.birth_date || null, observation: f.observation.trim() || null }
      return cliente ? api(`/clientes/${cliente.id}`, { method: "PUT", body }) : api("/clientes", { method: "POST", body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] })
      toast.success(cliente ? "Cliente atualizado." : "Cliente cadastrado.")
      onFechar()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.errors) setErros(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else toast.error(e.message)
    },
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Quem agenda pelo seu link entra aqui sozinho.</DialogDescription>
        </DialogHeader>
        <form id="form-cliente" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
          <div className="grid gap-1.5">
            <Label htmlFor="c-nome">Nome</Label>
            <Input id="c-nome" value={f.name} onChange={set("name")} required />
            {erro("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-tel">Telefone</Label>
              <Input id="c-tel" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} required />
              {erro("phone")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-nasc">Aniversário (opcional)</Label>
              <Input id="c-nasc" type="date" value={f.birth_date} onChange={set("birth_date")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-email">E-mail (opcional)</Label>
            <Input id="c-email" type="email" value={f.email} onChange={set("email")} />
            {erro("email")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-obs">Observação (opcional)</Label>
            <Textarea id="c-obs" rows={2} value={f.observation} onChange={set("observation")} placeholder="Ex.: alérgico a pomada X, gosta de conversar" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-cliente" disabled={salvar.isPending}>{cliente ? "Salvar alterações" : "Cadastrar cliente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FichaCliente({ id, onFechar, onEditar }: { id: number | null; onFechar: () => void; onEditar: (c: Cliente) => void }) {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { data, isLoading } = useQuery({ queryKey: ["clientes", id], queryFn: () => api<Ficha>(`/clientes/${id}`), enabled: id !== null })
  const [apagar, setApagar] = useState(false)

  const anonimizar = useMutation({
    mutationFn: () => api<{ message: string }>(`/clientes/${id}/anonimizar`, { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["clientes"] })
      toast.success(r.message)
      onFechar()
    },
    onError: (e) => toast.error(e.message),
  })

  // LGPD: cópia dos dados para entregar ao cliente que pediu
  const baixarDados = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clientes/${id}/dados`, { headers: { Accept: "application/json", Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      Object.assign(document.createElement("a"), { href: url, download: `dados-cliente-${id}.json` }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error("Não foi possível gerar o arquivo. Tente de novo.")
    }
  }

  if (id === null) return null
  const wa = data?.phone.replace(/\D/g, "")

  return (
    <Sheet open onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg">{data?.name ?? "Carregando…"}</SheetTitle>
          <SheetDescription className="font-mono">{data ? fone(data.phone) : ""}</SheetDescription>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="px-4"><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="grid gap-5 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              {wa && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener"><MessageCircle aria-hidden /> WhatsApp</a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onEditar(data)}>Editar dados</Button>
            </div>
            {data.observation && <p className="rounded-lg bg-muted p-3 text-sm">{data.observation}</p>}
            {data.birth_date && <p className="text-sm text-muted-foreground">Aniversário: {dataBR(data.birth_date).slice(0, 5)}</p>}
            <Separator />
            <div>
              <p className="mb-2 font-medium">Atendimentos</p>
              {data.historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.historico.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {dataBR(h.date)} <span className="font-mono text-muted-foreground">{h.start_time}</span>
                        </p>
                        <p className="truncate text-muted-foreground">{h.servicos}{h.profissional ? ` · ${h.profissional}` : ""}</p>
                      </div>
                      <div className="grid shrink-0 justify-items-end gap-1">
                        <StatusAgendamentoBadge status={h.status} />
                        {h.price != null && <span className="text-xs tabular text-muted-foreground">{moeda(h.price)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {me?.role === "admin" && (
              <>
                <Separator />
                <div className="grid gap-2">
                  <p className="font-medium">Privacidade (LGPD)</p>
                  <p className="text-xs text-muted-foreground">Se o cliente pedir uma cópia dos dados dele ou que eles sejam apagados.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={baixarDados}>Baixar dados do cliente</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setApagar(true)}>Apagar dados pessoais</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <Confirmar
          aberto={apagar}
          titulo="Apagar os dados pessoais deste cliente?"
          descricao="Nome, telefone, e-mail, aniversário e observações são apagados para sempre. Os atendimentos continuam no financeiro, sem identificação. Não dá para desfazer."
          acao="Apagar dados pessoais"
          onConfirmar={() => anonimizar.mutate()}
          onFechar={() => setApagar(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

export default function Clientes() {
  const [busca, setBusca] = useState("")
  const buscaAdiada = useDeferredValue(busca.trim())
  const [filtro, setFiltro] = useState<"todos" | "sumidos">("todos")
  const [ficha, setFicha] = useState<number | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [formAberto, setFormAberto] = useState(false)

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes", "lista", buscaAdiada],
    queryFn: () => api<Cliente[]>(`/clientes${buscaAdiada ? `?busca=${encodeURIComponent(buscaAdiada)}` : ""}`),
    placeholderData: (anterior) => anterior,
  })

  const sumidos = clientes.filter((c) => c.visitas > 0 && !c.proximo_horario && (diasDesde(c.ultima_visita) ?? 0) >= DIAS_SUMIDO)
  const lista = filtro === "sumidos" ? sumidos : clientes

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-9" aria-label="Buscar cliente" />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as "todos" | "sumidos")}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="sumidos">Sumidos {sumidos.length > 0 && <Badge variant="secondary" className="ml-1.5">{sumidos.length}</Badge>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => { setEditando(null); setFormAberto(true) }}>
          <Plus aria-hidden /> Novo cliente
        </Button>
      </div>

      {filtro === "sumidos" && (
        <p className="mb-4 text-sm text-muted-foreground">
          Clientes que não voltam há mais de {DIAS_SUMIDO} dias e não têm horário marcado. Uma mensagem no WhatsApp costuma trazer de volta.
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <Users className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {busca ? "Nenhum cliente encontrado" : filtro === "sumidos" ? "Nenhum cliente sumido" : "Nenhum cliente ainda"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {busca ? "Confira o nome ou busque pelo telefone." : filtro === "sumidos" ? "Seus clientes estão voltando em dia." : "Quem agendar pelo seu link aparece aqui automaticamente."}
          </p>
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Cliente</TableHead>
                <TableHead>Visitas</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead className="hidden md:table-cell">Total gasto</TableHead>
                <TableHead className="hidden md:table-cell">Próximo horário</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((c) => {
                const dias = diasDesde(c.ultima_visita)
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setFicha(c.id)}>
                    <TableCell className="pl-5">
                      <span className="font-medium">{c.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{fone(c.phone)}</span>
                    </TableCell>
                    <TableCell className="tabular">{c.visitas}</TableCell>
                    <TableCell>
                      {c.ultima_visita ? (
                        <>
                          {dataBR(c.ultima_visita)}
                          <span className="block text-xs text-muted-foreground">há {dias} dia{dias === 1 ? "" : "s"}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular md:table-cell">{moeda(c.total_gasto)}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.proximo_horario ? dataBR(c.proximo_horario) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" aria-label={`Chamar ${c.name} no WhatsApp`}>
                          <MessageCircle aria-hidden />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <FichaCliente id={ficha} onFechar={() => setFicha(null)} onEditar={(c) => { setEditando(c); setFormAberto(true) }} />
      <FormCliente cliente={editando} aberto={formAberto} onFechar={() => setFormAberto(false)} />
    </div>
  )
}
