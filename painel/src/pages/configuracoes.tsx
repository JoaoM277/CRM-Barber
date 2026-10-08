import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Copy, ExternalLink, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Confirmar } from "@/components/confirmar"
import { useExpediente } from "@/hooks/use-cadastros"
import { useBarbearia, useMe } from "@/hooks/use-sessao"
import { api, ApiError } from "@/lib/api"
import { linkAgendamento } from "@/lib/format"
import type { Expediente } from "@/lib/types"

const erroDe = (e: unknown) => (e instanceof ApiError && e.errors ? Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])) : {})

/* ------------------------------------------------------------------ barbearia */
function AbaBarbearia() {
  const qc = useQueryClient()
  const { data: b, isLoading } = useBarbearia()
  const [f, setF] = useState({ name: "", subtitle: "", slug: "", whatsapp: "", instagram: "", city: "", state: "", accent_color: "#C89B3C", secondary_color: "#C89B3C" })
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!b) return
    const x = b as typeof b & { whatsapp?: string | null; instagram?: string | null }
    setF({
      name: b.name ?? "", subtitle: b.subtitle ?? "", slug: b.slug ?? "", whatsapp: x.whatsapp ?? "", instagram: x.instagram ?? "",
      city: b.city ?? "", state: b.state ?? "", accent_color: b.accent_color ?? "#C89B3C", secondary_color: b.secondary_color ?? b.accent_color ?? "#C89B3C",
    })
  }, [b])

  const salvar = useMutation({
    mutationFn: () => api(`/barbearias/${b!.id}`, {
      method: "PUT",
      body: { ...f, state: f.state.toUpperCase() || null, subtitle: f.subtitle || null, whatsapp: f.whatsapp || null, instagram: f.instagram || null, city: f.city || null },
    }),
    onSuccess: () => {
      setErros({})
      qc.invalidateQueries({ queryKey: ["barbearia"] })
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Dados da barbearia salvos.")
    },
    onError: (e) => {
      setErros(erroDe(e))
      toast.error(e.message)
    },
  })

  if (isLoading || !b) return <Skeleton className="h-96 w-full rounded-xl" />

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)
  const link = linkAgendamento(f.slug || b.slug)
  const mudouLink = f.slug !== b.slug

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Seu link de agendamento</CardTitle>
          <CardDescription>Coloque na bio do Instagram e mande no WhatsApp dos clientes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input readOnly value={linkAgendamento(b.slug)} className="min-w-0 flex-1 basis-64 font-mono text-sm" onFocus={(e) => e.target.select()} aria-label="Link de agendamento" />
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(linkAgendamento(b.slug)).then(() => toast.success("Link copiado."))}>
            <Copy aria-hidden /> Copiar
          </Button>
          <Button variant="outline" asChild>
            <a href={linkAgendamento(b.slug)} target="_blank" rel="noopener"><ExternalLink aria-hidden /> Abrir</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como a barbearia aparece para o cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="b-nome">Nome</Label>
            <Input id="b-nome" value={f.name} onChange={set("name")} />
            {erro("name")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-sub">Frase abaixo do nome</Label>
            <Input id="b-sub" value={f.subtitle} onChange={set("subtitle")} placeholder="Ex.: Barbearia clássica desde 2015" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="b-slug">Endereço do link</Label>
            <Input id="b-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} className="font-mono" />
            <p className="text-xs text-muted-foreground">
              {mudouLink ? <span className="text-warning">Ao salvar, o link antigo para de funcionar. Novo link: {link}</span> : "Só letras minúsculas, números e hífen."}
            </p>
            {erro("slug")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-wa">WhatsApp da barbearia</Label>
            <Input id="b-wa" type="tel" value={f.whatsapp} onChange={set("whatsapp")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-ig">Instagram</Label>
            <Input id="b-ig" value={f.instagram} onChange={set("instagram")} placeholder="@suabarbearia" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-cidade">Cidade</Label>
            <Input id="b-cidade" value={f.city} onChange={set("city")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-uf">UF</Label>
            <Input id="b-uf" value={f.state} maxLength={2} onChange={set("state")} className="w-20 uppercase" />
            {erro("state")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-cor1">Cor principal</Label>
            <div className="flex items-center gap-2">
              <input id="b-cor1" type="color" value={f.accent_color} onChange={set("accent_color")} className="h-9 w-12 cursor-pointer rounded border bg-transparent" />
              <span className="font-mono text-sm text-muted-foreground">{f.accent_color}</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-cor2">Cor de apoio</Label>
            <div className="flex items-center gap-2">
              <input id="b-cor2" type="color" value={f.secondary_color} onChange={set("secondary_color")} className="h-9 w-12 cursor-pointer rounded border bg-transparent" />
              <span className="font-mono text-sm text-muted-foreground">{f.secondary_color}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar dados</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ horários */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const curta = (t: string | null) => (t ? t.slice(0, 5) : "")

function AbaHorarios() {
  const qc = useQueryClient()
  const { data: exp = [], isLoading } = useExpediente()
  const [linhas, setLinhas] = useState<Expediente[]>([])

  useEffect(() => setLinhas([...exp].sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7))), [exp])

  const salvar = useMutation({
    mutationFn: async () => {
      const mudadas = linhas.filter((l) => {
        const o = exp.find((e) => e.id === l.id)
        return o && JSON.stringify(o) !== JSON.stringify(l)
      })
      for (const l of mudadas) {
        await api(`/tempo_de_operacao/${l.id}`, {
          method: "PUT",
          body: {
            active: l.active,
            start_time: curta(l.start_time),
            end_time: curta(l.end_time),
            waiting_start: curta(l.waiting_start) || null,
            waiting_end: curta(l.waiting_end) || null,
          },
        })
      }
      await api("/onboarding/marcar", { method: "POST", body: { passo: "horarios" } }).catch(() => {})
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expediente"] })
      qc.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Horários salvos. A página de agendamento já usa os novos horários.")
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />

  const mudar = (id: number, campo: keyof Expediente, valor: string | boolean) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))

  return (
    <Card id="horarios">
      <CardHeader>
        <CardTitle>Horários de funcionamento</CardTitle>
        <CardDescription>Os clientes só conseguem marcar dentro destes horários. O almoço fica bloqueado.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        <div className="hidden grid-cols-[8rem_5rem_1fr_1fr] gap-3 px-1 pb-1 text-xs text-muted-foreground sm:grid">
          <span>Dia</span><span>Abre?</span><span>Expediente</span><span>Almoço (opcional)</span>
        </div>
        {linhas.map((l) => (
          <div key={l.id} className="grid items-center gap-3 border-t py-3 sm:grid-cols-[8rem_5rem_1fr_1fr]">
            <span className="font-medium">{DIAS[l.day_of_week]}</span>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={l.active} onCheckedChange={(v) => mudar(l.id, "active", v)} aria-label={`${DIAS[l.day_of_week]} aberto`} />
              <span className="sm:hidden">{l.active ? "Aberto" : "Fechado"}</span>
            </label>
            {l.active ? (
              <>
                <div className="flex items-center gap-2">
                  <Input type="time" value={curta(l.start_time)} onChange={(e) => mudar(l.id, "start_time", e.target.value)} aria-label={`${DIAS[l.day_of_week]}: abre às`} />
                  <span className="text-muted-foreground">às</span>
                  <Input type="time" value={curta(l.end_time)} onChange={(e) => mudar(l.id, "end_time", e.target.value)} aria-label={`${DIAS[l.day_of_week]}: fecha às`} />
                </div>
                <div className="flex items-center gap-2">
                  <Input type="time" value={curta(l.waiting_start)} onChange={(e) => mudar(l.id, "waiting_start", e.target.value)} aria-label={`${DIAS[l.day_of_week]}: almoço começa`} />
                  <span className="text-muted-foreground">às</span>
                  <Input type="time" value={curta(l.waiting_end)} onChange={(e) => mudar(l.id, "waiting_end", e.target.value)} aria-label={`${DIAS[l.day_of_week]}: almoço termina`} />
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground sm:col-span-2">Fechado</span>
            )}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar horários</Button>
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ aviso */
function AbaAviso() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["aviso"], queryFn: () => api<{ id?: number; titulo?: string; mensagem?: string; ativo?: boolean } | null>("/avisos/1") })
  const [f, setF] = useState({ titulo: "", mensagem: "", ativo: false })
  useEffect(() => {
    if (data) setF({ titulo: data.titulo ?? "", mensagem: data.mensagem ?? "", ativo: !!data.ativo })
  }, [data])

  const salvar = useMutation({
    mutationFn: () => api("/avisos/1", { method: "PUT", body: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aviso"] })
      toast.success(f.ativo ? "Aviso publicado na página de agendamento." : "Aviso salvo (desligado).")
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aviso na página de agendamento</CardTitle>
        <CardDescription>Aparece para o cliente ao abrir o seu link. Ex.: feriado, mudança de horário, promoção.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="flex items-center gap-3">
          <Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} />
          <span className="font-medium">{f.ativo ? "Mostrando o aviso" : "Aviso desligado"}</span>
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="a-tit">Título</Label>
          <Input id="a-tit" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Fechados no feriado" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="a-msg">Mensagem</Label>
          <Textarea id="a-msg" rows={4} value={f.mensagem} onChange={(e) => setF({ ...f, mensagem: e.target.value })} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !f.titulo.trim() || !f.mensagem.trim()}>Salvar aviso</Button>
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ equipe */
type Usuario = { id: number; name: string; email: string; role: "admin" | "user" }

function AbaEquipe() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const { data: usuarios = [], isLoading } = useQuery({ queryKey: ["usuarios"], queryFn: () => api<Usuario[]>("/usuarios") })
  const [f, setF] = useState({ name: "", email: "", password: "", role: "user" })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [remover, setRemover] = useState<Usuario | null>(null)

  const criar = useMutation({
    mutationFn: () => api("/usuarios", { method: "POST", body: f }),
    onSuccess: () => {
      setF({ name: "", email: "", password: "", role: "user" })
      setErros({})
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      toast.success("Acesso criado. Passe o e-mail e a senha para a pessoa entrar.")
    },
    onError: (e) => setErros(erroDe(e)),
  })
  const apagar = useMutation({
    mutationFn: (u: Usuario) => api(`/usuarios/${u.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      toast.success("Acesso removido.")
    },
    onError: (e) => toast.error(e.message),
  })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Quem acessa o painel</CardTitle>
          <CardDescription>Administrador vê tudo (financeiro, assinatura, configurações). Equipe vê agenda, clientes e cadastros.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
            <ul className="divide-y">
              {usuarios.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{u.name}{u.id === me?.id && <span className="text-muted-foreground"> (você)</span>}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{u.role === "admin" ? "Administrador" : "Equipe"}</span>
                  {u.id !== me?.id && (
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remover acesso de ${u.name}`} onClick={() => setRemover(u)}>
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dar acesso a alguém</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="u-nome">Nome</Label>
            <Input id="u-nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            {erro("name")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-email">E-mail</Label>
            <Input id="u-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            {erro("email")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-senha">Senha inicial</Label>
            <Input id="u-senha" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
            {erro("password")}
          </div>
          <div className="grid gap-1.5">
            <Label>Acesso</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Equipe</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            <UserPlus aria-hidden /> Criar acesso
          </Button>
        </CardFooter>
      </Card>

      <Confirmar
        aberto={!!remover}
        titulo={`Remover o acesso de ${remover?.name}?`}
        descricao="A pessoa não consegue mais entrar no painel. O histórico de ações dela continua registrado."
        acao="Remover acesso"
        onConfirmar={() => remover && apagar.mutate(remover)}
        onFechar={() => setRemover(null)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ senha */
function AbaSenha() {
  const [f, setF] = useState({ senha_atual: "", nova_senha: "", nova_senha_confirmation: "" })
  const [erros, setErros] = useState<Record<string, string>>({})
  const trocar = useMutation({
    mutationFn: () => api<{ message: string }>("/me/senha", { method: "PUT", body: f }),
    onSuccess: (r) => {
      setF({ senha_atual: "", nova_senha: "", nova_senha_confirmation: "" })
      setErros({})
      toast.success(r.message)
    },
    onError: (e) => {
      const ers = erroDe(e)
      setErros(Object.keys(ers).length ? ers : { senha_atual: e.message })
    },
  })
  const erro = (k: string) => (erros[k] ? <p className="text-sm text-destructive">{erros[k]}</p> : null)

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Trocar minha senha</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="s-atual">Senha atual</Label>
          <Input id="s-atual" type="password" autoComplete="current-password" value={f.senha_atual} onChange={(e) => setF({ ...f, senha_atual: e.target.value })} />
          {erro("senha_atual")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-nova">Nova senha</Label>
          <Input id="s-nova" type="password" autoComplete="new-password" value={f.nova_senha} onChange={(e) => setF({ ...f, nova_senha: e.target.value })} />
          {erro("nova_senha")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-conf">Repita a nova senha</Label>
          <Input id="s-conf" type="password" autoComplete="new-password" value={f.nova_senha_confirmation} onChange={(e) => setF({ ...f, nova_senha_confirmation: e.target.value })} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => trocar.mutate()} disabled={trocar.isPending || !f.senha_atual || !f.nova_senha}>Trocar senha</Button>
      </CardFooter>
    </Card>
  )
}

export default function Configuracoes() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const aba = ["barbearia", "horarios", "aviso", "equipe", "senha"].includes(hash.slice(1)) ? hash.slice(1) : "barbearia"

  return (
    <Tabs value={aba} onValueChange={(v) => navigate(`#${v}`, { replace: true })}>
      <TabsList className="mb-6 flex-wrap">
        <TabsTrigger value="barbearia">Barbearia</TabsTrigger>
        <TabsTrigger value="horarios">Horários</TabsTrigger>
        <TabsTrigger value="aviso">Aviso</TabsTrigger>
        <TabsTrigger value="equipe">Equipe</TabsTrigger>
        <TabsTrigger value="senha">Minha senha</TabsTrigger>
      </TabsList>
      <TabsContent value="barbearia"><AbaBarbearia /></TabsContent>
      <TabsContent value="horarios"><AbaHorarios /></TabsContent>
      <TabsContent value="aviso"><AbaAviso /></TabsContent>
      <TabsContent value="equipe"><AbaEquipe /></TabsContent>
      <TabsContent value="senha"><AbaSenha /></TabsContent>
    </Tabs>
  )
}
