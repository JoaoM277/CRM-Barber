import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarPlus, Check, ChevronLeft, Clock, Loader2, MapPin, Scissors, Sparkles, UserRound, X } from "lucide-react"
import clsx from "clsx"
import { api, ErroApi, slugDaPagina, type Aviso, type Identidade, type Profissional, type Servico } from "./lib/api"
import { deISO, horariosLivres, isoLocal, minutos, type Expediente, type Horario, type Ocupado } from "./lib/horarios"

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const QUALQUER = "qualquer" as const
const DIAS_A_FRENTE = 14
const LANDING = "https://usevellis.tech/?utm_source=pagina-agendamento"

/* --------------------------------------------------------------- utilidades */

/** Texto escuro ou claro sobre a cor da marca, pelo contraste. */
function corSobre(hex: string) {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? "#15201d" : "#ffffff"
}

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const lembrar = {
  ler: () => {
    try { return JSON.parse(localStorage.getItem("vellis_cliente") ?? "{}") as { nome?: string; telefone?: string } } catch { return {} }
  },
  salvar: (nome: string, telefone: string) => {
    try { localStorage.setItem("vellis_cliente", JSON.stringify({ nome, telefone })) } catch { /* modo privado: só não lembra */ }
  },
}

/** Arquivo .ics para "adicionar à agenda" (funciona no iPhone e no Android). */
function baixarIcs(titulo: string, data: string, hora: string, duracao: number, local: string) {
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

/* --------------------------------------------------------------- peças */

function Cabecalho({ id }: { id: Identidade }) {
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

const ETAPAS = ["Serviço", "Profissional", "Horário", "Seus dados"]

function Progresso({ etapa }: { etapa: number }) {
  return (
    <ol className="mb-5 flex gap-1.5" aria-label={`Etapa ${etapa + 1} de ${ETAPAS.length}: ${ETAPAS[etapa]}`}>
      {ETAPAS.map((t, i) => (
        <li key={t} className="flex-1">
          <span className={clsx("block h-1 rounded-full", i <= etapa ? "bg-marca" : "bg-linha")} />
          <span className={clsx("mt-1.5 block text-[11px]", i === etapa ? "font-semibold text-texto" : "text-suave")}>{t}</span>
        </li>
      ))}
    </ol>
  )
}

function Escolha({ selecionado, onClick, children, rotulo }: { selecionado: boolean; onClick: () => void; children: React.ReactNode; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      aria-label={rotulo}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl border bg-cartao p-4 text-left transition active:scale-[.99]",
        selecionado ? "border-marca ring-2 ring-marca/40" : "border-linha hover:border-suave/50",
      )}
    >
      {children}
    </button>
  )
}

function Marcador({ ativo, redondo }: { ativo: boolean; redondo?: boolean }) {
  return (
    <span className={clsx("grid size-6 shrink-0 place-items-center border-2 transition", redondo ? "rounded-full" : "rounded-md", ativo ? "border-marca bg-marca text-sobre-marca" : "border-linha")} aria-hidden>
      {ativo && <Check className="size-4" strokeWidth={3} />}
    </span>
  )
}

/* --------------------------------------------------------------- página */

type Dados = { id: Identidade; servicos: Servico[]; profissionais: Profissional[]; expediente: Expediente[]; ocupados: Ocupado[]; aviso: Aviso }

export default function App() {
  const slug = useMemo(slugDaPagina, [])
  const [dados, setDados] = useState<Dados | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [avisoAberto, setAvisoAberto] = useState(true)

  const [etapa, setEtapa] = useState(0)
  const [servicosSel, setServicosSel] = useState<number[]>([])
  const [prof, setProf] = useState<number | typeof QUALQUER | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [horario, setHorario] = useState<Horario | null>(null)
  const [nome, setNome] = useState(() => lembrar.ler().nome ?? "")
  const [telefone, setTelefone] = useState(() => lembrar.ler().telefone ?? "")
  const [recado, setRecado] = useState("")
  const [armadilha, setArmadilha] = useState("") // honeypot: pessoa não vê nem preenche
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)

  const carregar = useCallback(async () => {
    if (!slug) {
      setFalha("Link incompleto: falta a barbearia no endereço.")
      return
    }
    try {
      const [id, servicos, profissionais, disp, aviso] = await Promise.all([
        api<Identidade>(slug, "/barbearia"),
        api<Servico[]>(slug, "/servicos"),
        api<Profissional[]>(slug, "/profissionais"),
        api<{ data: Ocupado[]; expediente: Expediente[] }>(slug, "/disponibilidade"),
        api<Aviso>(slug, "/avisos/ativo").catch(() => ({ exibir: false, dados: null })),
      ])
      setDados({ id, servicos: servicos.filter((s) => s.active !== false), profissionais: profissionais.filter((p) => p.active !== false), expediente: disp.expediente, ocupados: disp.data, aviso })
    } catch (e) {
      setFalha(e instanceof ErroApi && e.status === 404 ? "Não encontramos esta barbearia. Confira o link com a barbearia." : (e as Error).message)
    }
  }, [slug])

  useEffect(() => { carregar() }, [carregar])

  // veste a marca da barbearia
  useEffect(() => {
    if (!dados) return
    const cor = /^#[0-9a-f]{3,6}$/i.test(dados.id.accent_color) ? dados.id.accent_color : "#c89b3c"
    document.documentElement.style.setProperty("--marca", cor)
    document.documentElement.style.setProperty("--sobre-marca", corSobre(cor))
    document.title = `Agendar horário · ${dados.id.name}`
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor)
    // ícone da aba = logo da barbearia, quando houver
    if (dados.id.logo_url) document.querySelector('link[rel="icon"]')?.setAttribute("href", dados.id.logo_url)
  }, [dados])

  const escolhidos = useMemo(() => dados?.servicos.filter((s) => servicosSel.includes(s.id)) ?? [], [dados, servicosSel])
  const total = escolhidos.reduce((t, s) => t + Number(s.price), 0)
  const duracao = escolhidos.reduce((t, s) => t + (Number(s.duration_time) || 30), 0)
  const candidatos = useMemo(() => (prof === QUALQUER ? dados?.profissionais.map((p) => p.id) ?? [] : prof ? [prof] : []), [prof, dados])

  const dias = useMemo(() => Array.from({ length: DIAS_A_FRENTE }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return isoLocal(d) }), [])
  const livresPorDia = useMemo(() => {
    if (!dados || !duracao || !candidatos.length) return {} as Record<string, Horario[]>
    return Object.fromEntries(dias.map((d) => [d, horariosLivres(d, duracao, candidatos, dados.expediente, dados.ocupados)]))
  }, [dados, duracao, candidatos, dias])

  // ao entrar no passo de horário, pré-seleciona o primeiro dia com vaga
  useEffect(() => {
    if (etapa !== 2) return
    if (!data || !livresPorDia[data]?.length) setData(dias.find((d) => livresPorDia[d]?.length) ?? dias[0])
  }, [etapa, livresPorDia, dias, data])

  const nomeProf = (id: number) => dados?.profissionais.find((p) => p.id === id)?.name ?? ""

  const podeAvancar = [servicosSel.length > 0, prof !== null, !!horario, nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10][etapa]

  async function confirmar() {
    if (!dados || !horario || !data) return
    setEnviando(true)
    setErroEnvio(null)
    try {
      await api(slug!, "/agendamentos", {
        clienteNome: nome.trim(),
        clienteTelefone: telefone,
        barbeiroId: horario.profissionalId,
        servicosIds: servicosSel,
        dataAgendamento: data,
        horario: horario.hora,
        observacoes: recado.trim() || undefined,
        website: armadilha,
      })
      lembrar.salvar(nome.trim(), telefone)
      setConcluido(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      const err = e as ErroApi
      // horário tomado nesse meio-tempo: volta para a escolha, com a agenda atualizada
      if (err.campos?.horario || err.campos?.dataAgendamento) {
        setErroEnvio(`${err.message} Escolha outro horário.`)
        setHorario(null)
        setEtapa(2)
        carregar()
      } else {
        setErroEnvio(err.message)
      }
    } finally {
      setEnviando(false)
    }
  }

  function avancar() {
    if (etapa < 3) {
      setEtapa(etapa + 1)
      setErroEnvio(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else confirmar()
  }

  /* ---------- estados de página */
  if (falha) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6 text-center">
        <div>
          <Scissors className="mx-auto mb-4 size-10 text-suave" aria-hidden />
          <p className="text-lg font-semibold">Não foi possível abrir a agenda</p>
          <p className="mt-1 text-suave">{falha}</p>
        </div>
      </main>
    )
  }
  if (!dados) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center">
        <Loader2 className="size-8 animate-spin text-suave" aria-label="Carregando a agenda" />
      </main>
    )
  }

  const dataLonga = (iso: string) => deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })

  if (concluido && horario && data) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-16">
        <Cabecalho id={dados.id} />
        <section className="rounded-3xl border border-linha bg-cartao p-6 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-marca text-sobre-marca">
            <Check className="size-9" strokeWidth={3} aria-hidden />
          </div>
          <h2 className="text-2xl font-bold">Horário marcado!</h2>
          <p className="mt-1 text-suave">Você vai receber a confirmação no WhatsApp.</p>
          <dl className="mt-6 grid gap-2 rounded-2xl bg-fundo p-4 text-left text-sm">
            <div className="flex justify-between gap-3"><dt className="text-suave">Quando</dt><dd className="text-right font-medium first-letter:uppercase">{dataLonga(data)}, {horario.hora}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-suave">Com</dt><dd className="font-medium">{nomeProf(horario.profissionalId)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-suave">Serviço</dt><dd className="text-right font-medium">{escolhidos.map((s) => s.name).join(", ")}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-suave">Valor</dt><dd className="font-medium tabular">{moeda(total)}</dd></div>
          </dl>
          <button
            type="button"
            onClick={() => baixarIcs(`${escolhidos.map((s) => s.name).join(" + ")} · ${dados.id.name}`, data, horario.hora, duracao, dados.id.name)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-marca px-5 py-3.5 font-semibold text-sobre-marca"
          >
            <CalendarPlus className="size-5" aria-hidden /> Adicionar à agenda do celular
          </button>
          <button
            type="button"
            onClick={() => { setConcluido(false); setEtapa(0); setServicosSel([]); setProf(null); setHorario(null); setRecado(""); carregar() }}
            className="mt-3 w-full rounded-2xl border border-linha px-5 py-3 font-medium"
          >
            Marcar outro horário
          </button>
        </section>
        <Rodape />
      </main>
    )
  }

  /* ---------- etapas */
  return (
    <main className="mx-auto max-w-lg px-5 pb-40">
      <Cabecalho id={dados.id} />
      <Progresso etapa={etapa} />

      {etapa > 0 && (
        <button type="button" onClick={() => setEtapa(etapa - 1)} className="-ml-1 mb-3 inline-flex items-center gap-1 text-sm font-medium text-suave">
          <ChevronLeft className="size-4" aria-hidden /> Voltar
        </button>
      )}

      {erroEnvio && <p role="alert" className="mb-4 rounded-2xl border border-erro/40 bg-erro/10 p-3 text-sm text-erro">{erroEnvio}</p>}

      {etapa === 0 && (
        <section>
          <h2 className="mb-1 text-xl font-bold">O que vamos fazer?</h2>
          <p className="mb-4 text-sm text-suave">Pode escolher mais de um.</p>
          {dados.servicos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-linha p-6 text-center text-suave">Esta barbearia ainda não cadastrou serviços para agendamento online.</p>
          ) : (
            <ul className="grid gap-2.5">
              {dados.servicos.map((s) => {
                const sel = servicosSel.includes(s.id)
                return (
                  <li key={s.id}>
                    <Escolha selecionado={sel} onClick={() => { setServicosSel((x) => (sel ? x.filter((i) => i !== s.id) : [...x, s.id])); setHorario(null) }}>
                      <Marcador ativo={sel} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{s.name}</span>
                        {s.description && <span className="block truncate text-sm text-suave">{s.description}</span>}
                        <span className="mt-0.5 inline-flex items-center gap-1 text-sm text-suave"><Clock className="size-3.5" aria-hidden /> {Number(s.duration_time) || 30} min</span>
                      </span>
                      <span className="font-semibold tabular">{moeda(Number(s.price))}</span>
                    </Escolha>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {etapa === 1 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Com quem?</h2>
          <ul className="grid gap-2.5">
            <li>
              <Escolha selecionado={prof === QUALQUER} onClick={() => { setProf(QUALQUER); setHorario(null) }}>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-marca/15 text-marca" aria-hidden><Sparkles className="size-5" /></span>
                <span className="flex-1">
                  <span className="block font-semibold">Sem preferência</span>
                  <span className="text-sm text-suave">Mais horários disponíveis</span>
                </span>
                <Marcador ativo={prof === QUALQUER} redondo />
              </Escolha>
            </li>
            {dados.profissionais.map((p) => (
              <li key={p.id}>
                <Escolha selecionado={prof === p.id} onClick={() => { setProf(p.id); setHorario(null) }}>
                  {p.photo ? (
                    <img src={p.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-fundo text-lg font-semibold" aria-hidden>
                      {p.name.slice(0, 1).toUpperCase() || <UserRound className="size-5" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    {p.speciality && <span className="block truncate text-sm text-suave">{p.speciality}</span>}
                  </span>
                  <Marcador ativo={prof === p.id} redondo />
                </Escolha>
              </li>
            ))}
          </ul>
        </section>
      )}

      {etapa === 2 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Quando?</h2>
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
                  onClick={() => { setData(d); setHorario(null) }}
                  className={clsx(
                    "flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition",
                    sel ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao",
                    !vagas && "opacity-35",
                  )}
                  aria-label={`${dataLonga(d)}${vagas ? `, ${vagas} horários` : ", sem horários"}`}
                >
                  <span className="text-[11px] uppercase">{d === dias[0] ? "Hoje" : dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
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
                          onClick={() => setHorario(h)}
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
          {!dias.some((d) => livresPorDia[d]?.length) && (
            <p className="rounded-2xl border border-dashed border-linha p-6 text-center text-suave">
              Sem horários livres nos próximos {DIAS_A_FRENTE} dias{prof !== QUALQUER ? " com este profissional. Tente “Sem preferência”." : "."}
            </p>
          )}
        </section>
      )}

      {etapa === 3 && horario && data && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Quase lá</h2>
          <div className="mb-5 rounded-2xl border border-linha bg-cartao p-4 text-sm">
            <p className="font-semibold first-letter:uppercase">{dataLonga(data)}, {horario.hora}</p>
            <p className="text-suave">{escolhidos.map((s) => s.name).join(", ")} · com {nomeProf(horario.profissionalId)}</p>
          </div>
          <form id="dados" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (podeAvancar) confirmar() }}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required className="rounded-xl border border-linha bg-cartao px-4 py-3 text-base outline-none focus:border-marca" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">WhatsApp</span>
              <input value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" required className="rounded-xl border border-linha bg-cartao px-4 py-3 text-base outline-none focus:border-marca" />
              <span className="text-xs text-suave">A confirmação chega por aqui.</span>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Algum recado? <span className="font-normal text-suave">(opcional)</span></span>
              <textarea value={recado} onChange={(e) => setRecado(e.target.value)} rows={2} maxLength={500} className="rounded-xl border border-linha bg-cartao px-4 py-3 text-base outline-none focus:border-marca" />
            </label>
            {/* honeypot anti-robô: escondido de pessoas e de leitores de tela */}
            <input value={armadilha} onChange={(e) => setArmadilha(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          </form>
        </section>
      )}

      <Rodape />

      {/* barra fixa: resumo + próximo passo */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linha bg-cartao/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="min-w-0 flex-1 text-sm">
            {servicosSel.length ? (
              <>
                <p className="font-semibold tabular">{moeda(total)}</p>
                <p className="truncate text-suave">{servicosSel.length} serviço{servicosSel.length > 1 ? "s" : ""} · {duracao} min</p>
              </>
            ) : (
              <p className="text-suave">Escolha um serviço</p>
            )}
          </div>
          <button
            type="button"
            onClick={avancar}
            disabled={!podeAvancar || enviando}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl bg-marca px-6 py-3.5 font-semibold text-sobre-marca transition disabled:opacity-40"
          >
            {enviando ? <Loader2 className="size-5 animate-spin" aria-label="Enviando" /> : etapa === 3 ? "Confirmar horário" : "Continuar"}
          </button>
        </div>
      </div>

      {dados.aviso.exibir && dados.aviso.dados && avisoAberto && (
        <div className="fixed inset-0 z-20 grid place-items-end bg-black/50 p-4 sm:place-items-center" role="dialog" aria-modal aria-labelledby="aviso-titulo">
          <div className="w-full max-w-md rounded-3xl bg-cartao p-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 id="aviso-titulo" className="text-lg font-bold">{dados.aviso.dados.titulo}</h2>
              <button type="button" onClick={() => setAvisoAberto(false)} aria-label="Fechar aviso" className="-m-1 p-1 text-suave"><X className="size-5" /></button>
            </div>
            <p className="whitespace-pre-line text-suave">{dados.aviso.dados.mensagem}</p>
            <button type="button" onClick={() => setAvisoAberto(false)} className="mt-5 w-full rounded-2xl bg-marca px-5 py-3 font-semibold text-sobre-marca">Entendi</button>
          </div>
        </div>
      )}
    </main>
  )
}

function Rodape() {
  return (
    <footer className="mt-10 text-center text-xs text-suave">
      Agenda online por{" "}
      <a href={LANDING} target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:underline">Vellis</a>
    </footer>
  )
}
