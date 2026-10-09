// Personalização da página (planos Pro/Premium): estilo, fonte, modo, textura,
// galeria e "sobre". Sem personalização (pagina = null) tudo fica no visual padrão.
import { useEffect, useState } from "react"
import { AtSign, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, X } from "lucide-react"
import type { Pagina } from "./lib/api"
import type { Expediente } from "./lib/horarios"

const FAMILIAS: Record<Pagina["fonte"], string> = {
  figtree: '"Figtree Variable"',
  bebas: '"Bebas Neue"',
  playfair: '"Playfair Display Variable"',
  oswald: '"Oswald Variable"',
  "dm-serif": '"DM Serif Display"',
  archivo: '"Archivo Variable"',
}

// só baixa a fonte escolhida (cada uma vira um arquivo separado no build)
const CARREGAR: Partial<Record<Pagina["fonte"], () => Promise<unknown>>> = {
  bebas: () => import("@fontsource/bebas-neue/latin.css"),
  playfair: () => import("@fontsource-variable/playfair-display/wght.css"),
  oswald: () => import("@fontsource-variable/oswald/wght.css"),
  "dm-serif": () => import("@fontsource/dm-serif-display/latin.css"),
  archivo: () => import("@fontsource-variable/archivo/wght.css"),
}

/** Aplica estilo, fonte, modo e textura na página inteira (atributos no <html>). */
export function usePagina(p: Pagina | null | undefined) {
  useEffect(() => {
    const html = document.documentElement
    if (!p) {
      ;["estilo", "fonte", "modo", "textura"].forEach((k) => html.removeAttribute(`data-${k}`))
      html.style.removeProperty("--fonte-titulo")
      return
    }
    html.dataset.estilo = p.estilo
    html.dataset.fonte = p.fonte
    html.dataset.modo = p.modo
    html.dataset.textura = p.textura
    CARREGAR[p.fonte]?.().catch(() => {})
    html.style.setProperty("--fonte-titulo", `${FAMILIAS[p.fonte] ?? FAMILIAS.figtree}, system-ui, sans-serif`)
  }, [p])
}

/**
 * Pré-visualização do painel: a página roda num iframe (?preview=1) e recebe as
 * escolhas ainda não salvas por postMessage (mesma origem).
 */
export const emPrevia = new URLSearchParams(location.search).get("preview") === "1"

export function usePreviaDoPainel(): Pagina | null {
  const [previa, setPrevia] = useState<Pagina | null>(null)
  useEffect(() => {
    if (!emPrevia) return
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.tipo !== "vellis:pagina") return
      setPrevia(e.data.pagina as Pagina)
    }
    window.addEventListener("message", ouvir)
    window.parent?.postMessage({ tipo: "vellis:pronta" }, location.origin)
    return () => window.removeEventListener("message", ouvir)
  }, [])
  return previa
}

/** Atalhos de contato logo abaixo do cabeçalho. */
export function Contatos({ p }: { p: Pagina }) {
  const itens = [
    p.mapa_url && { href: p.mapa_url, rotulo: "Como chegar", Icone: MapPin },
    p.instagram && { href: p.instagram, rotulo: "Instagram", Icone: AtSign },
    p.whatsapp && { href: `https://wa.me/${p.whatsapp}`, rotulo: "WhatsApp", Icone: MessageCircle },
  ].filter(Boolean) as { href: string; rotulo: string; Icone: typeof MapPin }[]
  if (!itens.length) return null
  return (
    <nav className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Contato da barbearia">
      {itens.map(({ href, rotulo, Icone }) => (
        <a key={rotulo} href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-cartao/80 px-3.5 py-1.5 text-sm font-medium backdrop-blur">
          <Icone className="size-4 text-marca" aria-hidden /> {rotulo}
        </a>
      ))}
    </nav>
  )
}

/** Fotos de trabalhos: faixa rolável; toque abre em tela cheia. */
export function Galeria({ fotos }: { fotos: Pagina["galeria"] }) {
  const [aberta, setAberta] = useState<number | null>(null)
  useEffect(() => {
    if (aberta === null) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(null)
      if (e.key === "ArrowRight") setAberta((i) => (i === null ? i : (i + 1) % fotos.length))
      if (e.key === "ArrowLeft") setAberta((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length))
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [aberta, fotos.length])

  if (!fotos.length) return null
  const atual = aberta !== null ? fotos[aberta] : null

  return (
    <section className="mb-6" aria-label="Nossos trabalhos">
      <h2 className="mb-2 text-sm font-semibold text-suave">Nossos trabalhos</h2>
      <ul className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">
        {fotos.map((f, i) => (
          <li key={f.id} className="shrink-0 snap-start">
            <button type="button" onClick={() => setAberta(i)} className="block overflow-hidden rounded-2xl" aria-label={f.legenda ? `Ver foto: ${f.legenda}` : `Ver foto ${i + 1}`}>
              <img src={f.url} alt={f.legenda ?? ""} loading="lazy" decoding="async" className="h-36 w-28 object-cover transition hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      {atual && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/90 p-4" role="dialog" aria-modal aria-label="Foto da galeria" onClick={() => setAberta(null)}>
          <img src={atual.url} alt={atual.legenda ?? ""} className="max-h-[80dvh] max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          {atual.legenda && <p className="absolute bottom-6 inset-x-6 text-center text-sm text-white/90">{atual.legenda}</p>}
          <button type="button" onClick={() => setAberta(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white" aria-label="Fechar"><X className="size-6" /></button>
          {fotos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAberta((aberta! - 1 + fotos.length) % fotos.length) }} className="absolute left-2 rounded-full bg-white/10 p-2 text-white" aria-label="Foto anterior"><ChevronLeft className="size-6" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setAberta((aberta! + 1) % fotos.length) }} className="absolute right-2 rounded-full bg-white/10 p-2 text-white" aria-label="Próxima foto"><ChevronRight className="size-6" /></button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** "Sobre a barbearia": apresentação, endereço e horários (recolhível). */
export function Sobre({ p, expediente }: { p: Pagina; expediente: Expediente[] }) {
  const horarios = p.mostrar_horarios ? [1, 2, 3, 4, 5, 6, 0].map((d) => expediente.find((e) => e.day_of_week === d)).filter(Boolean) as Expediente[] : []
  if (!p.sobre && !p.endereco && !horarios.length) return null
  return (
    <details className="group mt-8 rounded-2xl border border-linha bg-cartao p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        Sobre a barbearia <ChevronRight className="size-5 text-suave transition group-open:rotate-90" aria-hidden />
      </summary>
      <div className="mt-3 grid gap-4 text-sm">
        {p.sobre && <p className="whitespace-pre-line text-suave">{p.sobre}</p>}
        {p.endereco && (
          <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-marca" aria-hidden />
            {p.mapa_url ? <a href={p.mapa_url} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">{p.endereco}</a> : p.endereco}
          </p>
        )}
        {horarios.length > 0 && (
          <div className="flex gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-marca" aria-hidden />
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {horarios.map((h) => (
                <div key={h.day_of_week} className="contents">
                  <dt className="text-suave">{DIAS[h.day_of_week]}</dt>
                  <dd className="tabular">{h.active ? `${h.start_time}–${h.end_time}` : "Fechado"}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </details>
  )
}
