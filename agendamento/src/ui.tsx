// Peças comuns da página de agendamento e da tela "meu horário"
import { useEffect, useState } from "react"
import { MapPin } from "lucide-react"
import clsx from "clsx"
import type { Identidade } from "./lib/api"
import { deISO, isoLocal, minutos } from "./lib/horarios"
import { Contatos } from "./pagina"

export const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
export const dataLonga = (iso: string) => deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
const LANDING = "https://usevellis.tech/?utm_source=pagina-agendamento"

/** Texto escuro ou claro sobre a cor da marca, pelo contraste. */
function corSobre(hex: string) {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? "#15201d" : "#ffffff"
}

/** Veste a página com a marca da barbearia (cor, título, ícone da aba). */
export function useMarca(id: Pick<Identidade, "name" | "logo_url" | "accent_color"> | null | undefined, titulo: string) {
  useEffect(() => {
    if (!id) return
    const cor = /^#[0-9a-f]{3,6}$/i.test(id.accent_color) ? id.accent_color : "#c89b3c"
    document.documentElement.style.setProperty("--marca", cor)
    document.documentElement.style.setProperty("--sobre-marca", corSobre(cor))
    document.title = `${titulo} · ${id.name}`
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor)
    // ícone da aba = logo da barbearia, quando houver
    if (id.logo_url) document.querySelector('link[rel="icon"]')?.setAttribute("href", id.logo_url)
  }, [id, titulo])
}

/** Arquivo .ics para "adicionar à agenda" (funciona no iPhone e no Android). */
export function baixarIcs(titulo: string, data: string, hora: string, duracao: number, local: string) {
  const ini = deISO(data)
  ini.setHours(Math.floor(minutos(hora) / 60), minutos(hora) % 60)
  const fim = new Date(ini.getTime() + duracao * 60_000)
  const f = (d: Date) => `${isoLocal(d).replace(/-/g, "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vellis//Agendamento//PT", "BEGIN:VEVENT",
    `UID:${Date.now()}@usevellis.tech`, `DTSTART:${f(ini)}`, `DTEND:${f(fim)}`,
    `SUMMARY:${titulo}`, `LOCATION:${local}`, "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${titulo}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n")
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: "agendamento.ics" })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------------------------ marca guardada (abertura instantânea) */

type MarcaGuardada = Pick<Identidade, "name" | "logo_url" | "accent_color">
const chaveMarca = (slug: string) => `vellis_marca:${slug}`

/** Logo/cor da última visita: a tela de abertura aparece antes de a API responder. */
export function marcaGuardada(slug: string | null): MarcaGuardada | null {
  if (!slug) return null
  try { return JSON.parse(localStorage.getItem(chaveMarca(slug)) ?? "null") } catch { return null }
}

export function guardarMarca(slug: string, id: Identidade) {
  try {
    localStorage.setItem(chaveMarca(slug), JSON.stringify({ name: id.name, logo_url: id.logo_url, accent_color: id.accent_color }))
  } catch { /* modo privado: só não guarda */ }
}

/** Mantém a abertura na tela por um instante mínimo (sem "piscar" quando a API é rápida). */
export function useAberturaMinima(ms = 700) {
  const [ativa, setAtiva] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setAtiva(false), ms)
    return () => clearTimeout(t)
  }, [ms])
  return ativa
}

/** Logo da barbearia (ou a inicial), inteira e sem distorcer, com moldura na cor da marca. */
export function Logo({ id, tamanho }: { id: Pick<Identidade, "name" | "logo_url">; tamanho: "cabecalho" | "abertura" }) {
  const caixa = tamanho === "abertura" ? "size-32 rounded-[2rem] p-0.5" : "size-24 rounded-3xl p-0.5"
  return id.logo_url ? (
    <div className={clsx("mx-auto grid place-items-center bg-white shadow-lg shadow-marca/20 ring-1 ring-marca/30", caixa)}>
      <img src={id.logo_url} alt={`Logo ${id.name}`} className="size-full rounded-[inherit] object-contain" decoding="async" />
    </div>
  ) : (
    <div className={clsx("mx-auto grid place-items-center bg-marca font-bold text-sobre-marca shadow-lg shadow-marca/30 ring-1 ring-marca/30", caixa, tamanho === "abertura" ? "text-5xl" : "text-4xl")} aria-hidden>
      {id.name.slice(0, 1).toUpperCase()}
    </div>
  )
}

/** Tela de abertura: a marca da barbearia enquanto a agenda carrega. */
export function Abertura({ id }: { id: Pick<Identidade, "name" | "logo_url"> | null }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-marca/15 via-fundo to-fundo px-6" aria-busy="true" aria-live="polite">
      <div className="abertura grid justify-items-center gap-5 text-center">
        {id ? <Logo id={id} tamanho="abertura" /> : <div className="size-32 rounded-[2rem] bg-linha/60" aria-hidden />}
        {id && <p className="text-xl font-bold tracking-tight">{id.name}</p>}
        <div className="h-1 w-28 overflow-hidden rounded-full bg-linha" role="progressbar" aria-label="Carregando a agenda">
          <div className="carregando h-full w-1/3 rounded-full bg-marca" />
        </div>
      </div>
    </main>
  )
}

export function Cabecalho({ id, comContatos }: { id: Identidade; comContatos?: boolean }) {
  const p = id.pagina
  return (
    <header className={clsx("-mx-5 mb-2 text-center", p?.capa_url ? "pb-6" : "rounded-b-[2rem] bg-gradient-to-b from-marca/15 to-transparent px-5 pt-10 pb-6")}>
      {p?.capa_url && (
        // foto de capa: a logo "sobe" por cima, com degradê para o texto não brigar com a foto
        <div className="relative h-44 sm:h-52">
          <img src={p.capa_url} alt="" className="size-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-fundo" aria-hidden />
        </div>
      )}
      <div className={clsx(p?.capa_url && "relative -mt-14 px-5")}>
        <div className="mb-4">
          <Logo id={id} tamanho="cabecalho" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{id.name}</h1>
        {id.subtitle && id.subtitle !== "BARBEARIA" && <p className="mt-0.5 text-suave">{id.subtitle}</p>}
        {id.avaliacoes && (
          // nota média: no 1º passo leva até os comentários
          <a href={comContatos ? "#avaliacoes" : undefined} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium" aria-label={`Nota ${id.avaliacoes.media} de 5, ${id.avaliacoes.total} avaliações`}>
            <span className="text-amber-500" aria-hidden>★</span>
            <span className="tabular">{id.avaliacoes.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</span>
            <span className="text-suave">· {id.avaliacoes.total} {id.avaliacoes.total === 1 ? "avaliação" : "avaliações"}</span>
          </a>
        )}
        {id.city && !p?.endereco && (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-suave">
            <MapPin className="size-3.5" aria-hidden /> {id.city}{id.state ? ` · ${id.state}` : ""}
          </p>
        )}
        {p?.boas_vindas && <p className="mx-auto mt-3 max-w-sm text-balance text-texto/90">{p.boas_vindas}</p>}
        {p && comContatos && <Contatos p={p} />}
      </div>
    </header>
  )
}

export function Rodape() {
  return (
    <footer className="mt-10 text-center text-xs text-suave">
      Agenda online por{" "}
      <a href={LANDING} target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:underline">Vellis</a>
    </footer>
  )
}
