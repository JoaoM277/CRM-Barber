// Modelos de seletor de dia + horário (passo "Quando?" e remarcação).
// A barbearia escolhe no painel: Básico = faixa de dias; Pro = 5 modelos; Premium = 10.
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import clsx from "clsx"
import type { Pagina } from "./lib/api"
import { deISO, isoLocal, minutos, type Horario } from "./lib/horarios"
import { dataLonga } from "./ui"

export type ModeloHorario = NonNullable<Pagina["seletor_horarios"]>

type Props = {
  modelo?: ModeloHorario
  dias: string[]
  livresPorDia: Record<string, Horario[]>
  data: string | null
  horario: Horario | null
  onData: (d: string) => void
  onHorario: (h: Horario) => void
  /** dia aberto mas sem vaga continua clicável (para entrar na lista de espera) */
  lotadoClicavel?: (d: string) => boolean
  /** conteúdo extra quando o dia escolhido não tem vaga */
  rodapeVazio?: ReactNode
  /** nome do profissional de um horário (modelos que mostram "com Fulano") */
  nomeProf?: (id: number) => string
}

const PERIODOS = [
  { nome: "Manhã", de: 0, ate: 720 },
  { nome: "Tarde", de: 720, ate: 1080 },
  { nome: "Noite", de: 1080, ate: 1440 },
] as const
const periodoDe = (h: Horario) => PERIODOS.find((p) => minutos(h.hora) >= p.de && minutos(h.hora) < p.ate)!.nome

const hojeISO = () => isoLocal(new Date())
const amanhaISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoLocal(d) }
const semana = (d: string) => deISO(d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
const mes = (d: string) => deISO(d).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
/** "Hoje", "Amanhã" ou "qui, 9 out" */
const rotuloDia = (d: string) => (d === hojeISO() ? "Hoje" : d === amanhaISO() ? "Amanhã" : `${semana(d)}, ${deISO(d).getDate()} ${mes(d)}`)

/* --------------------------------------------------------------- peças comuns */

/** Botão de horário. */
function BotaoHora({ h, sel, onClick, pequeno, children }: { h: Horario; sel: boolean; onClick: () => void; pequeno?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={sel}
      className={clsx("rounded-xl border font-semibold tabular transition", pequeno ? "py-2 text-sm" : "py-2.5", sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}
    >
      {children ?? h.hora}
    </button>
  )
}

/** Horários de um dia em grade, separados (ou não) por manhã/tarde/noite. */
function GradeHoras({ lista, horario, onHorario, porPeriodo = true, colunas = 4, pequeno }: {
  lista: Horario[]; horario: Horario | null; onHorario: (h: Horario) => void; porPeriodo?: boolean; colunas?: 3 | 4 | 5; pequeno?: boolean
}) {
  const grade = clsx("grid gap-2", { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[colunas])
  const sel = (h: Horario) => horario?.hora === h.hora && horario?.profissionalId === h.profissionalId
  if (!porPeriodo) {
    return <div className={grade}>{lista.map((h) => <BotaoHora key={h.hora} h={h} sel={sel(h)} onClick={() => onHorario(h)} pequeno={pequeno} />)}</div>
  }
  return (
    <>
      {PERIODOS.map(({ nome }) => {
        const doPeriodo = lista.filter((h) => periodoDe(h) === nome)
        if (!doPeriodo.length) return null
        return (
          <div key={nome} className="mb-5 last:mb-0">
            <h3 className="mb-2 text-sm font-semibold text-suave">{nome}</h3>
            <div className={grade}>{doPeriodo.map((h) => <BotaoHora key={h.hora} h={h} sel={sel(h)} onClick={() => onHorario(h)} pequeno={pequeno} />)}</div>
          </div>
        )
      })}
    </>
  )
}

/** Fita de dias rolando para o lado. */
function FitaDias({ dias, livresPorDia, data, onData, lotadoClicavel, compacta }: Pick<Props, "dias" | "livresPorDia" | "data" | "onData" | "lotadoClicavel"> & { compacta?: boolean }) {
  return (
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
            disabled={!vagas && !lotadoClicavel?.(d)}
            onClick={() => onData(d)}
            className={clsx(
              "flex shrink-0 snap-start flex-col items-center border transition",
              compacta ? "w-12 rounded-xl py-1.5" : "w-16 rounded-2xl py-2.5",
              sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao",
              !vagas && "opacity-35",
            )}
            aria-label={`${dataLonga(d)}${vagas ? `, ${vagas} horários` : ", sem horários"}`}
          >
            <span className="text-[11px] uppercase">{d === hojeISO() ? "Hoje" : semana(d)}</span>
            <span className={clsx("font-bold leading-tight", compacta ? "text-base" : "text-xl")}>{dt.getDate()}</span>
            {!compacta && <span className="text-[11px]">{mes(d)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Vazio({ children }: { children?: ReactNode }) {
  return (
    <>
      <p className="rounded-2xl border border-dashed border-linha p-6 text-center text-suave">Nenhum horário livre neste dia. Escolha outro dia acima.</p>
      {children}
    </>
  )
}

/* --------------------------------------------------------------- seletor */

export function SeletorDeHorario(props: Props) {
  const { modelo = "lista", dias, livresPorDia, data, horario, onData, onHorario, lotadoClicavel, rodapeVazio, nomeProf } = props
  const doDia = data ? livresPorDia[data] ?? [] : []
  // escolher num modelo que mostra vários dias: troca o dia e o horário juntos
  const escolherEm = (d: string, h: Horario) => { if (d !== data) onData(d); onHorario(h) }
  const selEm = (d: string, h: Horario) => d === data && horario?.hora === h.hora && horario?.profissionalId === h.profissionalId

  switch (modelo) {
    case "compacta":
      return (
        <>
          <FitaDias {...props} compacta />
          {data && (doDia.length ? <GradeHoras lista={doDia} horario={horario} onHorario={onHorario} porPeriodo={false} colunas={5} pequeno /> : <Vazio>{rodapeVazio}</Vazio>)}
        </>
      )

    case "calendario":
      return <Calendario {...props} />

    case "dropdown": {
      const campo = "w-full appearance-none rounded-xl border border-linha bg-cartao px-4 py-3 pr-10 text-base outline-none focus:border-marca"
      return (
        <div className="grid gap-4">
          <label className="relative grid gap-1.5">
            <span className="text-sm font-medium">Dia</span>
            <select value={data ?? ""} onChange={(e) => onData(e.target.value)} className={campo}>
              {dias.map((d) => {
                const n = livresPorDia[d]?.length ?? 0
                return <option key={d} value={d} disabled={!n && !lotadoClicavel?.(d)}>{rotuloDia(d)}{n ? ` · ${n} horários` : " · lotado"}</option>
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 bottom-3.5 size-5 text-suave" aria-hidden />
          </label>
          {data && (doDia.length ? (
            <label className="relative grid gap-1.5">
              <span className="text-sm font-medium">Horário</span>
              <select value={horario ? `${horario.hora}|${horario.profissionalId}` : ""} onChange={(e) => { const h = doDia.find((x) => `${x.hora}|${x.profissionalId}` === e.target.value); if (h) onHorario(h) }} className={campo}>
                <option value="" disabled>Escolha o horário</option>
                {PERIODOS.map(({ nome }) => {
                  const lista = doDia.filter((h) => periodoDe(h) === nome)
                  return lista.length ? (
                    <optgroup key={nome} label={nome}>
                      {lista.map((h) => <option key={h.hora} value={`${h.hora}|${h.profissionalId}`}>{h.hora}{nomeProf ? ` · ${nomeProf(h.profissionalId)}` : ""}</option>)}
                    </optgroup>
                  ) : null
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3.5 size-5 text-suave" aria-hidden />
            </label>
          ) : <Vazio>{rodapeVazio}</Vazio>)}
        </div>
      )
    }

    case "periodos":
      return <Periodos {...props} />

    case "linha_tempo":
      return (
        <>
          <FitaDias {...props} />
          {data && (doDia.length ? (
            <ol className="relative ml-2 border-l-2 border-linha">
              {doDia.map((h) => {
                const sel = horario?.hora === h.hora && horario?.profissionalId === h.profissionalId
                return (
                  <li key={h.hora} className="relative pb-2 pl-5 last:pb-0">
                    <span className={clsx("absolute top-4 -left-[7px] size-3 rounded-full border-2 border-fundo", sel ? "bg-marca" : "bg-linha")} aria-hidden />
                    <button type="button" onClick={() => onHorario(h)} aria-pressed={sel} className={clsx("flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition", sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}>
                      <span className="text-lg font-bold tabular">{h.hora}</span>
                      <span className={clsx("text-sm", sel ? "opacity-90" : "text-suave")}>{nomeProf ? `com ${nomeProf(h.profissionalId)}` : "Disponível"}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : <Vazio>{rodapeVazio}</Vazio>)}
        </>
      )

    case "proximos":
      return <Proximos {...props} escolherEm={escolherEm} selEm={selEm} />

    case "semana":
      return (
        <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2" role="group" aria-label="Horários da semana">
          {dias.map((d) => {
            const lista = livresPorDia[d] ?? []
            return (
              <section key={d} className={clsx("w-[5.25rem] shrink-0 snap-start rounded-2xl border bg-cartao p-1.5", d === data ? "border-marca" : "border-linha")} aria-label={dataLonga(d)}>
                <p className="mb-1.5 text-center leading-tight">
                  <span className="block text-[11px] text-suave uppercase">{d === hojeISO() ? "Hoje" : semana(d)}</span>
                  <span className="text-lg font-bold">{deISO(d).getDate()}</span>
                </p>
                <div className="grid max-h-72 gap-1 overflow-y-auto">
                  {lista.length ? lista.map((h) => <BotaoHora key={h.hora} h={h} sel={selEm(d, h)} onClick={() => escolherEm(d, h)} pequeno />)
                    : <span className="py-3 text-center text-xs text-suave">{lotadoClicavel?.(d) ? <button type="button" onClick={() => onData(d)} className="underline">Lotado</button> : "—"}</span>}
                </div>
              </section>
            )
          })}
          {data && !doDia.length && rodapeVazio && <div className="w-72 shrink-0">{rodapeVazio}</div>}
        </div>
      )

    case "cartoes":
      return (
        <>
          <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
            {dias.filter((d) => (livresPorDia[d]?.length ?? 0) > 0 || lotadoClicavel?.(d)).map((d) => {
              const lista = livresPorDia[d] ?? []
              return (
                <section key={d} className={clsx("w-64 shrink-0 snap-start rounded-3xl border bg-cartao p-4", d === data ? "border-marca ring-2 ring-marca/30" : "border-linha")}>
                  <h3 className="font-bold first-letter:uppercase">{rotuloDia(d)}</h3>
                  <p className="mb-3 text-xs text-suave">{lista.length ? `${lista.length} horário${lista.length > 1 ? "s" : ""} livre${lista.length > 1 ? "s" : ""}` : "Lotado"}</p>
                  {lista.length ? (
                    <div className="grid max-h-60 grid-cols-3 gap-1.5 overflow-y-auto">
                      {lista.map((h) => <BotaoHora key={h.hora} h={h} sel={selEm(d, h)} onClick={() => escolherEm(d, h)} pequeno />)}
                    </div>
                  ) : <button type="button" onClick={() => onData(d)} className="text-sm font-medium underline">Quero este dia</button>}
                </section>
              )
            })}
          </div>
          {data && !doDia.length && rodapeVazio}
        </>
      )

    case "sanfona":
      return <SanfonaDias {...props} />

    default: // lista: faixa de dias + horários por período
      return (
        <>
          <FitaDias {...props} />
          {data && (doDia.length ? <GradeHoras lista={doDia} horario={horario} onHorario={onHorario} /> : <Vazio>{rodapeVazio}</Vazio>)}
        </>
      )
  }
}

/** Lista de dias: a seta abre e fecha os horários do dia (o dia continua escolhido). */
function SanfonaDias({ dias, livresPorDia, data, horario, onData, onHorario, lotadoClicavel, rodapeVazio }: Props) {
  const [aberto, setAberto] = useState<string | null>(data)
  // dia trocado por fora (pré-seleção do primeiro dia com vaga): abre ele
  useEffect(() => setAberto(data), [data])
  const doDia = data ? livresPorDia[data] ?? [] : []

  return (
    <>
      <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-cartao">
        {dias.map((d) => {
          const lista = livresPorDia[d] ?? []
          const estaAberto = d === aberto
          const clicavel = lista.length > 0 || lotadoClicavel?.(d)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={!clicavel}
                onClick={() => {
                  if (estaAberto) return setAberto(null)
                  if (d !== data) onData(d)
                  setAberto(d)
                }}
                aria-expanded={estaAberto}
                className={clsx("flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left", !clicavel && "opacity-40", d === data && "text-marca")}
              >
                <span className="font-semibold first-letter:uppercase">{rotuloDia(d)}</span>
                <span className="flex items-center gap-2 text-sm text-suave">
                  {lista.length ? `${lista.length} horário${lista.length > 1 ? "s" : ""}` : "lotado"}
                  <ChevronDown className={clsx("size-5 transition", estaAberto && "rotate-180")} aria-hidden />
                </span>
              </button>
              {estaAberto && lista.length > 0 && (
                <div className="px-4 pb-4"><GradeHoras lista={lista} horario={horario} onHorario={onHorario} porPeriodo={false} colunas={4} pequeno /></div>
              )}
            </li>
          )
        })}
      </ul>
      {data && aberto === data && !doDia.length && rodapeVazio}
    </>
  )
}

/** Calendário do mês (só os dias da janela de agendamento ficam clicáveis). */
function Calendario(props: Props) {
  const { dias, livresPorDia, data, horario, onData, onHorario, lotadoClicavel, rodapeVazio } = props
  const meses = useMemo(() => [...new Set(dias.map((d) => d.slice(0, 7)))], [dias])
  const [idx, setIdx] = useState(() => Math.max(0, meses.indexOf((data ?? dias[0]).slice(0, 7))))
  const mesAtual = meses[Math.min(idx, meses.length - 1)]
  const [ano, m] = mesAtual.split("-").map(Number)
  const primeiro = new Date(ano, m - 1, 1)
  const total = new Date(ano, m, 0).getDate()
  const celulas = [...Array(primeiro.getDay()).fill(null), ...Array.from({ length: total }, (_, i) => isoLocal(new Date(ano, m - 1, i + 1)))]
  const doDia = data ? livresPorDia[data] ?? [] : []

  return (
    <>
      <div className="mb-5 rounded-2xl border border-linha bg-cartao p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setIdx(idx - 1)} disabled={idx === 0} className="rounded-full p-1.5 disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="size-5" /></button>
          <p className="font-semibold capitalize">{primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          <button type="button" onClick={() => setIdx(idx + 1)} disabled={idx >= meses.length - 1} className="rounded-full p-1.5 disabled:opacity-30" aria-label="Próximo mês"><ChevronRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => <span key={i} className="py-1 text-xs font-medium text-suave">{l}</span>)}
          {celulas.map((d, i) => {
            if (!d) return <span key={`v${i}`} />
            const naJanela = dias.includes(d)
            const vagas = livresPorDia[d]?.length ?? 0
            const ativo = naJanela && (vagas > 0 || !!lotadoClicavel?.(d))
            const sel = d === data
            return (
              <button
                key={d}
                type="button"
                disabled={!ativo}
                onClick={() => onData(d)}
                aria-pressed={sel}
                aria-label={`${dataLonga(d)}${vagas ? `, ${vagas} horários` : ""}`}
                className={clsx(
                  "relative aspect-square rounded-xl text-sm font-medium transition",
                  sel ? "bg-marca text-sobre-marca" : ativo ? "hover:bg-fundo" : "text-suave/40",
                  d === hojeISO() && !sel && "ring-1 ring-marca/50",
                )}
              >
                {Number(d.slice(8))}
                {ativo && vagas > 0 && !sel && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-marca" aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>
      {data && (doDia.length ? <GradeHoras lista={doDia} horario={horario} onHorario={onHorario} /> : <Vazio>{rodapeVazio}</Vazio>)}
    </>
  )
}

/** Dia na fita + abas Manhã/Tarde/Noite. */
function Periodos(props: Props) {
  const { data, livresPorDia, horario, onHorario, rodapeVazio } = props
  const doDia = data ? livresPorDia[data] ?? [] : []
  const comVaga = PERIODOS.filter((p) => doDia.some((h) => periodoDe(h) === p.nome))
  const [aba, setAba] = useState<string | null>(null)
  const atual = comVaga.find((p) => p.nome === aba) ?? comVaga[0]

  return (
    <>
      <FitaDias {...props} />
      {data && (doDia.length ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-linha/50 p-1" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => {
              const tem = comVaga.includes(p)
              return (
                <button key={p.nome} type="button" role="tab" aria-selected={atual?.nome === p.nome} disabled={!tem} onClick={() => setAba(p.nome)}
                  className={clsx("rounded-xl py-2 text-sm font-semibold transition", atual?.nome === p.nome ? "bg-cartao shadow-sm" : "text-suave", !tem && "opacity-40")}>
                  {p.nome}
                </button>
              )
            })}
          </div>
          {atual && <GradeHoras lista={doDia.filter((h) => periodoDe(h) === atual.nome)} horario={horario} onHorario={onHorario} porPeriodo={false} />}
        </>
      ) : <Vazio>{rodapeVazio}</Vazio>)}
    </>
  )
}

/** Os primeiros horários livres de todos os dias, com "ver mais". */
function Proximos({ dias, livresPorDia, nomeProf, escolherEm, selEm }: Props & { escolherEm: (d: string, h: Horario) => void; selEm: (d: string, h: Horario) => boolean }) {
  const [mostrar, setMostrar] = useState(8)
  const todos = dias.flatMap((d) => (livresPorDia[d] ?? []).map((h) => ({ d, h })))
  if (!todos.length) return null
  return (
    <div>
      <ul className="grid gap-2">
        {todos.slice(0, mostrar).map(({ d, h }) => {
          const sel = selEm(d, h)
          return (
            <li key={`${d}-${h.hora}`}>
              <button type="button" onClick={() => escolherEm(d, h)} aria-pressed={sel} className={clsx("flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition", sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}>
                <span className="w-24 shrink-0 font-semibold first-letter:uppercase">{rotuloDia(d)}</span>
                <span className="text-lg font-bold tabular">{h.hora}</span>
                {nomeProf && <span className={clsx("ml-auto truncate text-sm", sel ? "opacity-90" : "text-suave")}>com {nomeProf(h.profissionalId)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {mostrar < todos.length && (
        <button type="button" onClick={() => setMostrar(mostrar + 8)} className="mt-3 w-full rounded-2xl border border-linha py-3 font-medium">
          Ver mais horários
        </button>
      )}
    </div>
  )
}
