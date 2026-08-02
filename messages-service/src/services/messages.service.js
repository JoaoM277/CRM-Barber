const { providerMenssage } = require("../providers/message.provider");
const mensageList = require("../dictionary/templates.messages");
const numList = require("../dictionary/clientes.list");
const logService = require("../controllers/message.log.controller");
// --------------------------------------------------------------------------
// 1. Service de Mensagens e suas dependencias
// --------------------------------------------------------------------------

const messageService = async (mensageData) => {
  const { phone, name, trigger, date, time, barber } = mensageData;

  // --------------------------------------------------------------------------
  // 2. Travas de segurança Anti-Gatilho-Invalido
  // --------------------------------------------------------------------------
  if (
    ((trigger === "AGENDAMENTO" || trigger === "LEMBRETE") && !date) ||
    !time
  ) {
    console.warn(
      `[BLOQUEADO] Tentativa de envio ${trigger} com data ou hora invalidos`,
    );

    const errormessage =
      "Campos de 'data' e 'hora'são obrigatorios pra esse gatilho";
    await logController.handleCreateLog({
      phone,
      trigger,
      message: null,
      success: false,
      errorReason: "INVALID_DATE_OR_TIME",
      responseCode: 400,
    });
    return {
      status: "failed",
      error: errormessage,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Travas de segurança Anti-spam e Anti-horario-indevido
  // --------------------------------------------------------------------------
  const horaAtual = new Date().getHours();
  if (trigger === "LEMBRETE" && (horaAtual >= 22 || horaAtual < 7)) {
    console.warn(
      `[BLOQUEADO] Envio de LEMBRETE retido pra enviar spam do horario comercial`,
    );

    await logController.handleCreateLog({
      phone,
      trigger,
      message: null,
      success: false,
      errorReason: "HELD_OUT_OF_BUSINESS_HOURS",
      responseCode: 422,
    });

    return {
      status: "held",
      message:
        "Lembrete retido devido ao horario restrito. Envio permitido apenas em horario comercial",
    };
  }

  // --------------------------------------------------------------------------
  // 4. Busca de template e info do cliente
  // --------------------------------------------------------------------------
  const templateSelect = mensageList[trigger];
  if (!templateSelect) {
    console.error(
      `[ERRO]O gatilho '${trigger}' não possui template configurado`,
    );

    await logController.handleCreateLog({
      phone,
      trigger,
      message: null,
      success: false,
      errorReason: "TEMPLATE_NOT_FOUND",
      responseCode: 404,
    });

    return {
      status: "failed",
      error: "Template não encontrado pra esse gatilho",
    };
  }
  // --------------------------------------------------------------------------
  // 5. Seleção de template baseado nas informações vindas do controller
  // --------------------------------------------------------------------------
  const respost = templateSelect(name, { date, time, barber });
  const response = await providerMenssage(phone, respost);
  if (!response.sucess) {
    await logController.handleCreateLog({
      phone,
      trigger,
      message: respost,
      success: false,
      errorReason: response.errorMensage || "PROVIDER_REJECTED",
      responseCode: response.code || 345,
    });

    return { status: "failed", error: response.errorMensage };
  }

  await logController.handleCreateLog({
    phone,
    trigger,
    message: respost,
    success: true,
    responseCode: 200,
  });

  return {
    status: "dispatched",
    trigger: trigger,
    messageId: response.messageId,
    client: name,
  };
};

module.exports = { messageService };
