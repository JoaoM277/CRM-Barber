// API pública da barbearia (sem login): /api/b/{slug}/...

declare global {
  interface Window {
    CRM_ENV?: { API_BASE_URL?: string; DEFAULT_BARBERSHOP_SLUG?: string }
  }
}

const API = window.CRM_ENV?.API_BASE_URL ?? import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:8000/api`

/** Qual barbearia: ?b=slug (ou ?barbershop=), subdomínio (slug.agenda.dominio) ou a padrão do servidor. */
export function slugDaPagina(): string | null {
  const p = new URLSearchParams(location.search)
  const daUrl = p.get("b") || p.get("barbershop")
  if (daUrl) return daUrl.trim()
  const partes = location.hostname.split(".")
  if (partes.length >= 4 && !["www", "app", "api", "barber"].includes(partes[0])) return partes[0]
  return window.CRM_ENV?.DEFAULT_BARBERSHOP_SLUG ?? null
}

export class ErroApi extends Error {
  status: number
  code?: string
  campos?: Record<string, string>
  constructor(status: number, msg: string, code?: string, campos?: Record<string, string>) {
    super(msg)
    this.status = status
    this.code = code
    this.campos = campos
  }
}

export async function api<T>(slug: string, caminho: string, corpo?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/b/${encodeURIComponent(slug)}${caminho}`, {
      method: corpo ? "POST" : "GET",
      headers: { Accept: "application/json", ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new ErroApi(0, "Sem conexão. Verifique a internet e tente de novo.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const campos = data?.errors ? Object.fromEntries(Object.entries(data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]])) : undefined
    const msg =
      res.status === 429 ? "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."
      : (campos && Object.values(campos)[0]) || data?.message || "Não foi possível concluir. Tente de novo."
    throw new ErroApi(res.status, msg, data?.code, campos)
  }
  return data as T
}

export type Identidade = { name: string; subtitle: string | null; logo_url: string | null; city: string | null; state: string | null; accent_color: string; secondary_color: string }
export type Servico = { id: number; name: string; description: string | null; duration_time: number | null; price: string | number; active: boolean }
export type Profissional = { id: number; name: string; photo: string | null; speciality: string | null; active: boolean }
export type MeuHorario = {
  status: "pendente" | "confirmado" | "concluido" | "cancelado"
  date: string
  start_time: string
  end_time: string
  duracao: number
  cliente: string | null
  profissional: { id: number; name: string; photo: string | null } | null
  servicos: string[]
  valor: number
  pode_alterar: boolean
  motivo: string | null
  antecedencia_horas: number
}
export type Aviso ={ exibir: boolean; dados: { titulo: string; mensagem: string } | null }
