import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ListaEsperaDia } from "@/components/agenda/lista-espera"
import { DetalheAgendamento } from "@/components/agenda/detalhe-agendamento"
import { NovoAgendamento, type Preenchimento } from "@/components/agenda/novo-agendamento"
import { useAgendamentos, useRemarcar } from "@/hooks/use-agenda"
import { useExpediente, useProfissionais } from "@/hooks/use-cadastros"
import { dataLonga, deISO, diaSemanaCurto, hhmm, hojeISO, inicioSemana, minutos, somarDias } from "@/lib/format"
import type { Agendamento, Expediente, Profissional, StatusAgendamento } from "@/lib/types"
import { cn } from "@/lib/utils"

const SLOT = 15 // minutos por linha da grade
const ALTURA = 22 // px por linha de 15 min (88px por hora)

const COR_STATUS: Record<StatusAgendamento, string> = {
  // a confirmar: âmbar + contorno tracejado (dá para distinguir sem depender da cor)
  pendente: "border-l-warning bg-warning/10 outline-1 outline-dashed -outline-offset-1 outline-warning/60",
  confirmado: "border-l-success bg-success/10",
  concluido: "border-l-muted-foreground/40 bg-muted text-muted-foreground",
  cancelado: "border-l-destructive/50 bg-destructive/5 text-muted-foreground line-through opacity-70",
}

/** Faixa de horário mostrada na grade: do primeiro ao último expediente ativo (padrão 8h–20h). */
function faixaDoDia(exp: Expediente[], dow?: number) {
  const ativos = exp.filter((e) => e.active && (dow === undefined || e.day_of_week === dow))
  if (!ativos.length) return { ini: 8 * 60, fim: 20 * 60, fechado: dow !== undefined && exp.length > 0 }
  const ini = Math.min(...ativos.map((e) => minutos(e.start_time)))
  const fim = Math.max(...ativos.map((e) => minutos(e.end_time)))
  return { ini: Math.floor(ini / 60) * 60, fim: Math.ceil(fim / 60) * 60, fechado: false }
}

function useAgora() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return agora
}

/** Cartão de agendamento (arrastável para remarcar). */
function Cartao({ a, compacto, comProfissional, onAbrir, style }: { a: Agendamento; compacto?: boolean; comProfissional?: boolean; onAbrir: () => void; style?: React.CSSProperties }) {
  const arrastavel = a.status === "pendente" || a.status === "confirmado"
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/agendamento", String(a.id))
        e.dataTransfer.effectAllowed = "move"
      }}
      onClick={onAbrir}
      style={style}
      className={cn(
        "flex w-full flex-col items-start justify-start overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs leading-tight shadow-xs transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-125",
        COR_STATUS[a.status],
        arrastavel && "cursor-grab active:cursor-grabbing",
      )}
      title={`${a.start_time} ${a.cliente_nome ?? ""} — ${a.servicos_nomes}`}
    >
      <span className="w-full truncate">
        <span className="font-mono font-semibold">{a.start_time}</span> <span className="font-semibold">{a.cliente_nome ?? "Cliente"}</span>
      </span>
      {!compacto && (
        <span className="w-full truncate opacity-80">
          {a.servicos_nomes}
          {comProfissional && a.worker ? ` · ${a.worker.name}` : ""}
        </span>
      )}
    </button>
  )
}

/** Grade do dia: uma coluna por profissional, linhas de 15 minutos. */
function GradeDia({
  data, itens, profissionais, expediente, onAbrir, onNovo,
}: {
  data: string
  itens: Agendamento[]
  profissionais: Profissional[]
  expediente: Expediente[]
  onAbrir: (a: Agendamento) => void
  onNovo: (p: Preenchimento) => void
}) {
  const remarcar = useRemarcar()
  const agora = useAgora()
  const dow = deISO(data).getDay()
  const { ini, fim, fechado } = faixaDoDia(expediente, dow)
  const exp = expediente.find((e) => e.day_of_week === dow && e.active)
  const linhas = (fim - ini) / SLOT
  const ehHoje = data === hojeISO()
  const agoraMin = agora.getHours() * 60 + agora.getMinutes()
  const scroller = useRef<HTMLDivElement>(null)

  // abre a grade perto da hora atual
  useEffect(() => {
    if (ehHoje && scroller.current) scroller.current.scrollTop = Math.max(0, ((agoraMin - ini - 60) / SLOT) * ALTURA)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const minutoNoPonto = (e: React.DragEvent | React.MouseEvent, el: HTMLElement) => {
    const y = e.clientY - el.getBoundingClientRect().top
    return ini + Math.max(0, Math.floor(y / ALTURA)) * SLOT
  }

  const soltar = (e: React.DragEvent<HTMLDivElement>, prof: Profissional) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData("text/agendamento"))
    const a = itens.find((x) => x.id === id)
    if (!a) return
    const horario = hhmm(minutoNoPonto(e, e.currentTarget))
    if (horario === a.start_time && prof.id === a.worker?.id) return
    remarcar.mutate({
      id,
      ...(horario !== a.start_time ? { horario } : {}),
      ...(prof.id !== a.worker?.id ? { barbeiroId: prof.id } : {}),
    })
  }

  if (fechado) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <p className="font-medium">A barbearia não abre neste dia</p>
        <p className="text-sm text-muted-foreground">Os horários de funcionamento ficam em Configurações.</p>
      </div>
    )
  }

  return (
    <div ref={scroller} className="max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border bg-card">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `3.5rem repeat(${profissionais.length}, minmax(10rem, 1fr))` }}>
        {/* cabeçalho */}
        <div className="sticky top-0 z-20 border-b bg-card" />
        {profissionais.map((p) => (
          <div key={p.id} className="sticky top-0 z-20 truncate border-b border-l bg-card px-3 py-2.5 text-sm font-semibold">
            {p.name}
          </div>
        ))}

        {/* régua de horários */}
        <div className="relative" style={{ height: linhas * ALTURA }}>
          {Array.from({ length: (fim - ini) / 60 }, (_, h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground" style={{ top: h * 4 * ALTURA }}>
              {h === 0 ? "" : hhmm(ini + h * 60)}
            </span>
          ))}
        </div>

        {/* colunas dos profissionais */}
        {profissionais.map((p) => {
          const doProf = itens.filter((a) => a.worker?.id === p.id)
          return (
            <div
              key={p.id}
              className="relative border-l"
              style={{
                height: linhas * ALTURA,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ALTURA * 4 - 1}px, var(--border) ${ALTURA * 4 - 1}px ${ALTURA * 4}px)`,
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
              }}
              onDrop={(e) => soltar(e, p)}
              onDoubleClick={(e) => onNovo({ data, horario: hhmm(minutoNoPonto(e, e.currentTarget)), barbeiroId: p.id })}
            >
              {/* almoço */}
              {exp?.waiting_start && exp.waiting_end && (
                <div
                  className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)]"
                  style={{ top: ((minutos(exp.waiting_start) - ini) / SLOT) * ALTURA, height: ((minutos(exp.waiting_end) - minutos(exp.waiting_start)) / SLOT) * ALTURA }}
                  aria-hidden
                />
              )}
              {doProf.map((a) => {
                const top = ((minutos(a.start_time) - ini) / SLOT) * ALTURA
                const dur = Math.max(minutos(a.end_time) - minutos(a.start_time), SLOT)
                const h = (dur / SLOT) * ALTURA - 2
                return (
                  <div key={a.id} className="absolute inset-x-1 z-10" style={{ top: top + 1, height: h }}>
                    <Cartao a={a} compacto={h < 40} onAbrir={() => onAbrir(a)} style={{ height: "100%" }} />
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* linha do "agora" (listrada como o poste de barbeiro) */}
        {ehHoje && agoraMin >= ini && agoraMin <= fim && (
          <div
            className="pointer-events-none relative z-30 col-span-full"
            style={{ gridRow: 2, marginTop: ((agoraMin - ini) / SLOT) * ALTURA - 1.5, height: 3 }}
            aria-hidden
          >
            <div className="h-[3px] w-full bg-[repeating-linear-gradient(90deg,#C2382F_0_10px,#ffffff_10px_14px,#2B4C8C_14px_24px,#ffffff_24px_28px)] opacity-90" />
          </div>
        )}
      </div>
    </div>
  )
}

/** Semana: uma coluna por dia; arrastar para outro dia mantém o horário. */
function GradeSemana({
  inicio, itens, onAbrir, onNovo, onAbrirDia,
}: {
  inicio: string
  itens: Agendamento[]
  onAbrir: (a: Agendamento) => void
  onNovo: (p: Preenchimento) => void
  onAbrirDia: (d: string) => void
}) {
  const remarcar = useRemarcar()
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
  const hoje = hojeISO()

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="grid min-w-[56rem] grid-cols-7 divide-x">
        {dias.map((d) => {
          const doDia = itens.filter((a) => a.date.slice(0, 10) === d).sort((a, b) => a.start_time.localeCompare(b.start_time))
          const ativos = doDia.filter((a) => a.status !== "cancelado").length
          return (
            <div
              key={d}
              className="flex min-h-[26rem] flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = Number(e.dataTransfer.getData("text/agendamento"))
                const a = itens.find((x) => x.id === id)
                if (a && a.date.slice(0, 10) !== d) remarcar.mutate({ id, dataAgendamento: d })
              }}
            >
              <button
                type="button"
                onClick={() => onAbrirDia(d)}
                className={cn("border-b px-3 py-2 text-left hover:bg-muted/60", d === hoje && "bg-primary/10")}
              >
                <span className="block text-xs text-muted-foreground uppercase">{diaSemanaCurto(d)}</span>
                <span className="font-semibold">{deISO(d).getDate()}</span>
                <span className="ml-2 text-xs text-muted-foreground">{ativos ? `${ativos} atend.` : ""}</span>
              </button>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {doDia.map((a) => (
                  <Cartao key={a.id} a={a} comProfissional onAbrir={() => onAbrir(a)} />
                ))}
                <button
                  type="button"
                  onClick={() => onNovo({ data: d })}
                  className="mt-auto rounded-md py-1.5 text-xs text-muted-foreground opacity-0 transition hover:bg-muted hover:opacity-100 focus-visible:opacity-100"
                >
                  + Marcar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Agenda() {
  const [visao, setVisao] = useState<"dia" | "semana">(() => (new URLSearchParams(location.search).get("visao") === "semana" ? "semana" : "dia"))
  const [data, setData] = useState(hojeISO())
  const [filtroProf, setFiltroProf] = useState("todos")
  const [aberto, setAberto] = useState<Agendamento | null>(null)
  const [novo, setNovo] = useState<Preenchimento | null>(null)

  const { data: profissionais = [], isLoading: carregandoProf } = useProfissionais()
  const { data: expediente = [] } = useExpediente()

  const inicio = inicioSemana(data)
  const filtro = visao === "dia" ? { data } : { inicio, fim: somarDias(inicio, 6) }
  const { data: itens = [], isLoading } = useAgendamentos(filtro)

  // o detalhe aberto acompanha as mudanças (status, horário)
  const abertoAtual = aberto ? itens.find((a) => a.id === aberto.id) ?? aberto : null

  const colunas = useMemo(() => {
    const ativos = profissionais.filter((p) => p.active || itens.some((a) => a.worker?.id === p.id))
    return filtroProf === "todos" ? ativos : ativos.filter((p) => String(p.id) === filtroProf)
  }, [profissionais, itens, filtroProf])

  const itensFiltrados = filtroProf === "todos" ? itens : itens.filter((a) => String(a.worker?.id) === filtroProf)
  const passo = visao === "dia" ? 1 : 7
  const titulo =
    visao === "dia"
      ? dataLonga(data)
      : `${deISO(inicio).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${deISO(somarDias(inicio, 6)).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={visao === "dia" ? "Dia anterior" : "Semana anterior"} onClick={() => setData(somarDias(data, -passo))}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" onClick={() => setData(hojeISO())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label={visao === "dia" ? "Próximo dia" : "Próxima semana"} onClick={() => setData(somarDias(data, passo))}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <h2 className="text-lg font-semibold first-letter:uppercase">{titulo}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={filtroProf} onValueChange={setFiltroProf}>
            <SelectTrigger className="w-52" aria-label="Filtrar por profissional">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os profissionais</SelectItem>
              {profissionais.filter((p) => p.active).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {visao === "dia" && <ListaEsperaDia data={data} />}
          <Tabs value={visao} onValueChange={(v) => setVisao(v as "dia" | "semana")}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setNovo({ data, barbeiroId: filtroProf !== "todos" ? Number(filtroProf) : undefined })}>
            <Plus aria-hidden /> Novo agendamento
          </Button>
        </div>
      </div>

      <p className="mb-3 hidden text-xs text-muted-foreground md:block">
        Arraste um agendamento para remarcar. {visao === "dia" ? "Dois cliques num horário vazio marcam um novo." : "Clique no dia para ver a grade de horários."}
      </p>

      {isLoading || carregandoProf ? (
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      ) : visao === "dia" ? (
        colunas.length ? (
          <GradeDia data={data} itens={itensFiltrados} profissionais={colunas} expediente={expediente} onAbrir={setAberto} onNovo={setNovo} />
        ) : (
          <div className="rounded-xl border border-dashed px-6 py-16 text-center">
            <p className="font-medium">Nenhum profissional cadastrado</p>
            <p className="text-sm text-muted-foreground">Cadastre quem atende para montar a agenda.</p>
          </div>
        )
      ) : (
        <GradeSemana
          inicio={inicio}
          itens={itensFiltrados}
          onAbrir={setAberto}
          onNovo={setNovo}
          onAbrirDia={(d) => {
            setData(d)
            setVisao("dia")
          }}
        />
      )}

      <DetalheAgendamento agendamento={abertoAtual} onFechar={() => setAberto(null)} />
      <NovoAgendamento aberto={!!novo} onFechar={() => setNovo(null)} inicial={novo ?? { data }} />
    </div>
  )
}
