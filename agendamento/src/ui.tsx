// Peças comuns da página de agendamento e da tela "meu horário"
import { useEffect } from "react"
import { MapPin } from "lucide-react"
import clsx from "clsx"
import type { Identidade } from "./lib/api"
import { deISO, isoLocal, minutos, type Horario } from "./lib/horarios"

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
export function useMarca(id: Identidade | undefined, titulo: string) {
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

export function Cabecalho({ id }: { id: Identidade }) {
  return (
    <header className="px-5 pt-8 pb-6 text-center">
      {id.logo_url ? (
        <img src={id.logo_url} alt="" className="mx-auto mb-3 size-16 rounded-2xl object-cover" />
      ) : (
        <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-marca text-2xl font-bold text-sobre-marca" aria-hidden>
          {id.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <h1 className="text-2xl font-bold tracking-tight">{id.name}</h1>
      {id.subtitle && id.subtitle !== "BARBEARIA" && <p className="mt-0.5 text-suave">{id.subtitle}</p>}
      {id.city && (
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-suave">
          <MapPin className="size-3.5" aria-hidden /> {id.city}{id.state ? ` · ${id.state}` : ""}
        </p>
      )}
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

/** Fita de dias + grade de horários livres (manhã / tarde / noite). */
export function SeletorHorario({ dias, livresPorDia, data, horario, onData, onHorario }: {
  dias: string[]
  livresPorDia: Record<string, Horario[]>
  data: string | null
  horario: Horario | null
  onData: (d: string) => void
  onHorario: (h: Horario) => void
}) {
  return (
    <>
      <div className="-mx-5 mb-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label="Dia">
        {dias.map((d) => {
          const vagas = livresPorDia[d]?.length ?? 0
          const dt = deISO(d)
          const sel = d === data
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={sel}
              disabled={!vagas}
              onClick={() => onData(d)}
              className={clsx(
                "flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition",
                sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao",
                !vagas && "opacity-35",
              )}
              aria-label={`${dataLonga(d)}${vagas ? `, ${vagas} horários` : ", sem horários"}`}
            >
              <span className="text-[11px] uppercase">{d === isoLocal(new Date()) ? "Hoje" : dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
              <span className="text-xl font-bold leading-tight">{dt.getDate()}</span>
              <span className="text-[11px]">{dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            </button>
          )
        })}
      </div>

      {data && (livresPorDia[data]?.length ? (
        (["Manhã", "Tarde", "Noite"] as const).map((periodo) => {
          const lista = livresPorDia[data].filter((h) => {
            const m = minutos(h.hora)
            return periodo === "Manhã" ? m < 720 : periodo === "Tarde" ? m >= 720 && m < 1080 : m >= 1080
          })
          if (!lista.length) return null
          return (
            <div key={periodo} className="mb-5">
              <h3 className="mb-2 text-sm font-semibold text-suave">{periodo}</h3>
              <div className="grid grid-cols-4 gap-2">
                {lista.map((h) => {
                  const sel = horario?.hora === h.hora
                  return (
                    <button
                      key={h.hora}
                      type="button"
                      onClick={() => onHorario(h)}
                      aria-pressed={sel}
                      className={clsx("rounded-xl border py-2.5 font-semibold tabular transition", sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}
                    >
                      {h.hora}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      ) : (
        <p className="rounded-2xl border border-dashed border-linha p-6 text-center text-suave">Nenhum horário livre neste dia. Escolha outro dia acima.</p>
      ))}
    </>
  )
}
