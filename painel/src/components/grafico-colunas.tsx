import { useEffect, useRef, useState } from "react"

export type Ponto = { rotulo: string; rotuloLongo: string; valor: number }

/**
 * Colunas de uma série só (sem legenda: o título do cartão nomeia a série).
 * Colunas finas com topo arredondado, grade discreta, valor no hover e
 * versão em tabela para quem não enxerga o gráfico.
 */
export function GraficoColunas({ pontos, formatar, descricao }: { pontos: Ponto[]; formatar: (v: number) => string; descricao: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(600)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 200, ESQ = 52, BASE = 176, TOPO = 10
  const max = Math.max(1, ...pontos.map((p) => p.valor))
  // marcas do eixo em valores redondos
  const bruto = max / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto
  const teto = passo * Math.ceil(max / passo)
  const y = (v: number) => BASE - ((BASE - TOPO) * v) / teto
  const faixa = (largura - ESQ) / Math.max(1, pontos.length)
  const larg = Math.min(20, Math.max(3, faixa - 3))
  const cadaRotulo = Math.ceil(pontos.length / Math.max(1, Math.floor((largura - ESQ) / 56)))
  const compacto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("pt-BR"))

  return (
    <div>
      <div ref={caixa} className="relative" onMouseLeave={() => setAtivo(null)}>
        <svg width={largura} height={H} viewBox={`0 0 ${largura} ${H}`} role="img" aria-label={descricao} className="block overflow-visible">
          {Array.from({ length: Math.round(teto / passo) + 1 }, (_, i) => i * passo).map((v) => (
            <g key={v}>
              <line x1={ESQ} x2={largura} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular">
                {compacto(v)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const cx = ESQ + faixa * i + faixa / 2
            const h = BASE - y(p.valor)
            const r = Math.min(4, h, larg / 2)
            const x0 = cx - larg / 2, x1 = cx + larg / 2, yt = BASE - h
            return (
              <g key={i}>
                {p.valor > 0 && (
                  <path
                    d={`M${x0},${BASE} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${BASE} Z`}
                    className={ativo === i ? "fill-chart-1 opacity-80" : "fill-chart-1"}
                  />
                )}
                {(i % cadaRotulo === 0 || i === pontos.length - 1) && (pontos.length - 1 - i >= cadaRotulo / 2 || i === pontos.length - 1) && (
                  <text x={cx} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {p.rotulo}
                  </text>
                )}
                {/* alvo de hover: a faixa inteira, maior que a coluna */}
                <rect x={ESQ + faixa * i} y={TOPO} width={faixa} height={BASE - TOPO} fill="transparent" onMouseEnter={() => setAtivo(i)} />
              </g>
            )
          })}
        </svg>
        {ativo !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: ESQ + faixa * ativo + faixa / 2, top: y(pontos[ativo].valor) - 6 }}
          >
            <span className="text-muted-foreground">{pontos[ativo].rotuloLongo}</span> · <strong className="tabular">{formatar(pontos[ativo].valor)}</strong>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm text-muted-foreground">
        <summary className="cursor-pointer">Ver como tabela</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {pontos.filter((p) => p.valor > 0).map((p) => (
              <tr key={p.rotuloLongo} className="border-t">
                <td className="py-1">{p.rotuloLongo}</td>
                <td className="py-1 text-right tabular">{formatar(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
