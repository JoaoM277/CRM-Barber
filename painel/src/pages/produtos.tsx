import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { History, Package, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Confirmar } from "@/components/confirmar"
import { useProdutos } from "@/hooks/use-cadastros"
import { useRecurso } from "@/hooks/use-sessao"
import { api, ApiError } from "@/lib/api"
import { dataBR, moeda } from "@/lib/format"
import type { Produto } from "@/lib/types"

const num = (v: string) => Number(v.replace(",", "."))
const invalidar = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ["produtos"] })

/* ------------------------------------------------------------------ cadastro */
type Form = { name: string; price: string; cost: string; stock: string; stock_min: string; commission_percent: string }
const vazio: Form = { name: "", price: "", cost: "", stock: "0", stock_min: "", commission_percent: "0" }

function FormProduto({ produto, aberto, onFechar }: { produto: Produto | null; aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<Form>(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [ultimo, setUltimo] = useState<Produto | null | undefined>(undefined)

  if (aberto && ultimo !== produto) {
    setUltimo(produto)
    setErros({})
    setF(produto
      ? { name: produto.name, price: String(Number(produto.price)), cost: produto.cost != null ? String(Number(produto.cost)) : "", stock: String(produto.stock), stock_min: produto.stock_min != null ? String(produto.stock_min) : "", commission_percent: String(Number(produto.commission_percent)) }
      : vazio)
  }
  if (!aberto && ultimo !== undefined) setUltimo(undefined)

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        price: num(f.price),
        cost: f.cost.trim() ? num(f.cost) : null,
        stock_min: f.stock_min.trim() ? Number(f.stock_min) : null,
        commission_percent: num(f.commission_percent || "0"),
      }
      return produto ? api(`/produtos/${produto.id}`, { method: "PUT", body }) : api("/produtos", { method: "POST", body: { ...body, stock: Number(f.stock || 0) } })
    },
    onSuccess: () => {
      invalidar(qc)
      toast.success(produto ? "Produto atualizado." : "Produto cadastrado.")
      onFechar()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.errors) setErros(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else toast.error(e.message)
    },
  })

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Vendido junto com o atendimento, na agenda.</DialogDescription>
        </DialogHeader>
        <form id="form-produto" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
          <div className="grid gap-1.5">
            <Label htmlFor="p-nome">Nome</Label>
            <Input id="p-nome" value={f.name} onChange={set("name")} placeholder="Ex.: Pomada modeladora" required />
            {erro("name")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="p-preco">Preço de venda (R$)</Label>
              <Input id="p-preco" inputMode="decimal" value={f.price} onChange={set("price")} placeholder="39,90" required />
              {erro("price")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-custo">Custo (opcional)</Label>
              <Input id="p-custo" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="18,00" />
              {erro("cost")}
            </div>
            {!produto && (
              <div className="grid gap-1.5">
                <Label htmlFor="p-estoque">Estoque atual</Label>
                <Input id="p-estoque" type="number" value={f.stock} onChange={set("stock")} />
                {erro("stock")}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="p-min">Avisar com (un.)</Label>
              <Input id="p-min" type="number" min={0} value={f.stock_min} onChange={set("stock_min")} placeholder="Ex.: 3" />
              {erro("stock_min")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-com">Comissão do profissional (%)</Label>
              <Input id="p-com" inputMode="decimal" value={f.commission_percent} onChange={set("commission_percent")} />
              {erro("commission_percent")}
            </div>
          </div>
          {produto && <p className="text-xs text-muted-foreground">O estoque muda pela entrada de mercadoria ou pelo ajuste, para ficar no histórico.</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-produto" disabled={salvar.isPending}>{produto ? "Salvar alterações" : "Cadastrar produto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ estoque */
type Movimento = { id: number; quantidade: number; motivo: string; observacao: string | null; usuario: string | null; em: string }
const MOTIVO: Record<string, string> = { venda: "Venda", estorno: "Devolvido (atendimento alterado/cancelado)", entrada: "Entrada", ajuste: "Ajuste" }

function Estoque({ produto, onFechar }: { produto: Produto | null; onFechar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = useState<"entrada" | "ajuste">("entrada")
  const [qtd, setQtd] = useState("")
  const [obs, setObs] = useState("")
  const { data: historico = [] } = useQuery({
    queryKey: ["produtos", "movimentos", produto?.id],
    queryFn: () => api<Movimento[]>(`/produtos/${produto!.id}/movimentos`),
    enabled: !!produto,
  })

  const salvar = useMutation({
    mutationFn: () => api<{ message: string }>(`/produtos/${produto!.id}/estoque`, { method: "POST", body: { motivo, quantidade: Number(qtd), observacao: obs.trim() || null } }),
    onSuccess: (r) => {
      invalidar(qc)
      toast.success(r.message)
      setQtd("")
      setObs("")
    },
    onError: (e) => toast.error(e.message),
  })

  const valido = Number.isInteger(Number(qtd)) && Number(qtd) !== 0 && (motivo === "ajuste" || Number(qtd) > 0)

  return (
    <Dialog open={!!produto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estoque · {produto?.name}</DialogTitle>
          <DialogDescription>Saldo atual: <strong className="text-foreground">{produto?.stock ?? 0} un.</strong></DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (valido) salvar.mutate() }}>
          <Tabs value={motivo} onValueChange={(v) => setMotivo(v as "entrada" | "ajuste")}>
            <TabsList>
              <TabsTrigger value="entrada">Entrada de mercadoria</TabsTrigger>
              <TabsTrigger value="ajuste">Ajuste (contagem)</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="e-qtd">{motivo === "entrada" ? "Quantidade" : "+ ou − un."}</Label>
              <Input id="e-qtd" type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder={motivo === "entrada" ? "12" : "-2"} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-obs">Observação (opcional)</Label>
              <Input id="e-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder={motivo === "entrada" ? "Ex.: compra do fornecedor" : "Ex.: contagem do mês"} />
            </div>
          </div>
          <Button type="submit" className="justify-self-start" disabled={!valido || salvar.isPending}>Registrar</Button>
        </form>
        {historico.length > 0 && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border">
            <Table>
              <TableBody>
                {historico.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{dataBR(m.em)}</TableCell>
                    <TableCell className="text-sm">{MOTIVO[m.motivo] ?? m.motivo}{m.observacao ? ` · ${m.observacao}` : ""}</TableCell>
                    <TableCell className={`text-right tabular font-medium ${m.quantidade < 0 ? "text-destructive" : "text-success"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ página */
export default function Produtos() {
  const qc = useQueryClient()
  const temRecurso = useRecurso("financeiro")
  const { data: produtos = [], isLoading } = useProdutos(false, temRecurso)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [estoque, setEstoque] = useState<Produto | null>(null)
  const [excluir, setExcluir] = useState<Produto | null>(null)

  const alternar = useMutation({
    mutationFn: (p: Produto) => api(`/produtos/${p.id}`, { method: "PUT", body: { active: !p.active } }),
    onSuccess: (_r, p) => {
      invalidar(qc)
      toast.success(p.active ? "Produto fora da venda." : "Produto de volta à venda.")
    },
    onError: (e) => toast.error(e.message),
  })
  const remover = useMutation({
    mutationFn: (p: Produto) => api(`/produtos/${p.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidar(qc)
      toast.success("Produto excluído. As vendas antigas continuam no financeiro.")
    },
    onError: (e) => toast.error(e.message),
  })

  if (!temRecurso) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <Package className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">A venda de produtos faz parte do plano Pro</p>
        <p className="max-w-md text-sm text-muted-foreground">Pomadas, óleos e bebidas vendidos junto com o atendimento, com estoque e comissão do profissional.</p>
        <Button asChild><Link to="/assinatura">Ver planos</Link></Button>
      </div>
    )
  }

  const baixos = produtos.filter((p) => p.active && p.estoque_baixo).length
  const abrirNovo = () => { setEditando(null); setFormAberto(true) }
  const atualEstoque = estoque ? produtos.find((p) => p.id === estoque.id) ?? estoque : null

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Vendidos na agenda, junto com o atendimento.
          {baixos > 0 && <span className="ml-2 font-medium text-warning">{baixos} com estoque baixo.</span>}
        </p>
        <Button onClick={abrirNovo}><Plus aria-hidden /> Novo produto</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <Package className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum produto cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Cadastre o que você vende no balcão. Na agenda, é só adicionar o produto ao atendimento.</p>
          <Button onClick={abrirNovo}>Cadastrar o primeiro</Button>
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Produto</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>À venda</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow key={p.id} className={p.active ? "" : "text-muted-foreground"}>
                  <TableCell className="pl-5 font-medium">
                    {p.name}
                    {p.cost != null && Number(p.cost) > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">Custo {moeda(p.cost)} · margem {moeda(Number(p.price) - Number(p.cost))}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular">{moeda(p.price)}</TableCell>
                  <TableCell>
                    <span className="tabular">{p.stock} un.</span>
                    {p.stock < 0 ? (
                      <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">Negativo: confira</Badge>
                    ) : p.estoque_baixo && (
                      <Badge variant="outline" className="ml-2 border-warning/50 bg-warning/10 text-warning">Baixo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular">{Number(p.commission_percent)}%</TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => alternar.mutate(p)} aria-label={`${p.name} à venda`} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Estoque de ${p.name}`} onClick={() => setEstoque(p)}>
                      {p.estoque_baixo ? <PackagePlus aria-hidden /> : <History aria-hidden />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => { setEditando(p); setFormAberto(true) }}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${p.name}`} className="text-destructive hover:text-destructive" onClick={() => setExcluir(p)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <FormProduto produto={editando} aberto={formAberto} onFechar={() => setFormAberto(false)} />
      <Estoque produto={atualEstoque} onFechar={() => setEstoque(null)} />
      <Confirmar
        aberto={!!excluir}
        titulo={`Excluir ${excluir?.name ?? "produto"}?`}
        descricao="Ele some da venda. As vendas já feitas continuam no financeiro."
        acao="Excluir"
        onConfirmar={() => excluir && remover.mutate(excluir)}
        onFechar={() => setExcluir(null)}
      />
    </div>
  )
}
