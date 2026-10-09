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

export type Pagina = {
  estilo: "moderno" | "classico" | "vintage" | "urbano" | "minimalista"
  fonte: "figtree" | "bebas" | "playfair" | "oswald" | "dm-serif" | "archivo"
  modo: "auto" | "claro" | "escuro"
  textura: "liso" | "couro" | "madeira" | "concreto"
  capa_url: string | null
  boas_vindas: string | null
  sobre: string | null
  mensagem_sucesso: string | null
  endereco: string | null
  mapa_url: string | null
  mostrar_horarios: boolean
  instagram: string | null
  whatsapp: string | null
  galeria: { id: number; url: string; legenda: string | null }[]
  seletor_servicos?: "lista" | "compacta" | "cards" | "dropdown" | "chips" | "carrossel" | "mosaico" | "cardapio" | "vitrine" | "sanfona"
  seletor_profissionais?: Pagina["seletor_servicos"]
  seletor_horarios?: "lista" | "compacta" | "calendario" | "dropdown" | "periodos" | "linha_tempo" | "proximos" | "semana" | "cartoes" | "sanfona"
}
export type Identidade = { name: string; subtitle: string | null; logo_url: string | null; city: string | null; state: string | null; accent_color: string; secondary_color: string; lista_espera?: boolean; pagina?: Pagina | null; avaliacoes?: { media: number; total: number } | null }
export type AvaliacaoPublica = { id: number; nota: number; comentario: string; cliente: string; profissional: string | null; em: string; resposta: string | null }
export type Servico = { id: number; name: string; description: string | null; duration_time: number | null; price: string | number; active: boolean; photo?: string | null; destaque?: "mais_pedido" | "novo" | null; categoria?: string | null }
export type Profissional = { id: number; name: string; photo: string | null; speciality: string | null; active: boolean; bio?: string | null; instagram?: string | null }
export type MeuHorario = {
  status: "pendente" | "confirmado" | "concluido" | "cancelado" | "falta"
  date: string
  start_time: string
  end_time: string
  duracao: number
  cliente: string | null
  profissional: { id: number; name: string; photo: string | null } | null
  servicos: string[]
  valor: number
  pode_alterar: boolean
  pode_confirmar?: boolean
  motivo: string | null
  antecedencia_horas: number
  fidelidade: { selos: number; meta: number; premio: string | null; premio_disponivel: boolean } | null
}
export type Aviso = { exibir: boolean; dados: { titulo: string; mensagem: string } | null }
