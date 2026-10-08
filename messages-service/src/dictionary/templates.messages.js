// --------------------------------------------------------------------------
// Dicionario de Templates de Mensagens (temporario)
// --------------------------------------------------------------------------

// Formata a lista de serviços do agendamento ("Corte, Barba") ou "" se vazia.
const formatServices = (services) => {
  if (!Array.isArray(services)) return "";
  const limpos = services.map((s) => String(s).trim()).filter(Boolean);
  return limpos.join(", ");
};

// Trecho " para o(s) serviço(s) X, Y" — só aparece quando há serviços.
const servicesClause = (services) => {
  const lista = formatServices(services);
  if (!lista) return "";
  const plural = lista.includes(",") ? "os serviços" : "o serviço";
  return ` para ${plural} ${lista}`;
};

const messageList = {
  AGENDAMENTO: (name, appointment) =>
    `Olá, ${name}! Seu agendamento${servicesClause(appointment?.services)} foi confirmado para o dia ${appointment?.date || "marcado"} às ${appointment?.time || "marcado"}${appointment?.barber ? ` com ${appointment.barber}` : ""}. Te esperamos! 💈`,

  LEMBRETE: (name, appointment) =>
    `Ei, ${name}, passando para lembrar do seu horário hoje às ${appointment?.time}${appointment?.services && formatServices(appointment.services) ? ` (${formatServices(appointment.services)})` : ""}! ⏰`,
};

// "08/10" a partir de "2026-10-08"
const diaMes = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().slice(0, 2).join("/") : "");
const naBarbearia = (a) => (a?.barbershop ? ` na ${a.barbershop}` : "");
const pedirResposta = (a) => {
  if (!a?.askReply) return "";
  return a?.allowCancel === false
    ? "\n\nResponda *1* para confirmar."
    : "\n\nResponda *1* para confirmar ou *2* para cancelar.";
};

// Lembretes automáticos (enviados pelo CRM 24h e 2h antes) e respostas ao cliente
messageList.LEMBRETE_24H = (name, a) =>
  `Olá, ${name}! Passando para lembrar: amanhã (${diaMes(a?.date)}) às ${a?.time} você tem horário${naBarbearia(a)}${a?.barber ? ` com ${a.barber}` : ""}${formatServices(a?.services) ? ` — ${formatServices(a.services)}` : ""}. 💈${pedirResposta(a)}`;

messageList.LEMBRETE_2H = (name, a) =>
  `${name}, seu horário${naBarbearia(a)} é hoje às ${a?.time}${a?.barber ? ` com ${a.barber}` : ""}. Até já! ⏰${pedirResposta(a)}`;

// Aviso de que a barbearia cancelou o horário (opção dos lembretes)
messageList.CANCELAMENTO = (name, a) =>
  `Olá, ${name}. Seu horário${naBarbearia(a)} do dia ${diaMes(a?.date)} às ${a?.time}${formatServices(a?.services) ? ` (${formatServices(a.services)})` : ""} foi cancelado.${a?.link ? `\n\nPara marcar um novo horário: ${a.link}` : " Para marcar um novo horário, fale com a barbearia."}`;

messageList.RESPOSTA_CONFIRMADO = (name, a) =>
  `Confirmado, ${name}! ✅ Te esperamos dia ${diaMes(a?.date)} às ${a?.time}.`;

messageList.RESPOSTA_CANCELADO = (name, a) =>
  `Tudo certo, ${name}: seu horário do dia ${diaMes(a?.date)} às ${a?.time} foi cancelado. Quando quiser, é só agendar de novo pelo link da barbearia.`;

module.exports = messageList;
