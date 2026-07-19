const { providerMenssage } = require("../providers/message.provider");
const mensageList = require("../dictionary/templates.messages");
const numList = require("../dictionary/clientes.list");
//mais tarde implementar a função de registrar no banco de dados

//const getMessageTemplate = (trigger, name, appointment) => {
//const date = appointment?.date || "data agendada";
//const time = appointment?.time || "hora marcada";

//const templates = {
// AGENDAMENTO: `Ola, ${name} seu agendamento foi marcado pra o dia ${date} as ${time} horas`,
//CANCELAMENTO: `Ola, ${name} seu agendamento foi cancelado`,
//LEMBRETE: `Ola ${name}, passando pra lembrar voce do seu horario amanhã as ${time} do dia ${date}`,
//};
//};

const messageService = async (mensageData) => {
  const { phone, name, trigger, date, time, barber } = mensageData;

  //Trava de segurança caso venha sem data
  if (
    ((trigger === "AGENDAMENTO" || trigger === "LEMBRETE") && !date) ||
    !time
  ) {
    console.warn(
      `[BLOQUEADO] Tentativa de envio ${trigger} com data ou hora invalidos`,
    );
    return {
      status: "failed",
      error: "Campos de 'data' e 'hora' são obrigatorios pra este gatilho",
    };
  }
  //Trava de segurança anti-spam e anti-horario
  const horaAtual = new Date().getHours();
  if (trigger === "LEMBRETE" && (horaAtual >= 22 || horaAtual < 7)) {
    console.warn(
      `[BLOQUEADO] Envio de LEMBRETE retido pra enviar spam do horario comercial`,
    );
    return {
      status: "held",
      message:
        "Lembrete retido devido ao horario restrito. Envio permitido apenas em horario comercial",
    };
  }

  //Logica de busca de info do cliente
  const templateSelect = mensageList[trigger];
  if (!templateSelect) {
    console.error(
      `[ERRO]O gatilho '${trigger}' não possui template configurado`,
    );
    return {
      status: "failed",
      error: "Template não encontrado pra esse gatilho",
    };
  }
  //const clientExists = numList.some((item) => item.phone === searchBody.phone);
  // if (clientExists) {
  //const clienteSearched = numList.find(
  //(item) => item.phone === searchBody.phone,
  //);
  //console.log(clienteSearched.client, "certo");
  //} else {
  //numList.push(searchBody);
  //}
  //Logica de seleção de mensagem

  //const messageRespost = mensageList.find((item) => item.event === event);
  const respost = templateSelect(name, { date, time, barber });
  const response = await providerMenssage(phone, respost);
  if (!response.sucess) {
    return { status: "failed", error: response.errorMensage };
  }

  //return response;
  return {
    status: "dispatched",
    trigger: trigger,
    messageId: response.messageId,
    client: name,
  };
};

module.exports = { messageService };
