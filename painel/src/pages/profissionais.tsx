import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, Trash2, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Confirmar } from "@/components/confirmar"
import { EnviarImagem } from "@/components/enviar-imagem"
import { useProfissionais } from "@/hooks/use-cadastros"
import { useMe, useRecurso } from "@/hooks/use-sessao"
import { api, ApiError } from "@/lib/api"
import { fone, moeda } from "@/lib/format"
import type { Profissional } from "@/lib/types"

const PAGAMENTO: Record<string, string> = {
  comissao: "Comissão",
  fixo: "Salário fixo",
  comissao_mais_fixo: "Comissão + fixo",
}

type Form = { name: string; phone: string; speciality: string; payment_type: string; commission_percent: string; fixed_salary: string; pix_key: string; bio: string; instagram: string }

const deProf = (p: Profissional | null): Form => ({
  name: p?.name ?? "",
  phone: fone(p?.phone),
  speciality: p?.speciality ?? "",
  payment_type: p?.payment_type ?? "comissao",
  commission_percent: p?.commission_percent != null ? String(Number(p.commission_percent)) : "40",
  fixed_salary: p?.fixed_salary != null ? String(Number(p.fixed_salary)) : "",
  pix_key: p?.pix_key ?? "",
  bio: p?.bio ?? "",
  instagram: p?.instagram ?? "",
})

function resumoPagamento(p: Profissional) {
  const pct = Number(p.commission_percent ?? 0)
  const fixo = Number(p.fixed_salary ?? 0)
  if (p.payment_type === "fixo") return `Fixo de ${moeda(fixo)}`
  if (p.payment_type === "comissao_mais_fixo") return `${pct}% + ${moeda(fixo)} fixo`
  return `${pct}% de comissão`
}

function FormProfissional({ prof, aberto, onFechar }: { prof: Profissional | null; aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const [f, setF] = useState<Form>(deProf(null))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [limite, setLimite] = useState("")

  useEffect(() => {
    if (aberto) {
      setF(deProf(prof))
      setErros({})
      setLimite("")
    }
  // reinicia só ao abrir ou trocar de profissional (não quando a foto é atualizada)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, prof?.id])

  const personaliza = useRecurso("personalizacao")
  const comComissao = f.payment_type !== "fixo"
  const comFixo = f.payment_type !== "comissao"

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        phone: f.phone,
        speciality: f.speciality.trim() || null,
        payment_type: f.payment_type,
        commission_percent: comComissao ? Number(f.commission_percent || 0) : 0,
        fixed_salary: comFixo ? Number((f.fixed_salary || "0").replace(",", ".")) : 0,
        pix_key: f.pix_key.trim() || null,
        ...(personaliza ? { bio: f.bio.trim() || null, instagram: f.instagram.trim() || null } : {}),
      }
      return prof ? api(`/profissionais/${prof.id}`, { method: "PUT", body }) : api("/profissionais", { method: "POST", body: { ...body, active: true } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profissionais"] })
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success(prof ? "Profissional atualizado." : "Profissional cadastrado.")
      onFechar()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "plan_limit") setLimite(e.message)
      else if (e instanceof ApiError && e.errors) setErros(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else toast.error(e.message)
    },
  })

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{prof ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          <DialogDescription>O cliente escolhe o profissional na hora de agendar.</DialogDescription>
        </DialogHeader>
        <form id="form-prof" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
          {prof ? (
            <EnviarImagem
              atual={prof.photo}
              rotulo="Foto"
              inicial={prof.name.slice(0, 1).toUpperCase()}
              enviarPara={`/profissionais/${prof.id}/foto`}
              removerEm={`/profissionais/${prof.id}/foto`}
              onMudou={() => qc.invalidateQueries({ queryKey: ["profissionais"] })}
              redonda
            />
          ) : (
            <p className="text-xs text-muted-foreground">Depois de cadastrar, você pode colocar uma foto (aparece na página de agendamento).</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="p-nome">Nome</Label>
              <Input id="p-nome" value={f.name} onChange={set("name")} required />
              {erro("name")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-tel">Telefone</Label>
              <Input id="p-tel" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="(11) 99999-9999" required />
              {erro("phone")}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-esp">Especialidade (opcional)</Label>
            <Input id="p-esp" value={f.speciality} onChange={set("speciality")} placeholder="Ex.: Degradê e barba" />
          </div>
          {personaliza && (
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <div className="grid gap-1.5">
                <Label htmlFor="p-bio">Sobre (aparece na página de agendamento)</Label>
                <Input id="p-bio" maxLength={160} value={f.bio} onChange={set("bio")} placeholder="Ex.: 10 anos de navalha, especialista em barba" />
                {erro("bio")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-ig">Instagram</Label>
                <Input id="p-ig" maxLength={60} value={f.instagram} onChange={set("instagram")} placeholder="@usuario" />
                {erro("instagram")}
              </div>
            </div>
          )}

          <fieldset className="grid gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Pagamento</legend>
            <div className="grid gap-1.5">
              <Label>Como recebe</Label>
              <Select value={f.payment_type} onValueChange={(v) => setF({ ...f, payment_type: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAGAMENTO).map(([v, t]) => (
                    <SelectItem key={v} value={v}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {comComissao && (
                <div className="grid gap-1.5">
                  <Label htmlFor="p-com">Comissão (%)</Label>
                  <Input id="p-com" type="number" min={0} max={100} value={f.commission_percent} onChange={set("commission_percent")} />
                  {erro("commission_percent")}
                </div>
              )}
              {comFixo && (
                <div className="grid gap-1.5">
                  <Label htmlFor="p-fixo">Fixo mensal (R$)</Label>
                  <Input id="p-fixo" inputMode="decimal" value={f.fixed_salary} onChange={set("fixed_salary")} placeholder="0,00" />
                  {erro("fixed_salary")}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-pix">Chave Pix (opcional)</Label>
              <Input id="p-pix" value={f.pix_key} onChange={set("pix_key")} />
            </div>
          </fieldset>

          {limite && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {limite}{" "}
              {me?.role === "admin" && (
                <Link to="/assinatura" className="font-medium underline" onClick={onFechar}>
                  Ver planos
                </Link>
              )}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-prof" disabled={salvar.isPending}>
            {prof ? "Salvar alterações" : "Cadastrar profissional"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Profissionais() {
  const qc = useQueryClient()
  const { data: profs = [], isLoading } = useProfissionais()
  const { data: me } = useMe()
  const [params, setParams] = useSearchParams()
  const [editando, setEditando] = useState<Profissional | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [excluir, setExcluir] = useState<Profissional | null>(null)
  const limite = me?.assinatura?.plano?.max_profissionais ?? null

  // vindo do guia de primeiros passos (?novo=1)
  useEffect(() => {
    if (params.has("novo")) {
      setEditando(null)
      setFormAberto(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const alternar = useMutation({
    mutationFn: (p: Profissional) => api(`/profissionais/${p.id}`, { method: "PUT", body: { active: !p.active } }),
    onSuccess: (_r, p) => {
      qc.invalidateQueries({ queryKey: ["profissionais"] })
      toast.success(p.active ? `${p.name} não aparece mais para agendamento.` : `${p.name} voltou para a agenda.`)
    },
    onError: (e) => toast.error(e.message),
  })
  const remover = useMutation({
    mutationFn: (p: Profissional) => api(`/profissionais/${p.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profissionais"] })
      toast.success("Profissional excluído.")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Quem atende na barbearia.
          {limite !== null && ` Seu plano permite até ${limite}.`}
        </p>
        <Button onClick={() => { setEditando(null); setFormAberto(true) }}>
          <Plus aria-hidden /> Novo profissional
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : profs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <UserRound className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum profissional cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Cadastre quem atende (inclusive você) para a agenda e a página de agendamento funcionarem.</p>
          <Button onClick={() => { setEditando(null); setFormAberto(true) }}>Cadastrar o primeiro</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profs.map((p) => (
            <Card key={p.id} className={p.active ? "" : "opacity-70"}>
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.speciality || fone(p.phone)}</p>
                  </div>
                </div>
                <p className="text-sm">{resumoPagamento(p)}</p>
                <div className="flex items-center justify-between border-t pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={p.active} onCheckedChange={() => alternar.mutate(p)} />
                    {p.active ? "Atendendo" : "Pausado"}
                  </label>
                  <div>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => { setEditando(p); setFormAberto(true) }}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${p.name}`} className="text-destructive hover:text-destructive" onClick={() => setExcluir(p)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormProfissional prof={(editando && profs.find((x) => x.id === editando.id)) ?? editando} aberto={formAberto} onFechar={() => setFormAberto(false)} />
      <Confirmar
        aberto={!!excluir}
        titulo={`Excluir ${excluir?.name}?`}
        descricao="Ele sai da agenda e da página de agendamento. Os atendimentos e comissões antigos continuam no histórico. Para só pausar, use a chave do cartão."
        acao="Excluir profissional"
        onConfirmar={() => excluir && remover.mutate(excluir)}
        onFechar={() => setExcluir(null)}
      />
    </div>
  )
}
