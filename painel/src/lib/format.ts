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

/** "2026-10-08" → Date local (meia-noite, sem deslocar por fuso). */
export function deISO(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(a, m - 1, d)
}

export function somarDias(iso: string, n: number) {
  const d = deISO(iso)
  d.setDate(d.getDate() + n)
  return hojeISO(d)
}

/** Segunda-feira da semana da data. */
export function inicioSemana(iso: string) {
  const dow = deISO(iso).getDay() // 0 = domingo
  return somarDias(iso, dow === 0 ? -6 : 1 - dow)
}

/** "09:30" ou "09:30:00" → minutos desde 00:00. */
export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + (m || 0)
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

export const diaSemanaCurto = (iso: string) =>
  deISO(iso).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")

export const dataLonga = (iso: string) =>
  deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })

/** Telefone salvo como 55DDDNÚMERO → (DD) 9XXXX-XXXX */
export function fone(p: string | null | undefined) {
  if (!p) return ""
  const d = p.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}
