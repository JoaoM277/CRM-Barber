// --------------------------------------------------------------------------
// 1. Repositorio de Logs (simulado) (temporario)
// --------------------------------------------------------------------------


const findMessageLogs = async ({ trigger, status, page = 1, limit = 10 }) => {
  /*
    const offset = (page - 1) * limit;
    const where = {};

    if (trigger) where.trigger = trigger;
    if (status) where.status = status;

    return await db.messageLog.findMany({
       where,
       skip: offset,
       take: Number(limit),
       orderBy: {createAt: 'desc'}
       })
  */
  console.log(
    `[REPOSITORY] Buscando logs - Trigger: ${trigger || "Todos"}, Status: ${status || "Todos"}, Paginas: ${page}`,
  );

  return [
    {
      id: "log_1",
      messageId: "fake-id-a1b2c3d",
      recipientNumber: "55999848484",
      recipientName: "Paulo",
      trigger: "AGENDAMENTO",
      content:
        "Olá, Paulo! Seu agendamento foi confirmado para o dia 21/07 às 15:00. Te esperamos! 💈",
      status: "DISPATCHED",
      provider: "infobip-fake",
      errorMessage: null,
      createdAt: "2026-07-21T14:30:00.000Z",
    },
  ];
};

module.exports = { findMessageLogs };
