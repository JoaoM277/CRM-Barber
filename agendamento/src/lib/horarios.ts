// Cálculo dos horários livres, a partir do que a API pública devolve:
// expediente (com almoço) por dia da semana + horários já ocupados por profissional.
// O servidor revalida tudo ao agendar; isto só evita oferecer horário que não existe.

export type Expediente = {
  day_of_week: number
  active: boolean
  start_time: string
  end_time: string
  waiting_start: string | null
  waiting_end: string | null
}
export type Ocupado = { date: string; start_time: string; end_time: string; worker_id: number }
export type Horario = { hora: string; profissionalId: number }

export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + (m || 0)
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

export function isoLocal(d: Date) {
  const z = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export function deISO(iso: string) {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(a, m - 1, d)
}

/** Antecedência mínima para agendar hoje (minutos a partir de agora). */
const ANTECEDENCIA = 15

/**
 * Horários livres de um dia para a duração pedida.
 * profissionais: os candidatos (um só, ou todos em "sem preferência").
 * Em "sem preferência", cada horário vai para o profissional livre com menos
 * atendimentos no dia (distribui o movimento entre a equipe).
 */
export function horariosLivres(
  data: string,
  duracao: number,
  profissionais: number[],
  expediente: Expediente[],
  ocupados: Ocupado[],
  agora = new Date(),
): Horario[] {
  const dia = expediente.find((e) => e.day_of_week === deISO(data).getDay())
  if (!dia || !dia.active || !profissionais.length) return []

  const ini = minutos(dia.start_time)
  const fim = minutos(dia.end_time)
  const almocoIni = dia.waiting_start ? minutos(dia.waiting_start) : null
  const almocoFim = dia.waiting_end ? minutos(dia.waiting_end) : null
  const passo = duracao % 30 === 0 ? 30 : 15

  const ehHoje = data === isoLocal(agora)
  const limite = agora.getHours() * 60 + agora.getMinutes() + ANTECEDENCIA

  const doDia = ocupados
    .filter((o) => o.date.slice(0, 10) === data)
    .map((o) => ({ worker: o.worker_id, ini: minutos(o.start_time), fim: minutos(o.end_time) }))
  const cargaDoDia = (w: number) => doDia.filter((o) => o.worker === w).length

  const livres: Horario[] = []
  for (let t = ini; t + duracao <= fim; t += passo) {
    if (ehHoje && t < limite) continue
    if (almocoIni !== null && almocoFim !== null && t < almocoFim && t + duracao > almocoIni) continue

    const disponiveis = profissionais.filter((w) => !doDia.some((o) => o.worker === w && o.ini < t + duracao && o.fim > t))
    if (!disponiveis.length) continue

    const escolhido = disponiveis.reduce((a, b) => (cargaDoDia(b) < cargaDoDia(a) ? b : a))
    livres.push({ hora: hhmm(t), profissionalId: escolhido })
  }
  return livres
}
