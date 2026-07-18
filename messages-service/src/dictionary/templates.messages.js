const mensageList = {
  AGENDAMENTO: (name, appointment) =>
    `Olá, ${name}! Seu agendamento foi confirmado para o dia ${appointment?.date || "marcado"} às ${appointment?.time || "marcado"}. Te esperamos! 💈`,

  CANCELAMENTO: (name, appointment) =>
    `Olá, ${name}. Seu agendamento para o dia ${appointment?.date} às ${appointment?.time} foi cancelado.`,

  LEMBRETE: (name, appointment) =>
    `Ei, ${name}, passando para lembrar do seu horário hoje às ${appointment?.time}! ⏰`,
};

module.exports = mensageList;
