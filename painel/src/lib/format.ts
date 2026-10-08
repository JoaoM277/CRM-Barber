const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export const moeda = (v: number | string | null | undefined) => brl.format(Number(v ?? 0))

/** "2026-10-08" ou ISO → "08/10/2026" (sem deslocar o dia por fuso). */
export function dataBR(v: string | null | undefined) {
  if (!v) return "—"
  const [a, m, d] = v.slice(0, 10).split("-")
  return `${d}/${m}/${a}`
}

/** Data de hoje no formato da API (YYYY-MM-DD), no fuso do navegador. */
export function hojeISO(d = new Date()) {
  const z = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function diasAte(iso: string | null | undefined) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/** Link público de agendamento da barbearia (o site do cliente fica no mesmo domínio). */
export const linkAgendamento = (slug: string) => `${location.origin}/index.html?b=${encodeURIComponent(slug)}`
