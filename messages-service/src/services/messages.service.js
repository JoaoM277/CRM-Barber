const { providerMessage } = require("../providers/message.provider");
const messageList = require("../dictionary/templates.messages");
const logController = require("../controllers/message.log.controller");
// --------------------------------------------------------------------------
// 1. Service de Mensagens e suas dependencias
// --------------------------------------------------------------------------

const messageService = async (mensageData) => {
  const { phone, name, trigger, date, time, barber, ip } = mensageData;

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

    const messageError =
      "Campos de 'data' e 'hora'são obrigatorios pra esse gatilho";
    await logController.ControllerLogs({
      action: "WHATSAPP_MENSAGE_SENT",
      model: trigger,
      client_id: 1,
      description:
        "Mensagem não enviada para: " + phone + " [MOTIVO: INVALID_TRIGGER]",
      ip: ip,
    });
    return {
      status: "failed",
      error: messageError,
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

    await logController.ControllerLogs({
      action: "WHATSAPP_MENSAGE_SENT",
      model: trigger,
      client_id: 1,
      description:
        "Mensagem não enviada para: " + phone + " [MOTIVO: SPAM_BLOQ]",
      ip: ip,
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
  const templateSelect = messageList[trigger];
  if (!templateSelect) {
    console.error(
      `[ERRO]O gatilho '${trigger}' não possui template configurado`,
    );

    await logController.ControllerLogs({
      action: "WHATSAPP_MENSAGE_SENT",
      model: trigger,
      client_id: 1,
      description:
        "Mensagem não enviada para: " + phone + " [MOTIVO: TEMPLATE_NOT_FOUND]",
      ip: ip,
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
  const response = await providerMessage(phone, respost);
  if (!response.sucess) {
    await logController.ControllerLogs({
      action: "WHATSAPP_MENSAGE_SENT",
      model: trigger,
      client_id: 1,
      description:
        "Mensagem não enviada para: " + phone + " [MOTIVO: PROVIDER_REJECTED]",
      ip: ip,
    });

    return { status: "failed", error: response.errorMensage };
  }

    await logController.ControllerLogs({
      action: "WHATSAPP_MENSAGE_SENT",
      model: trigger,
      client_id: 1,
      description:
        "Mensagem  enviada para: " + phone + " [SUCESS]",
      ip: ip,
    });

  return {
    status: "dispatched",
    trigger: trigger,
    messageId: response.messageId,
    client: name,
  };
};

module.exports = { messageService };
