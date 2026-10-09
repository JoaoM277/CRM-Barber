// Formatos devolvidos pela API (só os campos que o painel usa).

export type Plano = {
  slug: string
  nome: string
  preco: number
  max_profissionais: number | null
  recursos: string[]
}

export type Assinatura = {
  status: "trialing" | "active" | "past_due" | "canceled"
  acesso: "full" | "read_only"
  em_carencia: boolean
  aceita_agendamentos: boolean
  acesso_ate: string | null
  trial_termina_em: string | null
  periodo_pago_ate: string | null
  cancelada_em: string | null
  forma_pagamento: "PIX" | "BOLETO" | "CREDIT_CARD" | null
  tem_assinatura_no_gateway: boolean
  plano: Plano | null
}

export type Me = {
  id: number
  name: string
  email: string
  role: "admin" | "user"
  barbershop_id: number
  assinatura: Assinatura | null
  suporte: boolean
}

export type Barbearia = {
  id: number
  name: string
  slug: string
  subtitle: string | null
  city: string | null
  state: string | null
  accent_color: string | null
  secondary_color: string | null
  logo_url: string | null
  alterar_pelo_link?: boolean
  antecedencia_alteracao_horas?: number
  lista_espera_ativa?: boolean
  modelo_equipe?: "solo" | "equipe"
}

export type PassoOnboarding = {
  id: "servicos" | "profissionais" | "horarios" | "whatsapp" | "link" | "agendamento"
  titulo: string
  descricao: string
  feito: boolean
}

export type Onboarding = {
  passos: PassoOnboarding[]
  feitos: number
  total: number
  concluido: boolean
  dispensado: boolean
  slug: string
}

export type StatusAgendamento = "pendente" | "confirmado" | "concluido" | "cancelado"

export type Agendamento = {
  id: number
  status: StatusAgendamento
  date: string
  start_time: string
  end_time: string
  observation: string | null
  price: number | string | null
  cliente_nome: string | null
  cliente_telefone: string | null
  worker: { id: number; name: string } | null
  servicos: { id: number; nome: string; preco: number }[]
  servicos_nomes: string
  produtos?: ItemProduto[]
  total_produtos?: number
  fidelidade?: Fidelidade | null
  client_id?: number | null
}

export type Fidelidade = { selos: number; meta: number; premio: string | null; premio_disponivel: boolean }

export type ItemProduto = { id: number; nome: string; quantidade: number; preco: number; total: number }

export type Produto = {
  id: number
  name: string
  description: string | null
  price: string | number
  cost: string | number | null
  stock: number
  stock_min: number | null
  commission_percent: string | number
  active: boolean
  estoque_baixo: boolean
}

export type Paginado<T> = {
  data: T[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
}

export type ResumoFaturamento = {
  dia: number
  mes: number
  ano: number
}

export type Profissional = {
  id: number
  name: string
  phone: string | null
  photo: string | null
  speciality: string | null
  active: boolean
  payment_type: "comissao" | "fixo" | "misto" | string | null
  commission_percent: number | string | null
  fixed_salary: number | string | null
  pix_key: string | null
  bio?: string | null
  instagram?: string | null
}

export type Servico = {
  id: number
  name: string
  description: string | null
  duration_time: number
  price: number | string
  active: boolean
  photo?: string | null
  destaque?: "mais_pedido" | "novo" | null
  categoria?: string | null
  ordem?: number
}

/** Horário de funcionamento de um dia da semana (0 = domingo … 6 = sábado). */
export type Expediente = {
  id: number
  day_of_week: number
  active: boolean
  start_time: string
  end_time: string
  waiting_start: string | null
  waiting_end: string | null
}
