import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Palette, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useBarbearia, useRecurso } from "@/hooks/use-sessao"
import { api, enviarArquivo } from "@/lib/api"
import { linkAgendamento } from "@/lib/format"
import { cn } from "@/lib/utils"

type Estilo = "moderno" | "classico" | "vintage" | "urbano" | "minimalista"
type Fonte = "figtree" | "bebas" | "playfair" | "oswald" | "dm-serif" | "archivo"
type Config = {
  estilo: Estilo
  fonte: Fonte
  modo: "auto" | "claro" | "escuro"
  textura: "liso" | "couro" | "madeira" | "concreto"
  boas_vindas: string | null
  sobre: string | null
  mensagem_sucesso: string | null
  mostrar_endereco: boolean
  mostrar_horarios: boolean
  capa_url: string | null
}
type Foto = { id: number; url: string; legenda: string | null; ordem: number }
type Estado = {
  pagina: Config
  galeria: Foto[]
  contato: { endereco: string | null; mapa_url: string | null; instagram: string | null; whatsapp: string | null }
  slug: string
  opcoes: { max_fotos: number }
}

/** Estilos prontos: cada um sugere fonte, fundo e modo que combinam (dá para ajustar depois). */
const ESTILOS: { id: Estilo; nome: string; descricao: string; fonte: Fonte; textura: Config["textura"]; modo: Config["modo"]; cantos: string }[] = [
  { id: "moderno", nome: "Moderno", descricao: "Limpo, arredondado e atual", fonte: "figtree", textura: "liso", modo: "auto", cantos: "rounded-2xl" },
  { id: "classico", nome: "Clássico", descricao: "Elegante, de barbearia tradicional", fonte: "playfair", textura: "couro", modo: "claro", cantos: "rounded-md" },
  { id: "vintage", nome: "Vintage", descricao: "Tons quentes, ar de barbearia raiz", fonte: "dm-serif", textura: "madeira", modo: "claro", cantos: "rounded-lg" },
  { id: "urbano", nome: "Urbano", descricao: "Escuro, reto e marcante", fonte: "bebas", textura: "concreto", modo: "escuro", cantos: "rounded-none" },
  { id: "minimalista", nome: "Minimalista", descricao: "Só o essencial, muito respiro", fonte: "archivo", textura: "liso", modo: "claro", cantos: "rounded-md" },
]

const FONTES: { id: Fonte; nome: string }[] = [
  { id: "figtree", nome: "Figtree (moderna)" },
  { id: "bebas", nome: "Bebas Neue (forte, maiúsculas)" },
  { id: "playfair", nome: "Playfair (clássica, com serifa)" },
  { id: "oswald", nome: "Oswald (condensada)" },
  { id: "dm-serif", nome: "DM Serif (vintage)" },
  { id: "archivo", nome: "Archivo (neutra)" },
]

function Opcoes<T extends string>({ valor, opcoes, onMudar, rotulo }: { valor: T; opcoes: { id: T; nome: string }[]; onMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onMudar(o.id)}
          className={cn("rounded-md border px-3 py-1.5 text-sm transition", valor === o.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {o.nome}
        </button>
      ))}
    </div>
  )
}

/** A página de agendamento de verdade num "celular", recebendo as escolhas ainda não salvas. */
function Previa({ slug, pagina }: { slug: string; pagina: object }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const ultimo = useRef(pagina)
  ultimo.current = pagina
  const src = `${location.origin}/agendar/?b=${encodeURIComponent(slug)}&preview=1`

  const enviar = () => frame.current?.contentWindow?.postMessage({ tipo: "vellis:pagina", pagina: ultimo.current }, location.origin)

  useEffect(enviar, [pagina])
  useEffect(() => {
    // a página avisa quando terminou de carregar (e pede a configuração atual)
    const ouvir = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.tipo === "vellis:pronta") enviar()
    }
    window.addEventListener("message", ouvir)
    return () => window.removeEventListener("message", ouvir)
  }, [])

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="overflow-hidden rounded-[2.5rem] border-[8px] border-foreground/90 bg-background shadow-xl">
        <iframe ref={frame} src={src} title="Pré-visualização da página de agendamento" className="h-[720px] w-full" onLoad={enviar} />
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Pré-visualização ao vivo. Agendar por aqui não marca nada.</p>
    </div>
  )
}

export default function PaginaAgendamento() {
  const qc = useQueryClient()
  const temRecurso = useRecurso("personalizacao")
  const { data: barbearia } = useBarbearia()
  const { data, isLoading } = useQuery({ queryKey: ["pagina"], queryFn: () => api<Estado>("/pagina"), enabled: temRecurso })
  const [rascunho, setRascunho] = useState<Config | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const inputCapa = useRef<HTMLInputElement>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data) setRascunho(data.pagina)
  }, [data])

  const atualizar = (r: Estado) => qc.setQueryData(["pagina"], r)
  const salvar = useMutation({
    mutationFn: (c: Config) => {
      const { capa_url: _capa, ...body } = c
      return api<Estado & { message: string }>("/pagina", { method: "PUT", body })
    },
    onSuccess: (r) => {
      atualizar(r)
      toast.success("Página salva. Já está no ar.")
    },
    onError: (e) => toast.error(e.message),
  })
  const acao = useMutation({
    mutationFn: (f: () => Promise<Estado & { message: string }>) => f(),
    onSuccess: (r) => {
      atualizar(r)
      // a capa/galeria já foram salvas; o rascunho só troca o que veio do servidor
      setRascunho((x) => (x ? { ...x, capa_url: r.pagina.capa_url } : r.pagina))
      toast.success(r.message)
    },
    onError: (e) => toast.error(e.message),
  })

  const mudou = useMemo(() => !!data && !!rascunho && JSON.stringify({ ...rascunho, capa_url: null }) !== JSON.stringify({ ...data.pagina, capa_url: null }), [data, rascunho])

  // o que a página pública receberia com o rascunho (para a pré-visualização)
  const previa = useMemo(() => {
    if (!data || !rascunho) return null
    const c = data.contato
    return {
      ...rascunho,
      endereco: rascunho.mostrar_endereco ? c.endereco : null,
      mapa_url: rascunho.mostrar_endereco ? c.mapa_url : null,
      instagram: c.instagram,
      whatsapp: c.whatsapp,
      galeria: data.galeria.map((f) => ({ id: f.id, url: f.url, legenda: f.legenda })),
    }
  }, [data, rascunho])

  if (!temRecurso) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <Palette className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Personalizar a página faz parte dos planos Pro e Premium</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Estilos prontos, fonte, foto de capa, galeria de trabalhos, "sobre" com endereço e horários, destaques nos serviços: a sua
          página com a cara da sua barbearia. No seu plano, a página usa a sua cor e a sua logo.
        </p>
        <Button asChild><Link to="/assinatura">Ver planos</Link></Button>
      </div>
    )
  }
  if (isLoading || !data || !rascunho || !previa) return <Skeleton className="h-[40rem] w-full rounded-xl" />

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setRascunho({ ...rascunho, [k]: v })
  const escolherEstilo = (e: (typeof ESTILOS)[number]) => setRascunho({ ...rascunho, estilo: e.id, fonte: e.fonte, textura: e.textura, modo: e.modo })

  const enviarCapa = (arquivo?: File) => {
    if (!arquivo) return
    acao.mutate(() => enviarArquivo<Estado & { message: string }>("/pagina/capa", arquivo))
    if (inputCapa.current) inputCapa.current.value = ""
  }
  const enviarFotos = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return
    setEnviandoFoto(true)
    try {
      let ultimo: Estado | null = null
      for (const a of Array.from(arquivos).slice(0, data.opcoes.max_fotos - data.galeria.length)) {
        ultimo = await enviarArquivo<Estado>("/pagina/galeria", a)
      }
      if (ultimo) atualizar(ultimo)
      toast.success("Fotos adicionadas à galeria.")
    } catch (e) {
      toast.error((e as Error).message)
      qc.invalidateQueries({ queryKey: ["pagina"] })
    } finally {
      setEnviandoFoto(false)
      if (inputFoto.current) inputFoto.current.value = ""
    }
  }
  const mover = (i: number, d: -1 | 1) => {
    const ids = data.galeria.map((f) => f.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    acao.mutate(() => api("/pagina/galeria/ordem", { method: "PUT", body: { ids } }))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estilo</CardTitle>
            <CardDescription>Um ponto de partida que combina fonte, cantos e fundo com a sua cor. Ajuste os detalhes logo abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ESTILOS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => escolherEstilo(e)}
                aria-pressed={rascunho.estilo === e.id}
                className={cn("relative grid gap-1 border p-3 text-left transition", e.cantos, rascunho.estilo === e.id ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted")}
              >
                <span className="font-semibold">{e.nome}</span>
                <span className="text-xs text-muted-foreground">{e.descricao}</span>
                {rascunho.estilo === e.id && <Check className="absolute top-2 right-2 size-4 text-primary" aria-hidden />}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Fonte dos títulos</Label>
              <Opcoes rotulo="Fonte dos títulos" valor={rascunho.fonte} opcoes={FONTES} onMudar={(v) => set("fonte", v)} />
            </div>
            <div className="grid gap-2">
              <Label>Claro ou escuro</Label>
              <Opcoes rotulo="Modo" valor={rascunho.modo} onMudar={(v) => set("modo", v)} opcoes={[{ id: "auto", nome: "Segue o celular" }, { id: "claro", nome: "Sempre claro" }, { id: "escuro", nome: "Sempre escuro" }]} />
            </div>
            <div className="grid gap-2">
              <Label>Fundo</Label>
              <Opcoes rotulo="Fundo" valor={rascunho.textura} onMudar={(v) => set("textura", v)} opcoes={[{ id: "liso", nome: "Liso" }, { id: "couro", nome: "Couro" }, { id: "madeira", nome: "Madeira" }, { id: "concreto", nome: "Concreto" }]} />
            </div>
            <p className="text-xs text-muted-foreground">
              A cor e a logo ficam em <Link to="/configuracoes" className="underline underline-offset-2">Configurações → Barbearia</Link>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foto de capa</CardTitle>
            <CardDescription>A fachada ou o salão, no topo da página. Use uma foto na horizontal; a logo fica por cima.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rascunho.capa_url ? (
              <img src={rascunho.capa_url} alt="Foto de capa atual" className="aspect-[5/2] w-full rounded-lg object-cover" />
            ) : (
              <div className="grid aspect-[5/2] w-full place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">Sem foto de capa</div>
            )}
            <div className="flex flex-wrap gap-2">
              <input ref={inputCapa} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => enviarCapa(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => inputCapa.current?.click()} disabled={acao.isPending}>
                {acao.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} {rascunho.capa_url ? "Trocar foto" : "Enviar foto"}
              </Button>
              {rascunho.capa_url && (
                <Button variant="ghost" className="text-destructive" onClick={() => acao.mutate(() => api("/pagina/capa", { method: "DELETE" }))}>
                  <Trash2 aria-hidden /> Remover
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Galeria de trabalhos</CardTitle>
            <CardDescription>Cortes e barbas que você fez. Aparece logo abaixo do topo ({data.galeria.length} de {data.opcoes.max_fotos}).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.galeria.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {data.galeria.map((f, i) => (
                  <li key={f.id} className="group relative overflow-hidden rounded-lg">
                    <img src={f.url} alt={f.legenda ?? `Foto ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1">
                      <Button size="icon" variant="ghost" className="size-7 text-white hover:bg-white/20 hover:text-white" aria-label="Mover para a esquerda" disabled={i === 0 || acao.isPending} onClick={() => mover(i, -1)}><ArrowLeft aria-hidden /></Button>
                      <Button size="icon" variant="ghost" className="size-7 text-white hover:bg-white/20 hover:text-white" aria-label="Remover foto" disabled={acao.isPending} onClick={() => acao.mutate(() => api(`/pagina/galeria/${f.id}`, { method: "DELETE" }))}><Trash2 aria-hidden /></Button>
                      <Button size="icon" variant="ghost" className="size-7 text-white hover:bg-white/20 hover:text-white" aria-label="Mover para a direita" disabled={i === data.galeria.length - 1 || acao.isPending} onClick={() => mover(i, 1)}><ArrowRight aria-hidden /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.galeria.length < data.opcoes.max_fotos && (
              <div>
                <input ref={inputFoto} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => enviarFotos(e.target.files)} />
                <Button variant="outline" onClick={() => inputFoto.current?.click()} disabled={enviandoFoto}>
                  {enviandoFoto ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} Adicionar fotos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Textos</CardTitle>
            <CardDescription>Fale do seu jeito. Em branco, a página usa o texto padrão.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pg-boas">Boas-vindas (abaixo do nome)</Label>
              <Input id="pg-boas" maxLength={140} value={rascunho.boas_vindas ?? ""} onChange={(e) => set("boas_vindas", e.target.value)} placeholder="Ex.: Bora dar um tapa no visual? Escolha seu horário." />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pg-sobre">Sobre a barbearia</Label>
              <Textarea id="pg-sobre" rows={4} maxLength={600} value={rascunho.sobre ?? ""} onChange={(e) => set("sobre", e.target.value)} placeholder="Ex.: Desde 2015 no bairro, cerveja gelada e conversa boa. Atendemos com hora marcada." />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pg-sucesso">Mensagem depois de agendar</Label>
              <Input id="pg-sucesso" maxLength={200} value={rascunho.mensagem_sucesso ?? ""} onChange={(e) => set("mensagem_sucesso", e.target.value)} placeholder="Ex.: Chegue 5 minutinhos antes. Estacionamento na rua de trás." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço e horários</CardTitle>
            <CardDescription>
              Aparecem em "Sobre a barbearia", com o botão "Como chegar". Instagram e WhatsApp viram atalhos no topo. Esses dados ficam em{" "}
              <Link to="/configuracoes" className="underline underline-offset-2">Configurações → Barbearia</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">
                Mostrar endereço e "Como chegar"
                {!data.contato.endereco && <span className="block text-xs text-muted-foreground">Endereço ainda não preenchido.</span>}
              </span>
              <Switch checked={rascunho.mostrar_endereco} onCheckedChange={(v) => set("mostrar_endereco", v)} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">Mostrar horários de funcionamento</span>
              <Switch checked={rascunho.mostrar_horarios} onCheckedChange={(v) => set("mostrar_horarios", v)} />
            </label>
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{mudou ? "Alterações ainda não salvas." : "Tudo salvo."}</p>
          {barbearia && (
            <Button variant="ghost" asChild>
              <a href={linkAgendamento(barbearia.slug)} target="_blank" rel="noopener"><ExternalLink aria-hidden /> Abrir página</a>
            </Button>
          )}
          <Button variant="outline" disabled={!mudou || salvar.isPending} onClick={() => setRascunho(data.pagina)}>Desfazer</Button>
          <Button disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate(rascunho)}>{salvar.isPending ? "Salvando…" : "Salvar e publicar"}</Button>
        </div>
      </div>

      <div className="hidden xl:block">
        <div className="sticky top-6">
          <Previa slug={data.slug} pagina={previa} />
        </div>
      </div>
    </div>
  )
}
