// Cliente da API do Vellis.
// Mesma sessão do painel antigo (localStorage "admin_token") e mesma
// configuração por servidor (window.CRM_ENV, definido em /js/env.js).

declare global {
  interface Window {
    CRM_ENV?: { API_BASE_URL?: string; BOOKING_URL?: string }
  }
}

export const API_BASE_URL: string =
  window.CRM_ENV?.API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  `${location.protocol}//${location.hostname}:8000/api`

const TOKEN_KEY = "admin_token"

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export function sair() {
  localStorage.removeItem(TOKEN_KEY)
  window.location.href = "/login.html"
}

/** Erro da API com a mensagem já pronta para mostrar ao usuário. */
export class ApiError extends Error {
  status: number
  code?: string
  errors?: Record<string, string[]>

  constructor(status: number, message: string, code?: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.code = code
    this.errors = errors
  }
}

type Opcoes = Omit<RequestInit, "body"> & { body?: unknown }

export async function api<T = unknown>(path: string, { body, headers, ...opts }: Opcoes = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique a internet e tente de novo.")
  }

  if (res.status === 401) {
    sair()
    throw new ApiError(401, "Sessão expirada.")
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errors = data?.errors as Record<string, string[]> | undefined
    const primeiro = errors ? Object.values(errors).flat()[0] : undefined
    const msg =
      res.status === 429
        ? "Muitas tentativas seguidas. Aguarde um minuto."
        : primeiro || data?.message || "Não foi possível concluir. Tente de novo."
    throw new ApiError(res.status, msg, data?.code, errors)
  }

  return data as T
}

/** Envia um arquivo (multipart) — upload de logo e de foto. */
export async function enviarArquivo<T = unknown>(path: string, arquivo: File): Promise<T> {
  const corpo = new FormData()
  corpo.append("arquivo", arquivo)
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: corpo,
    })
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique a internet e tente de novo.")
  }
  if (res.status === 401) {
    sair()
    throw new ApiError(401, "Sessão expirada.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = data?.errors as Record<string, string[]> | undefined
    throw new ApiError(res.status, (errors && Object.values(errors).flat()[0]) || data?.message || "Não foi possível enviar a imagem.", data?.code, errors)
  }
  return data as T
}
