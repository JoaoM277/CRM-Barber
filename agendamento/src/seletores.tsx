// Modelos de seletor: como o cliente escolhe serviços (vários) e profissional (um).
// A barbearia escolhe no painel: Básico = lista; Pro = 5 modelos; Premium = 10.
import { useState, type ReactNode } from "react"
import { Check, ChevronDown, Clock, Scissors, Sparkles, UserRound } from "lucide-react"
import clsx from "clsx"
import type { Pagina, Profissional, Servico } from "./lib/api"
import { moeda } from "./ui"

export type Modelo = NonNullable<Pagina["seletor_servicos"]>

export const QUALQUER = "qualquer" as const
type EscolhaProf = number | typeof QUALQUER | null

/* --------------------------------------------------------------- peças comuns */

export function Escolha({ selecionado, onClick, children, rotulo, className }: { selecionado: boolean; onClick: () => void; children: ReactNode; rotulo?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      aria-label={rotulo}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl border bg-cartao p-4 text-left transition active:scale-[.99]",
        selecionado ? "border-marca ring-2 ring-marca/40" : "border-linha hover:border-suave/50",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Marcador({ ativo, redondo, pequeno }: { ativo: boolean; redondo?: boolean; pequeno?: boolean }) {
  return (
    <span className={clsx("grid shrink-0 place-items-center border-2 transition", pequeno ? "size-5" : "size-6", redondo ? "rounded-full" : "rounded-md", ativo ? "border-marca bg-marca text-sobre-marca" : "border-linha")} aria-hidden>
      {ativo && <Check className={pequeno ? "size-3" : "size-4"} strokeWidth={3} />}
    </span>
  )
}

/** Selo de escolhido sobre fotos (cards, mosaico, carrossel). */
function SeloEscolhido({ ativo }: { ativo: boolean }) {
  if (!ativo) return null
  return (
    <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-marca text-sobre-marca shadow" aria-hidden>
      <Check className="size-4" strokeWidth={3} />
    </span>
  )
}

const minutosDe = (s: Servico) => Number(s.duration_time) || 30
const precoDe = (s: Servico) => moeda(Number(s.price))

function Destaque({ s }: { s: Servico }) {
  if (!s.destaque) return null
  return <span className="ml-2 inline-block rounded-full bg-marca/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-marca">{s.destaque === "novo" ? "Novo" : "Mais pedido"}</span>
}

/** Foto do serviço ou um ícone na cor da marca. */
function FotoServico({ s, className }: { s: Servico; className?: string }) {
  return s.photo
    ? <img src={s.photo} alt="" loading="lazy" decoding="async" className={clsx("object-cover", className)} />
    : <span className={clsx("grid place-items-center bg-marca/12 text-marca", className)} aria-hidden><Scissors className="size-1/3 max-h-8 max-w-8" /></span>
}

function FotoProf({ p, className }: { p: Profissional; className?: string }) {
  return p.photo
    ? <img src={p.photo} alt="" loading="lazy" decoding="async" className={clsx("object-cover", className)} />
    : <span className={clsx("grid place-items-center bg-fundo font-semibold", className)} aria-hidden>{p.name.slice(0, 1).toUpperCase() || <UserRound className="size-5" />}</span>
}

function Titulo({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wide text-suave uppercase first:mt-0">{children}</h3>
}

/** Menu suspenso (dropdown) acessível, sem biblioteca. */
function Suspenso({ rotulo, resumo, children }: { rotulo: string; resumo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="rounded-2xl border border-linha bg-cartao">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="min-w-0">
          <span className="block text-xs font-medium text-suave">{rotulo}</span>
          <span className="block truncate font-semibold">{resumo}</span>
        </span>
        <ChevronDown className={clsx("size-5 shrink-0 text-suave transition", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && <div className="max-h-80 overflow-y-auto border-t border-linha p-1.5">{children}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- serviços (vários) */

export function SeletorServicos({ modelo, grupos, selecionados, alternar }: {
  modelo: Modelo
  grupos: [string, Servico[]][]
  selecionados: number[]
  alternar: (id: number) => void
}) {
  const todos = grupos.flatMap(([, l]) => l)
  const sel = (s: Servico) => selecionados.includes(s.id)
  const comTitulos = (render: (lista: Servico[]) => ReactNode) =>
    grupos.map(([cat, lista]) => (
      <div key={cat || "-"}>
        {cat && <Titulo>{cat}</Titulo>}
        {render(lista)}
      </div>
    ))

  switch (modelo) {
    case "compacta":
      return comTitulos((lista) => (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-cartao">
          {lista.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("flex w-full items-center gap-3 px-4 py-3 text-left transition", sel(s) && "bg-marca/8")}>
                <Marcador ativo={sel(s)} pequeno />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}<Destaque s={s} /></span>
                <span className="text-xs text-suave tabular">{minutosDe(s)} min</span>
                <span className="w-20 text-right font-semibold tabular">{precoDe(s)}</span>
              </button>
            </li>
          ))}
        </ul>
      ))

    case "cards":
      return comTitulos((lista) => (
        <ul className="grid grid-cols-2 gap-2.5">
          {lista.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-cartao text-left transition active:scale-[.98]", sel(s) ? "border-marca ring-2 ring-marca/40" : "border-linha")}>
                <FotoServico s={s} className="aspect-[4/3] w-full" />
                <SeloEscolhido ativo={sel(s)} />
                <span className="flex flex-1 flex-col p-3">
                  <span className="font-semibold leading-tight">{s.name}</span>
                  <span className="mt-auto flex items-end justify-between gap-2 pt-2 text-sm">
                    <span className="text-suave">{minutosDe(s)} min</span>
                    <span className="font-semibold tabular">{precoDe(s)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ))

    case "dropdown": {
      const escolhidos = todos.filter(sel)
      return (
        <Suspenso rotulo="Serviços" resumo={escolhidos.length ? escolhidos.map((s) => s.name).join(", ") : "Toque para escolher"}>
          {grupos.map(([cat, lista]) => (
            <div key={cat || "-"}>
              {cat && <p className="px-3 pt-3 pb-1 text-xs font-semibold text-suave uppercase">{cat}</p>}
              {lista.map((s) => (
                <button key={s.id} type="button" role="menuitemcheckbox" aria-checked={sel(s)} onClick={() => alternar(s.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-fundo">
                  <Marcador ativo={sel(s)} pequeno />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-sm font-semibold tabular">{precoDe(s)}</span>
                </button>
              ))}
            </div>
          ))}
        </Suspenso>
      )
    }

    case "chips":
      return comTitulos((lista) => (
        <div className="flex flex-wrap gap-2">
          {lista.map((s) => (
            <button key={s.id} type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition", sel(s) ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}>
              {sel(s) && <Check className="size-4" strokeWidth={3} aria-hidden />}
              {s.name}
              <span className={clsx("tabular", sel(s) ? "opacity-90" : "text-suave")}>· {precoDe(s)}</span>
            </button>
          ))}
        </div>
      ))

    case "carrossel":
      return (
        <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {todos.map((s) => (
            <li key={s.id} className="w-44 shrink-0 snap-start">
              <button type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("relative flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-cartao text-left transition", sel(s) ? "border-marca ring-2 ring-marca/40" : "border-linha")}>
                <FotoServico s={s} className="aspect-[3/4] w-full" />
                <SeloEscolhido ativo={sel(s)} />
                <span className="p-3">
                  <span className="block font-semibold leading-tight">{s.name}</span>
                  <span className="mt-1 block text-sm text-suave">{minutosDe(s)} min · <strong className="text-texto tabular">{precoDe(s)}</strong></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )

    case "mosaico":
      return (
        <ul className="grid grid-cols-3 gap-1.5">
          {todos.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} aria-label={`${s.name}, ${precoDe(s)}`} className={clsx("relative block aspect-square w-full overflow-hidden rounded-xl transition", sel(s) && "ring-3 ring-marca")}>
                <FotoServico s={s} className="size-full" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-left text-white">
                  <span className="block text-xs leading-tight font-semibold">{s.name}</span>
                  <span className="text-[11px] tabular opacity-90">{precoDe(s)}</span>
                </span>
                <SeloEscolhido ativo={sel(s)} />
              </button>
            </li>
          ))}
        </ul>
      )

    case "cardapio":
      return (
        <div className="rounded-2xl border border-linha bg-cartao px-5 py-4">
          {grupos.map(([cat, lista]) => (
            <div key={cat || "-"} className="mb-3 last:mb-0">
              {cat && <p className="mt-2 mb-2 text-center text-xs font-semibold tracking-[.2em] text-marca uppercase">{cat}</p>}
              {lista.map((s) => (
                <button key={s.id} type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition", sel(s) && "bg-marca/10")}>
                  <span className="flex items-baseline gap-2">
                    {sel(s) && <Check className="size-4 shrink-0 self-center text-marca" strokeWidth={3} aria-hidden />}
                    <span className="font-semibold">{s.name}</span>
                    <span className="min-w-4 flex-1 translate-y-[-3px] border-b-2 border-dotted border-linha" aria-hidden />
                    <span className="font-semibold tabular">{precoDe(s)}</span>
                  </span>
                  <span className="block text-xs text-suave">{s.description ? `${s.description} · ` : ""}{minutosDe(s)} min</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )

    case "vitrine": {
      const capa = todos.find((s) => s.destaque) ?? todos[0]
      const resto = todos.filter((s) => s.id !== capa?.id)
      return (
        <div className="grid gap-2.5">
          {capa && (
            <button type="button" onClick={() => alternar(capa.id)} aria-pressed={sel(capa)} className={clsx("relative overflow-hidden rounded-3xl border text-left transition", sel(capa) ? "border-marca ring-2 ring-marca/40" : "border-linha")}>
              <FotoServico s={capa} className="aspect-[16/9] w-full" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 p-4 text-white">
                {capa.destaque && <span className="mb-1 inline-block rounded-full bg-marca px-2 py-0.5 text-[11px] font-semibold text-sobre-marca">{capa.destaque === "novo" ? "Novo" : "Mais pedido"}</span>}
                <span className="block text-xl font-bold">{capa.name}</span>
                <span className="text-sm opacity-90">{minutosDe(capa)} min · <strong className="tabular">{precoDe(capa)}</strong></span>
              </span>
              <SeloEscolhido ativo={sel(capa)} />
            </button>
          )}
          {resto.map((s) => (
            <Escolha key={s.id} selecionado={sel(s)} onClick={() => alternar(s.id)} className="py-3">
              <Marcador ativo={sel(s)} />
              <span className="min-w-0 flex-1 font-semibold">{s.name}<Destaque s={s} /></span>
              <span className="font-semibold tabular">{precoDe(s)}</span>
            </Escolha>
          ))}
        </div>
      )
    }

    case "sanfona":
      return <Sanfona grupos={grupos.length === 1 && !grupos[0][0] ? [["Serviços", grupos[0][1]]] : grupos} sel={sel} alternar={alternar} />

    default: // lista
      return comTitulos((lista) => (
        <ul className="grid gap-2.5">
          {lista.map((s) => (
            <li key={s.id}>
              <Escolha selecionado={sel(s)} onClick={() => alternar(s.id)}>
                <Marcador ativo={sel(s)} />
                {s.photo && <img src={s.photo} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.name}<Destaque s={s} /></span>
                  {s.description && <span className="block truncate text-sm text-suave">{s.description}</span>}
                  <span className="mt-0.5 inline-flex items-center gap-1 text-sm text-suave"><Clock className="size-3.5" aria-hidden /> {minutosDe(s)} min</span>
                </span>
                <span className="font-semibold tabular">{precoDe(s)}</span>
              </Escolha>
            </li>
          ))}
        </ul>
      ))
  }
}

function Sanfona({ grupos, sel, alternar }: { grupos: [string, Servico[]][]; sel: (s: Servico) => boolean; alternar: (id: number) => void }) {
  const [aberta, setAberta] = useState<string>(grupos[0]?.[0] ?? "")
  return (
    <div className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-cartao">
      {grupos.map(([cat, lista]) => {
        const nome = cat || "Outros"
        const marcados = lista.filter(sel).length
        const estaAberta = aberta === cat
        return (
          <section key={nome}>
            <button type="button" onClick={() => setAberta(estaAberta ? "\u0000" : cat)} aria-expanded={estaAberta} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-semibold">
              <span>{nome} <span className="font-normal text-suave">({lista.length})</span></span>
              <span className="flex items-center gap-2">
                {marcados > 0 && <span className="rounded-full bg-marca px-2 py-0.5 text-xs text-sobre-marca">{marcados}</span>}
                <ChevronDown className={clsx("size-5 text-suave transition", estaAberta && "rotate-180")} aria-hidden />
              </span>
            </button>
            {estaAberta && (
              <ul className="px-2 pb-2">
                {lista.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => alternar(s.id)} aria-pressed={sel(s)} className={clsx("flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left", sel(s) && "bg-marca/8")}>
                      <Marcador ativo={sel(s)} pequeno />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.name}<Destaque s={s} /></span>
                        <span className="text-xs text-suave">{minutosDe(s)} min</span>
                      </span>
                      <span className="font-semibold tabular">{precoDe(s)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- profissional (um) */

export function SeletorProfissionais({ modelo, profissionais, valor, escolher }: {
  modelo: Modelo
  profissionais: Profissional[]
  valor: EscolhaProf
  escolher: (v: number | typeof QUALQUER) => void
}) {
  const ehQualquer = valor === QUALQUER
  const IconeQualquer = ({ className }: { className?: string }) => (
    <span className={clsx("grid place-items-center bg-marca/15 text-marca", className)} aria-hidden><Sparkles className="size-5" /></span>
  )
  const Instagram = ({ p }: { p: Profissional }) =>
    p.instagram ? (
      <a href={p.instagram} target="_blank" rel="noopener" className="mt-1 ml-4 inline-flex text-xs font-medium text-suave underline-offset-2 hover:underline">
        Ver trabalhos de {p.name.split(" ")[0]} no Instagram
      </a>
    ) : null

  switch (modelo) {
    case "compacta":
      return (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-cartao">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <li key={p?.id ?? "q"}>
                <button type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className={clsx("flex w-full items-center gap-3 px-4 py-2.5 text-left", ativo && "bg-marca/8")}>
                  {p ? <FotoProf p={p} className="size-8 shrink-0 rounded-full text-sm" /> : <IconeQualquer className="size-8 shrink-0 rounded-full" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{p ? p.name : "Sem preferência"}</span>
                  {p?.speciality && <span className="hidden truncate text-xs text-suave sm:block">{p.speciality}</span>}
                  <Marcador ativo={ativo} redondo pequeno />
                </button>
              </li>
            )
          })}
        </ul>
      )

    case "cards":
    case "mosaico": {
      const mosaico = modelo === "mosaico"
      return (
        <ul className={clsx("grid gap-2.5", mosaico ? "grid-cols-3 gap-1.5" : "grid-cols-2")}>
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <li key={p?.id ?? "q"}>
                <button type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className={clsx("relative flex h-full w-full flex-col items-center overflow-hidden border bg-cartao text-center transition", mosaico ? "rounded-xl" : "rounded-2xl p-4", ativo ? "border-marca ring-2 ring-marca/40" : "border-linha")}>
                  {mosaico ? (
                    <>
                      {p ? <FotoProf p={p} className="aspect-square w-full text-2xl" /> : <IconeQualquer className="aspect-square w-full" />}
                      <span className="w-full truncate px-1.5 py-2 text-xs font-semibold">{p ? p.name : "Sem preferência"}</span>
                    </>
                  ) : (
                    <>
                      {p ? <FotoProf p={p} className="size-20 rounded-full text-2xl" /> : <IconeQualquer className="size-20 rounded-full" />}
                      <span className="mt-2 font-semibold leading-tight">{p ? p.name : "Sem preferência"}</span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-suave">{p ? p.speciality ?? "" : "Mais horários"}</span>
                    </>
                  )}
                  <SeloEscolhido ativo={ativo} />
                </button>
              </li>
            )
          })}
        </ul>
      )
    }

    case "dropdown": {
      const atual = profissionais.find((p) => p.id === valor)
      return (
        <Suspenso rotulo="Profissional" resumo={ehQualquer ? "Sem preferência" : atual?.name ?? "Toque para escolher"}>
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <button key={p?.id ?? "q"} type="button" role="menuitemradio" aria-checked={ativo} onClick={() => escolher(p ? p.id : QUALQUER)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-fundo">
                {p ? <FotoProf p={p} className="size-9 shrink-0 rounded-full text-sm" /> : <IconeQualquer className="size-9 shrink-0 rounded-full" />}
                <span className="min-w-0 flex-1 truncate">{p ? p.name : "Sem preferência"}</span>
                <Marcador ativo={ativo} redondo pequeno />
              </button>
            )
          })}
        </Suspenso>
      )
    }

    case "chips":
      return (
        <div className="flex flex-wrap gap-2">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <button key={p?.id ?? "q"} type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className={clsx("inline-flex items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-medium transition", ativo ? "border-marca bg-marca text-sobre-marca" : "border-linha bg-cartao")}>
                {p ? <FotoProf p={p} className="size-7 rounded-full text-xs text-texto" /> : <IconeQualquer className="size-7 rounded-full" />}
                {p ? p.name : "Sem preferência"}
              </button>
            )
          })}
        </div>
      )

    case "carrossel":
      // estilo "stories": fotos redondas grandes rolando para o lado
      return (
        <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <li key={p?.id ?? "q"} className="w-24 shrink-0 snap-start">
                <button type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className="flex w-full flex-col items-center gap-2 text-center">
                  <span className={clsx("rounded-full p-1 transition", ativo ? "bg-marca" : "bg-linha")}>
                    {p ? <FotoProf p={p} className="size-20 rounded-full border-2 border-cartao text-2xl" /> : <IconeQualquer className="size-20 rounded-full border-2 border-cartao" />}
                  </span>
                  <span className={clsx("w-full truncate text-sm", ativo ? "font-bold" : "font-medium")}>{p ? p.name.split(" ")[0] : "Qualquer um"}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )

    case "cardapio":
      return (
        <div className="rounded-2xl border border-linha bg-cartao px-5 py-4">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <button key={p?.id ?? "q"} type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className={clsx("-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-2 rounded-lg px-2 py-2.5 text-left", ativo && "bg-marca/10")}>
                {ativo && <Check className="size-4 shrink-0 self-center text-marca" strokeWidth={3} aria-hidden />}
                <span className="font-semibold">{p ? p.name : "Sem preferência"}</span>
                <span className="min-w-4 flex-1 translate-y-[-3px] border-b-2 border-dotted border-linha" aria-hidden />
                <span className="text-sm text-suave">{p ? p.speciality ?? "" : "mais horários"}</span>
              </button>
            )
          })}
        </div>
      )

    case "vitrine":
      // cartões de perfil: foto grande, especialidade e bio
      return (
        <ul className="grid gap-3">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <li key={p?.id ?? "q"}>
                <button type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} className={clsx("relative flex w-full items-stretch overflow-hidden rounded-3xl border bg-cartao text-left transition", ativo ? "border-marca ring-2 ring-marca/40" : "border-linha")}>
                  {p ? <FotoProf p={p} className="w-28 shrink-0 text-3xl" /> : <IconeQualquer className="w-28 shrink-0" />}
                  <span className="min-w-0 flex-1 p-4">
                    <span className="block text-lg font-bold leading-tight">{p ? p.name : "Sem preferência"}</span>
                    <span className="block text-sm font-medium text-marca">{p ? p.speciality ?? "" : "Mais horários disponíveis"}</span>
                    {p?.bio && <span className="mt-1 line-clamp-3 block text-sm text-suave">{p.bio}</span>}
                  </span>
                  <SeloEscolhido ativo={ativo} />
                </button>
                {p && <Instagram p={p} />}
              </li>
            )
          })}
        </ul>
      )

    case "sanfona":
      // toque escolhe e abre a bio
      return (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-cartao">
          {[null, ...profissionais].map((p) => {
            const ativo = p ? valor === p.id : ehQualquer
            return (
              <li key={p?.id ?? "q"} className={clsx(ativo && "bg-marca/6")}>
                <button type="button" onClick={() => escolher(p ? p.id : QUALQUER)} aria-pressed={ativo} aria-expanded={ativo} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {p ? <FotoProf p={p} className="size-11 shrink-0 rounded-full" /> : <IconeQualquer className="size-11 shrink-0 rounded-full" />}
                  <span className="min-w-0 flex-1 font-semibold">{p ? p.name : "Sem preferência"}</span>
                  <ChevronDown className={clsx("size-5 text-suave transition", ativo && "rotate-180")} aria-hidden />
                </button>
                {ativo && (
                  <div className="px-4 pb-4 pl-[4.75rem] text-sm text-suave">
                    {p ? (
                      <>
                        {p.speciality && <p className="font-medium text-texto">{p.speciality}</p>}
                        {p.bio && <p className="mt-0.5">{p.bio}</p>}
                        {!p.speciality && !p.bio && <p>Escolhido. Continue para ver os horários.</p>}
                        <Instagram p={p} />
                      </>
                    ) : <p>Mostramos os horários de toda a equipe.</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )

    default: // lista
      return (
        <ul className="grid gap-2.5">
          <li>
            <Escolha selecionado={ehQualquer} onClick={() => escolher(QUALQUER)}>
              <IconeQualquer className="size-12 shrink-0 rounded-full" />
              <span className="flex-1">
                <span className="block font-semibold">Sem preferência</span>
                <span className="text-sm text-suave">Mais horários disponíveis</span>
              </span>
              <Marcador ativo={ehQualquer} redondo />
            </Escolha>
          </li>
          {profissionais.map((p) => (
            <li key={p.id}>
              <Escolha selecionado={valor === p.id} onClick={() => escolher(p.id)}>
                <FotoProf p={p} className="size-12 shrink-0 rounded-full text-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  {p.speciality && <span className="block truncate text-sm text-suave">{p.speciality}</span>}
                  {p.bio && <span className="mt-0.5 line-clamp-2 block text-sm text-suave">{p.bio}</span>}
                </span>
                <Marcador ativo={valor === p.id} redondo />
              </Escolha>
              <Instagram p={p} />
            </li>
          ))}
        </ul>
      )
  }
}
