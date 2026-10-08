import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarPlus, Check, ChevronLeft, Loader2, Scissors, Sparkles, UserRound } from "lucide-react"
import clsx from "clsx"
import { api, ErroApi, slugDaPagina, type Identidade, type MeuHorario as Horario, type Profissional } from "./lib/api"
import { deISO, horariosLivres, isoLocal, minutos, type Expediente, type Horario as Vaga, type Ocupado } from "./lib/horarios"
import { baixarIcs, Cabecalho, dataLonga, moeda, Rodape, SeletorHorario, useMarca } from "./ui"

const DIAS_A_FRENTE = 14
const QUALQUER = "qualquer" as const

const STATUS: Record<Horario["status"], { texto: string; classe: string }> = {
  pendente: { texto: "Marcado", classe: "bg-marca/15 text-texto" },
  confirmado: { texto: "Confirmado", classe: "bg-marca text-sobre-marca" },
  concluido: { texto: "Concluído", classe: "bg-linha text-suave" },
  cancelado: { texto: "Cancelado", classe: "bg-erro/10 text-erro" },
}

type Base = { id: Identidade; horario: Horario; profissionais: Profissional[]; expediente: Expediente[]; ocupados: Ocupado[] }

/** Página que o cliente abre pelo link do WhatsApp: ver, cancelar ou remarcar o horário. */
export default function MeuHorario({ token }: { token: string }) {
  const slug = useMemo(slugDaPagina, [])
  const [base, setBase] = useState<Base | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [modo, setModo] = useState<"ver" | "cancelar" | "remarcar">("ver")
  const [feito, setFeito] = useState<"cancelado" | "remarcado" | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [prof, setProf] = useState<number | typeof QUALQUER | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [vaga, setVaga] = useState<Vaga | null>(null)

  const caminho = `/meu-horario/${encodeURIComponent(token)}`

  const carregar = useCallback(async () => {
    if (!slug) {
      setFalha("Link incompleto: falta a barbearia no endereço.")
      return
    }
    try {
      const [id, horario, profissionais, disp] = await Promise.all([
        api<Identidade>(slug, "/barbearia"),
        api<Horario>(slug, caminho),
        api<Profissional[]>(slug, "/profissionais"),
        api<{ data: Ocupado[]; expediente: Expediente[] }>(slug, "/disponibilidade"),
      ])
      setBase({ id, horario, profissionais: profissionais.filter((p) => p.active !== false), expediente: disp.expediente, ocupados: disp.data })
    } catch (e) {
      setFalha(e instanceof ErroApi && e.status === 404 ? "Não encontramos este horário. Confira o link com a barbearia." : (e as Error).message)
    }
  }, [slug, caminho])

  useEffect(() => { carregar() }, [carregar])
  useMarca(base?.id, "Meu horário")

  const h = base?.horario
  const meuProf = h?.profissional?.id ?? null
  useEffect(() => { if (modo === "remarcar" && prof === null) setProf(meuProf ?? QUALQUER) }, [modo, prof, meuProf])

  /* ---------- horários livres para remarcar */
  const dias = useMemo(() => Array.from({ length: DIAS_A_FRENTE }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return isoLocal(d) }), [])
  const candidatos = useMemo(() => (prof === QUALQUER ? base?.profissionais.map((p) => p.id) ?? [] : prof ? [prof] : []), [prof, base])
  const livresPorDia = useMemo(() => {
    if (!base || !h || !candidatos.length) return {} as Record<string, Vaga[]>
    // o próprio horário não ocupa a agenda de quem está remarcando
    const ocupados = base.ocupados.filter((o) => !(o.date.slice(0, 10) === h.date && o.start_time === h.start_time && o.worker_id === meuProf))
    const limite = Date.now() + h.antecedencia_horas * 3_600_000
    const quando = (d: string, hora: string) => { const x = deISO(d); x.setHours(0, minutos(hora)); return x.getTime() }
    return Object.fromEntries(dias.map((d) => [
      d,
      horariosLivres(d, h.duracao, candidatos, base.expediente, ocupados).filter((v) =>
        quando(d, v.hora) >= limite && !(d === h.date && v.hora === h.start_time && v.profissionalId === meuProf)),
    ]))
  }, [base, h, candidatos, dias, meuProf])

  useEffect(() => {
    if (modo !== "remarcar") return
    if (!data || !livresPorDia[data]?.length) setData(dias.find((d) => livresPorDia[d]?.length) ?? dias[0])
  }, [modo, livresPorDia, dias, data])

  /* ---------- ações */
  async function enviar(acao: "cancelar" | "remarcar") {
    if (!slug) return
    setEnviando(true)
    setErro(null)
    try {
      const corpo = acao === "cancelar" ? {} : { dataAgendamento: data, horario: vaga!.hora, barbeiroId: vaga!.profissionalId }
      const r = await api<{ horario: Horario }>(slug, `${caminho}/${acao}`, corpo)
      setBase((b) => (b ? { ...b, horario: r.horario } : b))
      setFeito(acao === "cancelar" ? "cancelado" : "remarcado")
      setModo("ver")
      window.scrollTo({ top: 0 })
    } catch (e) {
      const err = e as ErroApi
      setErro(err.message)
      if (err.campos?.horario) { setVaga(null); carregar() }
      if (err.code === "alteracao_bloqueada") { setModo("ver"); carregar() }
    } finally {
      setEnviando(false)
    }
  }

  /* ---------- estados de página */
  if (falha) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6 text-center">
        <div>
          <Scissors className="mx-auto mb-4 size-10 text-suave" aria-hidden />
          <p className="text-lg font-semibold">Não foi possível abrir o horário</p>
          <p className="mt-1 text-suave">{falha}</p>
        </div>
      </main>
    )
  }
  if (!base || !h) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center">
        <Loader2 className="size-8 animate-spin text-suave" aria-label="Carregando" />
      </main>
    )
  }

  const linkAgendar = `?b=${encodeURIComponent(slug!)}`
  const nomeProf = (id: number) => base.profissionais.find((p) => p.id === id)?.name ?? ""

  if (modo === "remarcar") {
    return (
      <main className="mx-auto max-w-lg px-5 pb-40">
        <Cabecalho id={base.id} />
        <button type="button" onClick={() => { setModo("ver"); setErro(null) }} className="-ml-1 mb-3 inline-flex items-center gap-1 text-sm font-medium text-suave">
          <ChevronLeft className="size-4" aria-hidden /> Voltar
        </button>
        <h2 className="mb-1 text-xl font-bold">Escolha o novo horário</h2>
        <p className="mb-4 text-sm text-suave">{h.servicos.join(", ")} · {h.duracao} min</p>
        {erro && <p role="alert" className="mb-4 rounded-2xl border border-erro/40 bg-erro/10 p-3 text-sm text-erro">{erro}</p>}

        {base.profissionais.length > 1 && (
          <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="Profissional">
            {[{ id: QUALQUER, name: "Sem preferência" } as const, ...base.profissionais].map((p) => {
              const sel = prof === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => { setProf(p.id); setVaga(null) }}
                  className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition", sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}
                >
                  {p.id === QUALQUER ? <Sparkles className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />} {p.name}
                </button>
              )
            })}
          </div>
        )}

        <SeletorHorario dias={dias} livresPorDia={livresPorDia} data={data} horario={vaga} onData={(d) => { setData(d); setVaga(null) }} onHorario={setVaga} />
        {!dias.some((d) => livresPorDia[d]?.length) && (
          <p className="rounded-2xl border border-dashed border-linha p-6 text-center text-suave">
            Sem horários livres nos próximos {DIAS_A_FRENTE} dias{prof !== QUALQUER ? ". Tente “Sem preferência”." : ". Fale com a barbearia."}
          </p>
        )}
        <Rodape />

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linha bg-cartao/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <p className="min-w-0 flex-1 truncate text-sm text-suave">
              {vaga && data ? <span className="font-semibold text-texto first-letter:uppercase">{dataLonga(data)}, {vaga.hora}</span> : "Escolha dia e horário"}
            </p>
            <button
              type="button"
              onClick={() => enviar("remarcar")}
              disabled={!vaga || enviando}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl bg-marca px-6 py-3.5 font-semibold text-sobre-marca transition disabled:opacity-40"
            >
              {enviando ? <Loader2 className="size-5 animate-spin" aria-label="Enviando" /> : "Remarcar"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  const status = STATUS[h.status]

  return (
    <main className="mx-auto max-w-lg px-5 pb-16">
      <Cabecalho id={base.id} />
      <section className="rounded-3xl border border-linha bg-cartao p-6">
        {feito ? (
          <div className="mb-5 text-center">
            <div className={clsx("mx-auto mb-3 grid size-14 place-items-center rounded-full", feito === "cancelado" ? "bg-erro/10 text-erro" : "bg-marca text-sobre-marca")}>
              <Check className="size-8" strokeWidth={3} aria-hidden />
            </div>
            <h2 className="text-2xl font-bold">{feito === "cancelado" ? "Horário cancelado" : "Horário remarcado!"}</h2>
            <p className="mt-1 text-suave">{feito === "cancelado" ? "A barbearia já está sabendo." : "A agenda da barbearia já foi atualizada."}</p>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{h.cliente ? `${h.cliente}, seu horário` : "Seu horário"}</h2>
            <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", status.classe)}>{status.texto}</span>
          </div>
        )}

        <dl className={clsx("grid gap-2 rounded-2xl bg-fundo p-4 text-sm", h.status === "cancelado" && "opacity-60")}>
          <div className="flex justify-between gap-3"><dt className="text-suave">Quando</dt><dd className="text-right font-medium first-letter:uppercase">{dataLonga(h.date)}, {h.start_time}</dd></div>
          {h.profissional && <div className="flex justify-between gap-3"><dt className="text-suave">Com</dt><dd className="font-medium">{h.profissional.name || nomeProf(h.profissional.id)}</dd></div>}
          {h.servicos.length > 0 && <div className="flex justify-between gap-3"><dt className="text-suave">Serviço</dt><dd className="text-right font-medium">{h.servicos.join(", ")}</dd></div>}
          {h.valor > 0 && <div className="flex justify-between gap-3"><dt className="text-suave">Valor</dt><dd className="font-medium tabular">{moeda(h.valor)}</dd></div>}
        </dl>

        {erro && modo === "ver" && <p role="alert" className="mt-4 rounded-2xl border border-erro/40 bg-erro/10 p-3 text-sm text-erro">{erro}</p>}

        {h.status === "cancelado" ? (
          <a href={linkAgendar} className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-marca px-5 py-3.5 font-semibold text-sobre-marca">
            Marcar um novo horário
          </a>
        ) : h.pode_alterar ? (
          modo === "cancelar" ? (
            <div className="mt-5 rounded-2xl border border-erro/30 bg-erro/5 p-4" role="alertdialog" aria-labelledby="cancelar-titulo">
              <p id="cancelar-titulo" className="font-semibold">Cancelar este horário?</p>
              <p className="mt-0.5 text-sm text-suave">O horário fica livre para outra pessoa.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setModo("ver")} className="rounded-2xl border border-linha bg-cartao px-4 py-3 font-medium">Voltar</button>
                <button type="button" onClick={() => enviar("cancelar")} disabled={enviando} className="inline-flex items-center justify-center rounded-2xl bg-erro px-4 py-3 font-semibold text-white disabled:opacity-50">
                  {enviando ? <Loader2 className="size-5 animate-spin" aria-label="Cancelando" /> : "Sim, cancelar"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => baixarIcs(`${h.servicos.join(" + ") || "Horário"} · ${base.id.name}`, h.date, h.start_time, h.duracao, base.id.name)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-linha px-5 py-3 font-medium"
              >
                <CalendarPlus className="size-5" aria-hidden /> Adicionar à agenda do celular
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setModo("remarcar"); setErro(null); setFeito(null); setVaga(null) }} className="rounded-2xl bg-marca px-4 py-3.5 font-semibold text-sobre-marca">
                  Remarcar
                </button>
                <button type="button" onClick={() => { setModo("cancelar"); setErro(null) }} className="rounded-2xl border border-erro/40 px-4 py-3.5 font-semibold text-erro">
                  Cancelar
                </button>
              </div>
              {h.antecedencia_horas > 0 && (
                <p className="mt-3 text-center text-xs text-suave">Dá para cancelar ou remarcar por aqui até {h.antecedencia_horas}h antes do horário.</p>
              )}
            </>
          )
        ) : (
          h.motivo && h.status !== "concluido" && <p className="mt-5 rounded-2xl bg-fundo p-4 text-sm text-suave">{h.motivo}</p>
        )}
      </section>
      <p className="mt-4 text-center text-sm">
        <a href={linkAgendar} className="font-medium text-suave underline-offset-2 hover:underline">Ver a agenda da barbearia</a>
      </p>
      <Rodape />
    </main>
  )
}
