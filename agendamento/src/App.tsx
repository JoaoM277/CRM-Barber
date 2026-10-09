import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCog, CalendarPlus, Check, ChevronLeft, Loader2, Scissors, X } from "lucide-react"
import clsx from "clsx"
import { api, ErroApi, slugDaPagina, type Aviso, type Identidade, type Profissional, type Servico } from "./lib/api"
import { deISO, horariosLivres, isoLocal, type Expediente, type Horario, type Ocupado } from "./lib/horarios"
import { AvaliacoesClientes, emPrevia, Galeria, Sobre, usePagina, usePreviaDoPainel } from "./pagina"
import { QUALQUER, SeletorProfissionais, SeletorServicos } from "./seletores"
import { SeletorDeHorario } from "./seletor-horario"
import { Abertura, baixarIcs, Cabecalho, dataLonga, guardarMarca, marcaGuardada, moeda, Rodape, useAberturaMinima, useMarca } from "./ui"

const DIAS_A_FRENTE = 14

/* --------------------------------------------------------------- utilidades */

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

/* --------------------------------------------------------------- peças */

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


/** "Me avise se abrir vaga": entra na lista de espera do dia lotado. */
function ListaEsperaBox({ slug, data, barbeiroId, servicosIds, nomeInicial, telefoneInicial }: {
  slug: string; data: string; barbeiroId: number | null; servicosIds: number[]; nomeInicial: string; telefoneInicial: string
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<string | null>(null)

  useEffect(() => { setPronto(null); setErro(null) }, [data])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await api<{ message: string }>(slug, "/lista-espera", {
        clienteNome: nome.trim(), clienteTelefone: telefone, data, barbeiroId, servicosIds, website: "",
      })
      lembrar.salvar(nome.trim(), telefone)
      setPronto(r.message)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (pronto) {
    return <p role="status" className="mt-3 rounded-2xl border border-marca/40 bg-marca/10 p-4 text-sm font-medium">{pronto}</p>
  }

  return (
    <form onSubmit={entrar} className="mt-3 grid gap-3 rounded-2xl border border-linha bg-cartao p-4">
      <div>
        <p className="font-semibold">Quer esse dia mesmo?</p>
        <p className="text-sm text-suave">Entre na lista de espera: se alguém desmarcar, você recebe um aviso no WhatsApp.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" required minLength={2} aria-label="Seu nome" className="rounded-xl border border-linha bg-cartao px-4 py-3 text-base outline-none focus:border-marca" />
        <input value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} type="tel" inputMode="tel" autoComplete="tel" placeholder="WhatsApp" required aria-label="WhatsApp" className="rounded-xl border border-linha bg-cartao px-4 py-3 text-base outline-none focus:border-marca" />
      </div>
      {erro && <p role="alert" className="text-sm text-erro">{erro}</p>}
      <button type="submit" disabled={enviando || nome.trim().length < 2 || telefone.replace(/\D/g, "").length < 10} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-marca px-5 py-3 font-semibold text-sobre-marca disabled:opacity-40">
        {enviando ? <Loader2 className="size-5 animate-spin" aria-label="Enviando" /> : "Me avise se abrir vaga"}
      </button>
    </form>
  )
}


/* --------------------------------------------------------------- página */

type Dados = { id: Identidade; servicos: Servico[]; profissionais: Profissional[]; expediente: Expediente[]; ocupados: Ocupado[]; aviso: Aviso }

export default function App() {
  const slug = useMemo(slugDaPagina, [])
  const [dados, setDados] = useState<Dados | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [identidade, setIdentidade] = useState<Identidade | null>(null)
  const [avisoAberto, setAvisoAberto] = useState(true)

  const [etapa, setEtapa] = useState(0)
  const [servicosSel, setServicosSel] = useState<number[]>([])
  const [prof, setProf] = useState<number | typeof QUALQUER | null>(null)
  // ?d=YYYY-MM-DD: veio do aviso da lista de espera ("abriu vaga no dia tal")
  const [data, setData] = useState<string | null>(() => new URLSearchParams(location.search).get("d")?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? null)
  const [horario, setHorario] = useState<Horario | null>(null)
  const [nome, setNome] = useState(() => lembrar.ler().nome ?? "")
  const [telefone, setTelefone] = useState(() => lembrar.ler().telefone ?? "")
  const [recado, setRecado] = useState("")
  const [armadilha, setArmadilha] = useState("") // honeypot: pessoa não vê nem preenche
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)
  const [linkCliente, setLinkCliente] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!slug) {
      setFalha("Link incompleto: falta a barbearia no endereço.")
      return
    }
    try {
      // a identidade chega primeiro e já veste a tela de abertura com a logo
      const pId = api<Identidade>(slug, "/barbearia")
      pId.then((id) => { setIdentidade(id); guardarMarca(slug, id) }).catch(() => {})
      const [id, servicos, profissionais, disp, aviso] = await Promise.all([
        pId,
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

  const guardada = useMemo(() => marcaGuardada(slug), [slug])
  const aberturaMinima = useAberturaMinima()
  useMarca(dados?.id ?? identidade ?? guardada, "Agendar horário")

  // personalização (Pro/Premium); no painel, a prévia ao vivo troca as escolhas
  const previa = usePreviaDoPainel()
  const idVisivel = dados ? (previa ? { ...dados.id, pagina: previa } : dados.id) : null
  const pagina = idVisivel?.pagina ?? identidade?.pagina ?? null
  usePagina(pagina)

  // serviços agrupados por categoria (na ordem escolhida pela barbearia)
  const grupos = useMemo(() => {
    const mapa = new Map<string, Servico[]>()
    for (const s of dados?.servicos ?? []) {
      const c = s.categoria?.trim() || ""
      mapa.set(c, [...(mapa.get(c) ?? []), s])
    }
    return [...mapa.entries()]
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

  // dia aberto (pela grade de expediente), mesmo que lotado
  const abertoNoDia = useCallback((d: string) => !!dados?.expediente.find((e) => e.day_of_week === deISO(d).getDay())?.active, [dados])
  const listaEspera = !!dados?.id.lista_espera

  // ao entrar no passo de horário, pré-seleciona o primeiro dia com vaga
  // (um dia lotado escolhido de propósito fica, para a lista de espera)
  useEffect(() => {
    if (etapa !== 2) return
    const ficaNoDia = data && dias.includes(data) && (livresPorDia[data]?.length || (listaEspera && abertoNoDia(data)))
    if (!ficaNoDia) setData(dias.find((d) => livresPorDia[d]?.length) ?? dias[0])
  }, [etapa, livresPorDia, dias, data, listaEspera, abertoNoDia])

  const nomeProf = (id: number) => dados?.profissionais.find((p) => p.id === id)?.name ?? ""

  const podeAvancar = [servicosSel.length > 0, prof !== null, !!horario, nome.trim().length >= 2 && telefone.replace(/\D/g, "").length >= 10][etapa]

  async function confirmar() {
    if (!dados || !horario || !data) return
    if (emPrevia) {
      setErroEnvio("Pré-visualização do painel: o agendamento não é enviado.")
      return
    }
    setEnviando(true)
    setErroEnvio(null)
    try {
      const r = await api<{ link_cliente?: string | null }>(slug!, "/agendamentos", {
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
      setLinkCliente(r.link_cliente ?? null)
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
  // abertura com a logo da barbearia até a agenda carregar
  if (!dados || !idVisivel || (aberturaMinima && !emPrevia)) return <Abertura id={dados?.id ?? identidade ?? guardada} />

  if (concluido && horario && data) {
    return (
      <main className="entrar mx-auto max-w-lg px-5 pb-16">
        <Cabecalho id={idVisivel} />
        <section className="rounded-3xl border border-linha bg-cartao p-6 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-marca text-sobre-marca">
            <Check className="size-9" strokeWidth={3} aria-hidden />
          </div>
          <h2 className="text-2xl font-bold">Horário marcado!</h2>
          <p className="mt-1 text-suave">Você vai receber a confirmação no WhatsApp.</p>
          {pagina?.mensagem_sucesso && <p className="mt-3 whitespace-pre-line text-texto/90">{pagina.mensagem_sucesso}</p>}
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
          {linkCliente && (
            <a href={linkCliente} className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-suave underline-offset-2 hover:underline">
              <CalendarCog className="size-4" aria-hidden /> Precisa cancelar ou remarcar? Guarde este link.
            </a>
          )}
        </section>
        <Rodape />
      </main>
    )
  }

  /* ---------- etapas */
  return (
    <main className="entrar mx-auto max-w-lg px-5 pb-40">
      <Cabecalho id={idVisivel} comContatos={etapa === 0} />
      {etapa === 0 && pagina && <Galeria fotos={pagina.galeria} />}
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
            <SeletorServicos
              modelo={pagina?.seletor_servicos ?? "lista"}
              grupos={grupos}
              selecionados={servicosSel}
              alternar={(id) => { setServicosSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id])); setHorario(null) }}
            />
          )}
          {pagina && <Sobre p={pagina} expediente={dados.expediente} />}
          {dados.id.avaliacoes && <AvaliacoesClientes slug={slug!} resumo={dados.id.avaliacoes} />}
        </section>
      )}

      {etapa === 1 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Com quem?</h2>
          <SeletorProfissionais
            modelo={pagina?.seletor_profissionais ?? "lista"}
            profissionais={dados.profissionais}
            valor={prof}
            escolher={(v) => { setProf(v); setHorario(null) }}
          />
        </section>
      )}

      {etapa === 2 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Quando?</h2>
          <SeletorDeHorario
            modelo={pagina?.seletor_horarios ?? "lista"}
            nomeProf={nomeProf}
            dias={dias}
            livresPorDia={livresPorDia}
            data={data}
            horario={horario}
            onData={(d) => { setData(d); setHorario(null) }}
            onHorario={setHorario}
            lotadoClicavel={listaEspera ? abertoNoDia : undefined}
            rodapeVazio={listaEspera && data && abertoNoDia(data) ? (
              <ListaEsperaBox
                slug={slug!}
                data={data}
                barbeiroId={typeof prof === "number" ? prof : null}
                servicosIds={servicosSel}
                nomeInicial={nome}
                telefoneInicial={telefone}
              />
            ) : null}
          />
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
