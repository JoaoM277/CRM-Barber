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

  CANCELAMENTO: (name, appointment) =>
    `Olá, ${name}. Seu agendamento${servicesClause(appointment?.services)} para o dia ${appointment?.date} às ${appointment?.time} foi cancelado.`,

  LEMBRETE: (name, appointment) =>
    `Ei, ${name}, passando para lembrar do seu horário hoje às ${appointment?.time}${appointment?.services && formatServices(appointment.services) ? ` (${formatServices(appointment.services)})` : ""}! ⏰`,
};

module.exports = messageList;
